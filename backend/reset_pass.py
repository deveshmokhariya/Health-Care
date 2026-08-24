import asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import text
from app.core.security import hash_password

async def main():
    engine = create_async_engine('postgresql+asyncpg://healthcare_user:healthcare_pass@localhost:5432/healthcare_db')
    async with AsyncSession(engine) as session:
        hashed = hash_password('admin1234')
        await session.execute(text("UPDATE users SET hashed_password = :h WHERE email = 'admin@clinic.com'"), {'h': hashed})
        await session.commit()
    await engine.dispose()
    print('Password updated cleanly via SQLAlchemy!')

asyncio.run(main())
