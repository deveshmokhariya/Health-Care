from typing import Annotated
from fastapi import Depends, HTTPException, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.db.session import get_session
from app.core.security import decode_token
from app.db.models.user import User, UserRole


async def get_current_user(
    session: Annotated[AsyncSession, Depends(get_session)],
    access_token: Annotated[str | None, Cookie()] = None,
) -> User:
    """
    Extracts the current user from the access_token cookie.
    Raises HTTP 401 if missing / invalid.
    """
    credentials_exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not access_token:
        raise credentials_exc

    try:
        payload = decode_token(access_token)
        if payload.get("type") != "access":
            raise credentials_exc
        user_id: str | None = payload.get("sub")
        if user_id is None:
            raise credentials_exc
    except Exception:
        raise credentials_exc

    result = await session.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_role(*roles: UserRole):
    """Factory for role-based guards. Usage: Depends(require_role(UserRole.admin))"""

    async def _guard(current_user: Annotated[User, Depends(get_current_user)]) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access restricted to: {[r.value for r in roles]}",
            )
        return current_user

    return _guard


# Convenience aliases
AdminRequired = Depends(require_role(UserRole.admin))
DoctorRequired = Depends(require_role(UserRole.doctor))
PatientRequired = Depends(require_role(UserRole.patient))
CurrentUser = Annotated[User, Depends(get_current_user)]
