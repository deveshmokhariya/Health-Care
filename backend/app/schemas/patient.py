from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime
from uuid import UUID
from app.schemas.admin import DoctorResponse
from app.services.slot_service import SlotInfo

class DoctorSearchResponse(BaseModel):
    doctor: DoctorResponse
    available_slots: List[SlotInfo]
    
class HoldSlotRequest(BaseModel):
    doctor_id: UUID
    slot_start: datetime

class HoldSlotResponse(BaseModel):
    appointment_id: UUID
    expires_at: datetime
    slot_start: datetime
    slot_end: datetime

class ConfirmBookingRequest(BaseModel):
    symptoms: str = Field(min_length=2, description="Brief description of symptoms")
    duration_days: Optional[int] = Field(None, ge=1)
    severity: Optional[int] = Field(None, ge=1, le=10)

class RescheduleRequest(BaseModel):
    new_slot_start: datetime

class CancelRequest(BaseModel):
    reason: Optional[str] = None

class AppointmentResponse(BaseModel):
    id: UUID
    doctor_id: UUID
    patient_id: UUID
    slot_start: datetime
    slot_end: datetime
    status: str
    created_at: datetime

    model_config = {"from_attributes": True, "use_enum_values": True}

class DoctorBasicInfo(BaseModel):
    id: UUID
    full_name: str
    model_config = {"from_attributes": True}

class PrescriptionResponse(BaseModel):
    id: UUID
    medication_name: str
    dosage: str
    frequency: str
    duration_days: int
    instructions: Optional[str]
    model_config = {"from_attributes": True}

class VisitNoteResponse(BaseModel):
    id: UUID
    llm_patient_summary: Optional[str] = None
    prescriptions: List[PrescriptionResponse] = []
    model_config = {"from_attributes": True}

class PatientSymptomFormResponse(BaseModel):
    symptoms: str
    model_config = {"from_attributes": True}

class PatientDetailedAppointmentResponse(AppointmentResponse):
    doctor: Optional[DoctorBasicInfo] = None
    visit_note: Optional[VisitNoteResponse] = None
    symptom_form: Optional[PatientSymptomFormResponse] = None
    model_config = {"from_attributes": True}
