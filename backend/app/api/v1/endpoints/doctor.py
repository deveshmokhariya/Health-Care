from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID
from datetime import date

from app.db.session import get_session
from app.db.models.appointment import Appointment
from app.db.models.visit_note import VisitNote
from app.db.models.prescription import Prescription
from app.db.models.user import User
from app.db.models.doctor_profile import DoctorProfile
from app.schemas.doctor import VisitNoteCreate, VisitCompleteResponse, PrescriptionItem, DoctorAppointmentResponse
from app.core.dependencies import get_current_user
from app.core.llm import extract_prescriptions
from sqlalchemy.orm import joinedload
from typing import List

router = APIRouter()

@router.get("/appointments/today", response_model=List[DoctorAppointmentResponse])
async def get_todays_appointments(
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
        
    stmt = select(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.symptom_form),
        joinedload(Appointment.visit_note)
    ).where(
        Appointment.doctor_id == current_user.id,
    ).order_by(Appointment.slot_start.desc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/appointments/{appointment_id}", response_model=DoctorAppointmentResponse)
async def get_appointment(
    appointment_id: UUID,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")
        
    stmt = select(Appointment).options(
        joinedload(Appointment.patient),
        joinedload(Appointment.symptom_form),
        joinedload(Appointment.visit_note)
    ).where(
        Appointment.id == appointment_id,
        Appointment.doctor_id == current_user.id
    )
    result = await db.execute(stmt)
    appointment = result.scalars().first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appointment

@router.post("/appointments/{appointment_id}/complete", response_model=VisitCompleteResponse)
async def complete_visit(
    appointment_id: UUID,
    body: VisitNoteCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this endpoint")

    # Verify appointment belongs to doctor
    stmt = select(Appointment).where(Appointment.id == appointment_id, Appointment.doctor_id == current_user.id)
    result = await db.execute(stmt)
    appointment = result.scalars().first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    if appointment.status == 'completed':
         raise HTTPException(status_code=400, detail="Appointment already completed")
         
    # Generate notes and prescriptions via LLM Mock
    llm_result = extract_prescriptions(body.raw_notes)
    
    # Save Visit Note
    visit_note = VisitNote(
        appointment_id=appointment_id,
        doctor_id=current_user.id,
        raw_notes=body.raw_notes,
        llm_patient_summary=llm_result.get("llm_patient_summary")
    )
    db.add(visit_note)
    await db.flush() # get visit_note id
    
    # Save Prescriptions
    saved_prescriptions = []
    for p_data in llm_result.get("prescriptions", []):
        p = Prescription(
            visit_note_id=visit_note.id,
            appointment_id=appointment_id,
            patient_id=appointment.patient_id,
            medication_name=p_data["medication_name"],
            dosage=p_data["dosage"],
            frequency=p_data["frequency"],
            duration_days=p_data["duration_days"],
            instructions=p_data.get("instructions"),
            reminder_enabled=p_data.get("reminder_enabled", True)
        )
        db.add(p)
        saved_prescriptions.append(p)
        
    # Mark appointment as completed
    appointment.status = 'completed'
    db.add(appointment)
    
    await db.commit()
    await db.refresh(visit_note)
    for p in saved_prescriptions:
        await db.refresh(p)
        
    # Trigger background tasks (Step 8 Mock)
    from app.worker.tasks import schedule_reminders
    for p in saved_prescriptions:
        if p.reminder_enabled:
            schedule_reminders(str(p.id))
        
    return {
        "visit_note": visit_note,
        "prescriptions": saved_prescriptions
    }

@router.get("/profile")
async def get_doctor_profile(
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403)
    stmt = select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    profile = (await session.execute(stmt)).scalar_one_or_none()

    # Auto-create a default profile if one doesn't exist yet (new doctor)
    if not profile:
        from datetime import datetime as _dt
        profile = DoctorProfile(
            user_id=current_user.id,
            specialisation="General",
            working_days=[1, 2, 3, 4, 5],
            working_hours_start=_dt.strptime("09:00:00", "%H:%M:%S").time(),
            working_hours_end=_dt.strptime("17:00:00", "%H:%M:%S").time(),
            slot_duration_minutes=30
        )
        session.add(profile)
        await session.commit()
        await session.refresh(profile)

    return profile

from datetime import datetime

@router.put("/profile")
async def update_doctor_profile(
    body: dict,
    session: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "doctor":
        raise HTTPException(status_code=403)
    stmt = select(DoctorProfile).where(DoctorProfile.user_id == current_user.id)
    profile = (await session.execute(stmt)).scalar_one_or_none()
    
    if not profile:
        profile = DoctorProfile(
            user_id=current_user.id,
            specialisation="General",
            working_days=[1,2,3,4,5],
            working_hours_start=datetime.strptime("09:00:00", "%H:%M:%S").time(),
            working_hours_end=datetime.strptime("17:00:00", "%H:%M:%S").time(),
            slot_duration_minutes=30
        )
        session.add(profile)
    
    if "working_hours_start" in body: 
        profile.working_hours_start = datetime.strptime(body["working_hours_start"], "%H:%M:%S").time()
    if "working_hours_end" in body: 
        profile.working_hours_end = datetime.strptime(body["working_hours_end"], "%H:%M:%S").time()
    if "slot_duration_minutes" in body: 
        profile.slot_duration_minutes = int(body["slot_duration_minutes"])
    
    await session.commit()
    return profile
