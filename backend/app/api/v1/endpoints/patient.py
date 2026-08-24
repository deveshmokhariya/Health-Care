from typing import List, Optional
from uuid import UUID
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.dependencies import get_session, PatientRequired
from app.db.models.user import User, UserRole
from app.db.models.doctor_profile import DoctorProfile
from app.db.models.appointment import Appointment
from app.db.models.visit_note import VisitNote
from app.schemas.patient import (
    HoldSlotRequest, HoldSlotResponse,
    ConfirmBookingRequest, AppointmentResponse,
    CancelRequest, RescheduleRequest, PatientDetailedAppointmentResponse
)
from app.services.booking_service import (
    hold_slot, confirm_booking, cancel_appointment,
    reschedule_appointment, SlotUnavailableError, AppointmentNotFoundError
)
from app.services.slot_service import generate_slots

router = APIRouter()


# ──────────────────────────────────────────────
#  DOCTOR SEARCH & SLOTS  (for patient booking)
# ──────────────────────────────────────────────

@router.get("/doctors")
async def list_doctors_for_patient(
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    """Return all active doctors with their profile info."""
    stmt = (
        select(DoctorProfile)
        .join(User, User.id == DoctorProfile.user_id)
        .where(User.is_active == True)
    )
    profiles = (await session.execute(stmt)).scalars().all()

    result = []
    for p in profiles:
        # fetch the user record for name/email
        user = await session.get(User, p.user_id)
        if not user:
            continue
        result.append({
            "id": str(p.user_id),          # doctor's user ID
            "profile_id": str(p.id),
            "full_name": user.full_name or user.email,
            "email": user.email,
            "specialisation": p.specialisation or "General",
            "working_days": p.working_days or [],
            "working_hours_start": str(p.working_hours_start) if p.working_hours_start else None,
            "working_hours_end": str(p.working_hours_end) if p.working_hours_end else None,
            "slot_duration_minutes": p.slot_duration_minutes or 30,
        })

    return JSONResponse(content=result)


@router.get("/doctors/{doctor_id}/slots")
async def get_doctor_slots(
    doctor_id: UUID,
    target_date: date = Query(...),
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    """Return available slots for a doctor on a given date."""
    slots = await generate_slots(doctor_id=doctor_id, target_date=target_date, session=session)

    available = [
        {
            "slot_start": s.slot_start.isoformat(),
            "slot_end": s.slot_end.isoformat(),
            "is_available": s.is_available,
        }
        for s in slots if s.is_available
    ]

    # Return in DoctorSearchResponse shape that frontend expects
    doctor_user = await session.get(User, doctor_id)
    doctor_name = doctor_user.full_name if doctor_user else str(doctor_id)

    return JSONResponse(content=[{
        "doctor": {
            "id": str(doctor_id),
            "full_name": doctor_name,
        },
        "available_slots": available,
    }])


# ──────────────────────────────────────────────
#  APPOINTMENTS
# ──────────────────────────────────────────────

@router.post("/appointments/hold", response_model=HoldSlotResponse)
async def create_hold(
    req: HoldSlotRequest,
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    try:
        appt = await hold_slot(
            patient_id=patient.id,
            doctor_id=req.doctor_id,
            slot_start=req.slot_start,
            session=session
        )
        await session.commit()
        return HoldSlotResponse(
            appointment_id=appt.id,
            expires_at=appt.expires_at,
            slot_start=appt.slot_start,
            slot_end=appt.slot_end
        )
    except SlotUnavailableError as e:
        await session.rollback()
        raise HTTPException(status_code=409, detail=str(e))


@router.post("/appointments/{appointment_id}/confirm", response_model=AppointmentResponse)
async def confirm_hold(
    appointment_id: UUID,
    req: ConfirmBookingRequest,
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    try:
        appt, form = await confirm_booking(
            appointment_id=appointment_id,
            patient_id=patient.id,
            symptoms=req.symptoms,
            duration_days=req.duration_days,
            severity=req.severity,
            session=session
        )
        await session.commit()
        # Serialize manually to avoid enum issues
        return JSONResponse(content={
            "id": str(appt.id),
            "doctor_id": str(appt.doctor_id),
            "patient_id": str(appt.patient_id),
            "slot_start": appt.slot_start.isoformat(),
            "slot_end": appt.slot_end.isoformat(),
            "status": appt.status.value if hasattr(appt.status, 'value') else str(appt.status),
            "created_at": appt.created_at.isoformat(),
        })
    except AppointmentNotFoundError as e:
        await session.rollback()
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/appointments")
async def list_patient_appointments(
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    stmt = select(Appointment).options(
        joinedload(Appointment.doctor),
        joinedload(Appointment.visit_note).joinedload(VisitNote.prescriptions),
        joinedload(Appointment.symptom_form)
    ).where(Appointment.patient_id == patient.id).order_by(Appointment.slot_start.desc())
    appts = (await session.execute(stmt)).unique().scalars().all()

    result = []
    for a in appts:
        doctor_info = None
        if a.doctor:
            doctor_info = {"id": str(a.doctor.id), "full_name": a.doctor.full_name}

        visit_note_info = None
        if a.visit_note:
            prescriptions_info = []
            for p in a.visit_note.prescriptions:
                prescriptions_info.append({
                    "id": str(p.id),
                    "medication_name": p.medication_name,
                    "dosage": p.dosage,
                    "frequency": p.frequency,
                    "duration_days": p.duration_days,
                    "instructions": p.instructions,
                })
            visit_note_info = {
                "id": str(a.visit_note.id),
                "llm_patient_summary": a.visit_note.llm_patient_summary,
                "prescriptions": prescriptions_info,
            }

        symptom_form_info = None
        if a.symptom_form:
            symptom_form_info = {
                "symptoms": a.symptom_form.symptoms,
                "llm_summary": a.symptom_form.llm_summary,
                "llm_urgency_level": a.symptom_form.llm_urgency_level.value if a.symptom_form.llm_urgency_level else None,
            }

        result.append({
            "id": str(a.id),
            "doctor_id": str(a.doctor_id),
            "patient_id": str(a.patient_id),
            "slot_start": a.slot_start.isoformat(),
            "slot_end": a.slot_end.isoformat(),
            "status": a.status.value if hasattr(a.status, 'value') else str(a.status),
            "created_at": a.created_at.isoformat(),
            "doctor": doctor_info,
            "visit_note": visit_note_info,
            "symptom_form": symptom_form_info,
        })

    return JSONResponse(content=result)


@router.delete("/appointments/{appointment_id}")
async def cancel_patient_appointment(
    appointment_id: UUID,
    req: CancelRequest,
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    try:
        appt = await cancel_appointment(appointment_id, patient.id, req.reason, session)
        await session.commit()
        return JSONResponse(content={
            "id": str(appt.id),
            "status": appt.status.value if hasattr(appt.status, 'value') else str(appt.status),
        })
    except AppointmentNotFoundError:
        await session.rollback()
        raise HTTPException(status_code=404, detail="Appointment not found")


@router.post("/appointments/{appointment_id}/reschedule", response_model=HoldSlotResponse)
async def reschedule(
    appointment_id: UUID,
    req: RescheduleRequest,
    session: AsyncSession = Depends(get_session),
    patient: User = PatientRequired
):
    try:
        new_hold = await reschedule_appointment(
            appointment_id=appointment_id,
            patient_id=patient.id,
            new_slot_start=req.new_slot_start,
            session=session
        )
        await session.commit()
        return HoldSlotResponse(
            appointment_id=new_hold.id,
            expires_at=new_hold.expires_at,
            slot_start=new_hold.slot_start,
            slot_end=new_hold.slot_end
        )
    except (AppointmentNotFoundError, SlotUnavailableError) as e:
        await session.rollback()
        raise HTTPException(status_code=400, detail=str(e))
