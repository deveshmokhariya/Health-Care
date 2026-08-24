
import asyncio, os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from app.db.models.appointment import Appointment, AppointmentStatus
from sqlalchemy import select
from dotenv import load_dotenv

load_dotenv()
async def test():
    engine = create_async_engine(os.getenv('DATABASE_URL'))
    async with AsyncSession(engine) as session:
        stmt = select(Appointment).limit(1)
        appt = (await session.execute(stmt)).scalars().first()
        print('Original status type:', type(appt.status))
        appt.status = 'completed'
        print('New status type:', type(appt.status))
        try:
            await session.commit()
            print('Commit successful!')
        except Exception as e:
            print('Commit failed:', e)
asyncio.run(test())

