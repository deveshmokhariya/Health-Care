from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from uuid import UUID

from app.db.session import get_session
from app.db.models.symptom_form import SymptomForm
from app.db.models.appointment import Appointment
from app.schemas.symptom import SymptomFormCreate, SymptomFormResponse
from app.core.dependencies import get_current_user
from app.db.models.user import User
from app.core.llm import parse_symptoms

router = APIRouter()

@router.post("/{appointment_id}", response_model=SymptomFormResponse, status_code=status.HTTP_201_CREATED)
async def submit_symptoms(
    appointment_id: UUID,
    body: SymptomFormCreate,
    db: AsyncSession = Depends(get_session),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "patient":
        raise HTTPException(status_code=403, detail="Only patients can submit symptom forms")

    # Verify appointment belongs to patient
    stmt = select(Appointment).where(Appointment.id == appointment_id, Appointment.patient_id == current_user.id)
    result = await db.execute(stmt)
    appointment = result.scalars().first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    # Check if form already exists
    stmt = select(SymptomForm).where(SymptomForm.appointment_id == appointment_id)
    result = await db.execute(stmt)
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Symptom form already submitted for this appointment")
        
    # Process via LLM Mock
    llm_result = parse_symptoms(body.symptoms, body.severity)
    
    new_form = SymptomForm(
        appointment_id=appointment_id,
        patient_id=current_user.id,
        symptoms=body.symptoms,
        duration_days=body.duration_days,
        severity=body.severity,
        llm_urgency_level=llm_result["llm_urgency_level"],
        llm_summary=llm_result["llm_summary"]
    )
    
    db.add(new_form)
    await db.commit()
    await db.refresh(new_form)
    return new_form
