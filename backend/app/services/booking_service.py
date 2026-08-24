import logging
from datetime import datetime, timedelta, timezone
from uuid import UUID
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, update
from sqlalchemy.exc import IntegrityError
from fastapi import HTTPException, status

from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.doctor_profile import DoctorProfile
from app.db.models.symptom_form import SymptomForm

logger = logging.getLogger(__name__)

class SlotUnavailableError(Exception):
    pass

class HoldExpiredError(Exception):
    pass

class AppointmentNotFoundError(Exception):
    pass

async def hold_slot(
    patient_id: UUID,
    doctor_id: UUID,
    slot_start: datetime,
    session: AsyncSession,
) -> Appointment:
    """Places a 5-minute hold on a slot using SELECT FOR UPDATE SKIP LOCKED."""
    # Ensure UTC
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)
        
    # Get slot duration
    profile_stmt = select(DoctorProfile.slot_duration_minutes).where(DoctorProfile.user_id == doctor_id)
    duration_mins = (await session.execute(profile_stmt)).scalar_one_or_none()
    if not duration_mins:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    slot_end = slot_start + timedelta(minutes=duration_mins)

    # 1. Try to lock any active row for this slot (held or confirmed)
    # Using with_for_update(skip_locked=True)
    lock_stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == doctor_id,
            Appointment.slot_start == slot_start,
            Appointment.status.in_([AppointmentStatus.held, AppointmentStatus.confirmed])
        )
    ).with_for_update(skip_locked=True)
    
    existing = (await session.execute(lock_stmt)).scalar_one_or_none()
    
    now = datetime.now(timezone.utc)
    
    if existing:
        if existing.status == AppointmentStatus.confirmed:
            raise SlotUnavailableError("Slot already booked")
            
        if existing.status == AppointmentStatus.held and existing.expires_at and existing.expires_at > now:
            raise SlotUnavailableError("Slot is currently held by another patient")
            
        if existing.status == AppointmentStatus.held and existing.expires_at and existing.expires_at <= now:
            # Expired hold -> mark expired so we can insert ours
            existing.status = AppointmentStatus.expired
            session.add(existing)
            await session.flush()
    
    # 2. Insert new hold
    expires_at = now + timedelta(minutes=5)
    new_hold = Appointment(
        patient_id=patient_id,
        doctor_id=doctor_id,
        slot_start=slot_start,
        slot_end=slot_end,
        status=AppointmentStatus.held,
        expires_at=expires_at
    )
    
    session.add(new_hold)
    
    try:
        await session.flush()
    except IntegrityError as e:
        # Fallback for the partial unique index
        await session.rollback()
        raise SlotUnavailableError("Slot is currently held or booked")
        
    return new_hold

from app.core.llm import parse_symptoms

async def confirm_booking(
    appointment_id: UUID,
    patient_id: UUID,
    symptoms: str,
    duration_days: int | None,
    severity: int | None,
    session: AsyncSession,
) -> tuple[Appointment, SymptomForm]:
    """Confirms a held appointment and creates symptom form."""
    stmt = select(Appointment).where(
        and_(Appointment.id == appointment_id, Appointment.patient_id == patient_id)
    ).with_for_update()
    
    appt = (await session.execute(stmt)).scalar_one_or_none()
    
    if not appt:
        raise AppointmentNotFoundError()
        
    if appt.status == AppointmentStatus.confirmed:
        # Already confirmed, idempotency
        form_stmt = select(SymptomForm).where(SymptomForm.appointment_id == appt.id)
        form = (await session.execute(form_stmt)).scalar_one_or_none()
        return appt, form
        
    if appt.status != AppointmentStatus.held:
        raise HTTPException(status_code=400, detail="Appointment is not in held status")
        
    now = datetime.now(timezone.utc)
    if appt.expires_at and appt.expires_at <= now:
        appt.status = AppointmentStatus.expired
        await session.flush()
        raise HoldExpiredError("Your hold on this slot has expired")
        
    # Confirm
    appt.status = AppointmentStatus.confirmed
    
    # Process via LLM Mock
    # Default to severity 5 if not provided
    llm_result = parse_symptoms(symptoms, severity or 5)
    
    # Create symptom form
    form = SymptomForm(
        appointment_id=appt.id,
        patient_id=patient_id,
        symptoms=symptoms,
        duration_days=duration_days,
        severity=severity,
        llm_urgency_level=llm_result.get("llm_urgency_level"),
        llm_summary=llm_result.get("llm_summary")
    )
    session.add(form)
    
    # Trigger Background Jobs (Step 6 & 7 Mocks)
    from app.worker.tasks import send_email_notification, sync_calendar_event
    
    send_email_notification(
        email="patient@example.com", 
        subject="Appointment Confirmed", 
        body=f"Your appointment is confirmed for {appt.slot_start}. Symptoms noted: {llm_result.get('llm_summary')}"
    )
    
    sync_calendar_event(
        user_id=str(patient_id),
        event_details={"start": str(appt.slot_start), "doctor_id": str(appt.doctor_id)}
    )
    
    return appt, form

async def cancel_appointment(
    appointment_id: UUID,
    user_id: UUID, # Can be patient or admin
    reason: str | None,
    session: AsyncSession,
) -> Appointment:
    stmt = select(Appointment).where(Appointment.id == appointment_id).with_for_update()
    appt = (await session.execute(stmt)).scalar_one_or_none()
    
    if not appt:
        raise AppointmentNotFoundError()
        
    appt.status = AppointmentStatus.cancelled
    appt.cancellation_reason = reason
    appt.cancelled_by = user_id
    
    await session.flush()
    return appt

async def reschedule_appointment(
    appointment_id: UUID,
    patient_id: UUID,
    new_slot_start: datetime,
    session: AsyncSession,
) -> Appointment:
    """Atomic reschedule: cancel old, hold new."""
    # 1. Lock and cancel old
    old_stmt = select(Appointment).where(
        and_(Appointment.id == appointment_id, Appointment.patient_id == patient_id)
    ).with_for_update()
    old_appt = (await session.execute(old_stmt)).scalar_one_or_none()
    
    if not old_appt:
        raise AppointmentNotFoundError()
        
    old_appt.status = AppointmentStatus.cancelled
    old_appt.cancellation_reason = "Rescheduled by patient"
    old_appt.cancelled_by = patient_id
    
    await session.flush()
    
    # 2. Hold new
    # If this fails, the whole transaction rolls back, preserving the old appointment
    new_hold = await hold_slot(
        patient_id=patient_id,
        doctor_id=old_appt.doctor_id,
        slot_start=new_slot_start,
        session=session
    )
    
    return new_hold
