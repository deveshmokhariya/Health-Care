from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.db.models.doctor_profile import DoctorProfile
from app.db.models.doctor_leave import DoctorLeave
from app.db.models.appointment import Appointment, AppointmentStatus

# Clinic timezone — all working hours are entered and interpreted in IST
CLINIC_TZ = ZoneInfo("Asia/Kolkata")

@dataclass(frozen=True)
class SlotInfo:
    slot_start: datetime
    slot_end: datetime
    is_available: bool

async def generate_slots(
    doctor_id: UUID,
    target_date: date,
    session: AsyncSession,
    *,
    include_unavailable: bool = False,
) -> list[SlotInfo]:
    """
    Generates available and optionally unavailable slots for a doctor on a given date.
    Working hours are stored as local IST times and slots are generated in IST.
    """
    # 1. Fetch Doctor Profile
    profile_stmt = select(DoctorProfile).where(DoctorProfile.user_id == doctor_id)
    result = await session.execute(profile_stmt)
    profile = result.scalar_one_or_none()
    if not profile:
        raise ValueError("Doctor profile not found")

    # 2. Check if date is in the past (compare in IST)
    today = datetime.now(CLINIC_TZ).date()
    if target_date < today:
        return []

    # 3. Check working days (ISO: 1=Mon, 7=Sun)
    if target_date.isoweekday() not in profile.working_days:
        return []

    # 4. Check if doctor is on leave
    leave_stmt = select(DoctorLeave).where(
        and_(
            DoctorLeave.doctor_id == doctor_id,
            DoctorLeave.leave_date == target_date
        )
    )
    leave_result = await session.execute(leave_stmt)
    if leave_result.scalar_one_or_none():
        return []

    # 5. Generate raw slots in IST (doctor enters local times)
    start_dt = datetime.combine(target_date, profile.working_hours_start, tzinfo=CLINIC_TZ)
    end_dt = datetime.combine(target_date, profile.working_hours_end, tzinfo=CLINIC_TZ)
    duration = timedelta(minutes=profile.slot_duration_minutes)

    raw_slots = []
    cursor = start_dt
    while cursor + duration <= end_dt:
        raw_slots.append((cursor, cursor + duration))
        cursor += duration

    # 6. Fetch ACTIVE bookings (held or confirmed)
    now_ist = datetime.now(CLINIC_TZ)
    bookings_stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == doctor_id,
            Appointment.slot_start >= start_dt,
            Appointment.slot_start < end_dt,
            Appointment.status.in_([AppointmentStatus.confirmed, AppointmentStatus.held, AppointmentStatus.completed])
        )
    )
    bookings_result = await session.execute(bookings_stmt)
    active_appointments = bookings_result.scalars().all()

    booked_starts = {appt.slot_start for appt in active_appointments}

    # 7. Assemble response
    slots = []
    for s_start, s_end in raw_slots:
        is_available = s_start not in booked_starts

        # Don't show past slots for today
        if target_date == today and s_start <= now_ist:
            is_available = False

        if is_available or include_unavailable:
            slots.append(SlotInfo(
                slot_start=s_start,
                slot_end=s_end,
                is_available=is_available
            ))

    return slots
