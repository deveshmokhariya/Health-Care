
import os, asyncio
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy import select
from app.db.models.user import User
from app.db.models.appointment import Appointment
from dotenv import load_dotenv

load_dotenv()
async def test():
    engine = create_async_engine(os.getenv('DATABASE_URL'))
    async with AsyncSession(engine) as session:
        users = (await session.execute(select(User).where(User.role == 'patient'))).scalars().all()
        for u in users:
            appts = (await session.execute(select(Appointment).where(Appointment.patient_id == u.id))).scalars().all()
            print(f'Patient: {u.email} - Appointments: {len(appts)}')
asyncio.run(test())

