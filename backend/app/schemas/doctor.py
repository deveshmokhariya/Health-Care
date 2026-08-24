from pydantic import BaseModel, Field
from typing import List, Optional
from uuid import UUID
from datetime import datetime

class VisitNoteCreate(BaseModel):
    raw_notes: str = Field(..., description="Doctor's raw consultation notes")

class PrescriptionItem(BaseModel):
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str] = None
    reminder_enabled: bool = True

class VisitNoteResponse(BaseModel):
    id: UUID
    appointment_id: UUID
    doctor_id: UUID
    raw_notes: str
    llm_patient_summary: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class PrescriptionResponse(BaseModel):
    id: UUID
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class VisitCompleteResponse(BaseModel):
    visit_note: VisitNoteResponse
    prescriptions: List[PrescriptionResponse]

class SymptomFormResponse(BaseModel):
    symptoms: str
    duration_days: Optional[int]
    severity: Optional[int]
    llm_urgency_level: Optional[str]
    llm_summary: Optional[str]

    class Config:
        from_attributes = True

class PatientBasicResponse(BaseModel):
    id: UUID
    full_name: str
    email: str

    class Config:
        from_attributes = True

class DoctorAppointmentResponse(BaseModel):
    id: UUID
    patient_id: UUID
    doctor_id: UUID
    slot_start: datetime
    slot_end: datetime
    status: str
    patient: Optional[PatientBasicResponse] = None
    symptom_form: Optional[SymptomFormResponse] = None
    visit_note: Optional[VisitNoteResponse] = None

    class Config:
        from_attributes = True
