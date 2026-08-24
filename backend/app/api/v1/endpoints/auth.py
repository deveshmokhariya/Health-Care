from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, Response, status, Cookie
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from jose import JWTError

from app.core.config import settings
from app.core.security import (
    hash_password, verify_password,
    create_access_token, create_refresh_token, decode_token,
)
from app.core.dependencies import get_current_user, CurrentUser
from app.db.session import get_session
from app.db.models.user import User
from app.schemas.auth import RegisterRequest, LoginRequest, UserResponse, TokenResponse

router = APIRouter(prefix="/auth", tags=["Auth"])

COOKIE_SAMESITE = "lax"
COOKIE_SECURE = False  # Set True in production (HTTPS)


def _set_auth_cookies(response: Response, user_id: str, role: str) -> None:
    access_token = create_access_token(user_id, role)
    refresh_token = create_refresh_token(user_id)

    response.set_cookie(
        key="access_token",
        value=access_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        max_age=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        samesite=COOKIE_SAMESITE,
        secure=COOKIE_SECURE,
        max_age=settings.JWT_REFRESH_TOKEN_EXPIRE_DAYS * 86400,
    )


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    body: RegisterRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Create a new user account. Returns auth cookies on success."""
    existing = await session.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        full_name=body.full_name,
        role=body.role,
        phone=body.phone,
    )
    session.add(user)
    await session.flush()  # Populate user.id before commit

    _set_auth_cookies(response, str(user.id), user.role.value)
    return TokenResponse(message="Registration successful", user=UserResponse.model_validate(user))


@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    response: Response,
    session: AsyncSession = Depends(get_session),
):
    """Authenticate with email + password. Returns auth cookies on success."""
    result = await session.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    _set_auth_cookies(response, str(user.id), user.role.value)
    return TokenResponse(message="Login successful", user=UserResponse.model_validate(user))


@router.post("/refresh", response_model=TokenResponse)
async def refresh(
    response: Response,
    session: AsyncSession = Depends(get_session),
    refresh_token: str | None = Cookie(default=None),
):
    """Issue a new access token using the refresh token cookie."""
    credentials_exc = HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    if not refresh_token:
        raise credentials_exc
    try:
        payload = decode_token(refresh_token)
        if payload.get("type") != "refresh":
            raise credentials_exc
        user_id: str = payload["sub"]
    except JWTError:
        raise credentials_exc

    from uuid import UUID
    result = await session.execute(select(User).where(User.id == UUID(user_id)))
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise credentials_exc

    _set_auth_cookies(response, str(user.id), user.role.value)
    return TokenResponse(message="Token refreshed", user=UserResponse.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    """Clear auth cookies."""
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    return {"message": "Logged out successfully"}


@router.get("/me", response_model=UserResponse)
async def me(current_user: CurrentUser):
    """Return the currently authenticated user's profile."""
    return UserResponse.model_validate(current_user)
