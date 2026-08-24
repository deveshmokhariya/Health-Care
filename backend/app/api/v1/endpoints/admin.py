from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from uuid import UUID
from datetime import date

from app.db.session import get_session
from app.core.dependencies import AdminRequired
from app.core.security import hash_password
from app.db.models.user import User, UserRole
from app.db.models.doctor_profile import DoctorProfile
from app.db.models.doctor_leave import DoctorLeave
from app.db.models.appointment import Appointment, AppointmentStatus
from app.db.models.notification import Notification, NotificationType
from app.schemas.admin import DoctorCreate, DoctorResponse, DoctorUpdate, LeaveCreate, LeaveResponse, ConflictResponse

router = APIRouter()

@router.post("/doctors", response_model=DoctorResponse, status_code=status.HTTP_201_CREATED)
async def create_doctor(
    doctor_in: DoctorCreate,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    """Create a new doctor user and their profile atomically."""
    # Check if email exists
    stmt = select(User).where(User.email == doctor_in.email)
    result = await session.execute(stmt)
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create User
    new_user = User(
        email=doctor_in.email,
        hashed_password=hash_password(doctor_in.password),
        full_name=doctor_in.full_name,
        role=UserRole.doctor,
        phone=doctor_in.phone
    )
    session.add(new_user)
    await session.flush() # get new_user.id

    # Create Profile
    new_profile = DoctorProfile(
        user_id=new_user.id,
        specialisation=doctor_in.specialisation,
        qualification=doctor_in.qualification,
        bio=doctor_in.bio,
        working_days=doctor_in.working_days,
        working_hours_start=doctor_in.working_hours_start,
        working_hours_end=doctor_in.working_hours_end,
        slot_duration_minutes=doctor_in.slot_duration_minutes,
        max_advance_days=doctor_in.max_advance_days
    )
    session.add(new_profile)
    await session.commit()
    
    # Return flattened response
    return DoctorResponse(
        id=new_profile.id,
        user_id=new_user.id,
        full_name=new_user.full_name,
        email=new_user.email,
        specialisation=new_profile.specialisation,
        working_days=new_profile.working_days,
        working_hours_start=new_profile.working_hours_start,
        working_hours_end=new_profile.working_hours_end,
        slot_duration_minutes=new_profile.slot_duration_minutes,
        is_active=new_user.is_active
    )

@router.get("/doctors", response_model=List[DoctorResponse])
async def list_doctors(
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    """List all doctors."""
    stmt = select(User, DoctorProfile).join(DoctorProfile).where(User.role == UserRole.doctor)
    result = await session.execute(stmt)
    
    doctors = []
    for user, profile in result.all():
        doctors.append(DoctorResponse(
            id=profile.id,
            user_id=user.id,
            full_name=user.full_name,
            email=user.email,
            specialisation=profile.specialisation,
            working_days=profile.working_days,
            working_hours_start=profile.working_hours_start,
            working_hours_end=profile.working_hours_end,
            slot_duration_minutes=profile.slot_duration_minutes,
            is_active=user.is_active
        ))
    return doctors

@router.post("/doctors/{user_id}/leaves", response_model=ConflictResponse)
async def mark_doctor_leave(
    user_id: UUID,
    leave_in: LeaveCreate,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    """
    Mark a doctor on leave for a specific date.
    Cancels any existing confirmed appointments and creates leave_conflict notifications.
    """
    # Verify doctor exists
    stmt = select(User).where(User.id == user_id, User.role == UserRole.doctor)
    if not (await session.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    # Check if leave already exists
    leave_stmt = select(DoctorLeave).where(and_(DoctorLeave.doctor_id == user_id, DoctorLeave.leave_date == leave_in.leave_date))
    if (await session.execute(leave_stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Leave already marked for this date")

    # 1. Create leave
    new_leave = DoctorLeave(
        doctor_id=user_id,
        leave_date=leave_in.leave_date,
        reason=leave_in.reason
    )
    session.add(new_leave)

    # 2. Find conflicts (confirmed appointments on that date)
    conflicts_stmt = select(Appointment).where(
        and_(
            Appointment.doctor_id == user_id,
            Appointment.status == AppointmentStatus.confirmed,
            # Cast slot_start to date for comparison
            Appointment.slot_start >= leave_in.leave_date, # simplified for brevity, assuming UTC
        )
    )
    # A more precise filter would check if slot_start.date() == leave_date
    conflicts = (await session.execute(conflicts_stmt)).scalars().all()
    
    cancelled_count = 0
    for appt in conflicts:
        if appt.slot_start.date() == leave_in.leave_date:
            # Cancel appointment
            appt.status = AppointmentStatus.cancelled
            appt.cancellation_reason = "Doctor on emergency leave"
            
            # Create notification
            notif = Notification(
                user_id=appt.patient_id,
                appointment_id=appt.id,
                type=NotificationType.leave_conflict,
                body=f"Your appointment on {appt.slot_start} has been cancelled due to doctor leave. Please reschedule.",
            )
            session.add(notif)
            cancelled_count += 1

    await session.commit()
    return ConflictResponse(cancelled_appointments=cancelled_count)

@router.put("/doctors/{user_id}", response_model=DoctorResponse)
async def update_doctor(
    user_id: UUID,
    doctor_in: DoctorUpdate,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(User, DoctorProfile).join(DoctorProfile).where(User.id == user_id, User.role == UserRole.doctor)
    result = await session.execute(stmt)
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    user, profile = row
    
    if doctor_in.email:
        user.email = doctor_in.email
    if doctor_in.password:
        user.hashed_password = hash_password(doctor_in.password)
    if doctor_in.is_active is not None:
        user.is_active = doctor_in.is_active
        
    if doctor_in.specialisation: profile.specialisation = doctor_in.specialisation
    if doctor_in.qualification: profile.qualification = doctor_in.qualification
    if doctor_in.bio: profile.bio = doctor_in.bio
    if doctor_in.working_days is not None: profile.working_days = doctor_in.working_days
    if doctor_in.working_hours_start: profile.working_hours_start = doctor_in.working_hours_start
    if doctor_in.working_hours_end: profile.working_hours_end = doctor_in.working_hours_end
    if doctor_in.slot_duration_minutes: profile.slot_duration_minutes = doctor_in.slot_duration_minutes
    
    await session.commit()
    
    return DoctorResponse(
        id=profile.id,
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        specialisation=profile.specialisation,
        working_days=profile.working_days,
        working_hours_start=profile.working_hours_start,
        working_hours_end=profile.working_hours_end,
        slot_duration_minutes=profile.slot_duration_minutes,
        is_active=user.is_active
    )

@router.delete("/doctors/{user_id}")
async def delete_doctor(
    user_id: UUID,
    hard_delete: bool = False,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy import delete
    from app.db.models.prescription import Prescription
    from app.db.models.symptom_form import SymptomForm
    from app.db.models.visit_note import VisitNote
    
    stmt = select(User).where(User.id == user_id, User.role == UserRole.doctor)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Doctor not found")
        
    if hard_delete:
        try:
            # 1. Get all doctor appointments
            appts_stmt = select(Appointment.id).where(Appointment.doctor_id == user_id)
            appt_ids = (await session.execute(appts_stmt)).scalars().all()
            
            if appt_ids:
                # 2. Delete related records
                await session.execute(delete(Prescription).where(Prescription.appointment_id.in_(appt_ids)))
                await session.execute(delete(SymptomForm).where(SymptomForm.appointment_id.in_(appt_ids)))
                await session.execute(delete(VisitNote).where(VisitNote.appointment_id.in_(appt_ids)))
                await session.execute(delete(Notification).where(Notification.appointment_id.in_(appt_ids)))
                # Note: CalendarEvent doesn't exist yet or wasn't fully mocked out, so we skip it or catch errors
            
            # 3. Delete doctor-specific records
            await session.execute(delete(DoctorLeave).where(DoctorLeave.doctor_id == user_id))
            await session.execute(delete(DoctorProfile).where(DoctorProfile.user_id == user_id))
            
            # 4. Delete appointments
            if appt_ids:
                await session.execute(delete(Appointment).where(Appointment.doctor_id == user_id))
                
            # 5. Delete user
            await session.delete(user)
            await session.commit()
            return {"detail": "Doctor permanently deleted"}
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot hard delete doctor due to remaining references: {str(e)}")
    else:
        user.is_active = False
        await session.commit()
        return {"detail": "Doctor deactivated successfully"}

from app.schemas.admin import PatientCreate, PatientResponse

@router.post("/patients", response_model=PatientResponse, status_code=status.HTTP_201_CREATED)
async def create_patient(
    patient_in: PatientCreate,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(User).where(User.email == patient_in.email)
    if (await session.execute(stmt)).scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=patient_in.email,
        hashed_password=hash_password(patient_in.password),
        full_name=patient_in.full_name,
        role=UserRole.patient,
        phone=patient_in.phone
    )
    session.add(new_user)
    await session.commit()
    return new_user

@router.get("/patients", response_model=List[PatientResponse])
async def list_patients(
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(User).where(User.role == UserRole.patient)
    result = await session.execute(stmt)
    return result.scalars().all()

@router.delete("/patients/{user_id}")
async def delete_patient(
    user_id: UUID,
    hard_delete: bool = False,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    from sqlalchemy.exc import IntegrityError
    from sqlalchemy import delete
    from app.db.models.prescription import Prescription
    from app.db.models.symptom_form import SymptomForm
    from app.db.models.visit_note import VisitNote
    
    stmt = select(User).where(User.id == user_id, User.role == UserRole.patient)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if hard_delete:
        try:
            # 1. Get all patient appointments
            appts_stmt = select(Appointment.id).where(Appointment.patient_id == user_id)
            appt_ids = (await session.execute(appts_stmt)).scalars().all()
            
            if appt_ids:
                # 2. Delete related records
                await session.execute(delete(Prescription).where(Prescription.appointment_id.in_(appt_ids)))
                await session.execute(delete(SymptomForm).where(SymptomForm.appointment_id.in_(appt_ids)))
                await session.execute(delete(VisitNote).where(VisitNote.appointment_id.in_(appt_ids)))
                await session.execute(delete(Notification).where(Notification.appointment_id.in_(appt_ids)))
            
            # 3. Delete Patient specific notifications
            await session.execute(delete(Notification).where(Notification.user_id == user_id))
            
            # 4. Delete appointments
            if appt_ids:
                await session.execute(delete(Appointment).where(Appointment.patient_id == user_id))
                
            # 5. Delete user
            await session.delete(user)
            await session.commit()
            return {"detail": "Patient permanently deleted"}
        except IntegrityError as e:
            await session.rollback()
            raise HTTPException(status_code=400, detail=f"Cannot hard delete patient due to remaining references: {str(e)}")
    else:
        user.is_active = False
        await session.commit()
        return {"detail": "Patient deactivated successfully"}

from app.schemas.patient import AppointmentResponse

@router.get("/appointments", response_model=List[AppointmentResponse])
async def list_all_appointments(
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(Appointment).order_by(Appointment.slot_start.desc())
    appts = (await session.execute(stmt)).scalars().all()
    return appts

@router.delete("/appointments/{appointment_id}")
async def admin_cancel_appointment(
    appointment_id: UUID,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    appt = (await session.execute(stmt)).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    appt.status = AppointmentStatus.cancelled
    appt.cancellation_reason = "Cancelled by Admin"
    await session.commit()
    return {"detail": "Slot/Appointment cancelled"}

from pydantic import BaseModel, EmailStr, Field
from typing import Optional

class PatientUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    full_name: Optional[str] = None
    phone: Optional[str] = None
    is_active: Optional[bool] = None

@router.put("/patients/{user_id}", response_model=PatientResponse)
async def update_patient(
    user_id: UUID,
    patient_in: PatientUpdate,
    session: AsyncSession = Depends(get_session),
    _ = AdminRequired,
):
    stmt = select(User).where(User.id == user_id, User.role == UserRole.patient)
    user = (await session.execute(stmt)).scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Patient not found")
        
    if patient_in.email: user.email = patient_in.email
    if patient_in.password: user.hashed_password = hash_password(patient_in.password)
    if patient_in.full_name: user.full_name = patient_in.full_name
    if patient_in.phone: user.phone = patient_in.phone
    if patient_in.is_active is not None: user.is_active = patient_in.is_active
    
    await session.commit()
    return user

from app.db.models.notification import Notification
from app.db.models.doctor_leave import DoctorLeave
from sqlalchemy.orm import joinedload

@router.get("/notifications")
async def list_notifications(session: AsyncSession = Depends(get_session), _ = AdminRequired):
    stmt = select(Notification).order_by(Notification.created_at.desc())
    return (await session.execute(stmt)).scalars().all()

@router.get("/leaves")
async def list_leaves(session: AsyncSession = Depends(get_session), _ = AdminRequired):
    stmt = select(DoctorLeave).options(joinedload(DoctorLeave.doctor)).order_by(DoctorLeave.leave_date.desc())
    return (await session.execute(stmt)).scalars().all()




