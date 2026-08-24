from pydantic import BaseModel, Field
from typing import Optional
from uuid import UUID
from datetime import datetime

class SymptomFormCreate(BaseModel):
    symptoms: str = Field(..., description="Description of the symptoms")
    duration_days: int = Field(..., ge=1, le=365)
    severity: int = Field(..., ge=1, le=10)

class SymptomFormResponse(BaseModel):
    id: UUID
    appointment_id: UUID
    patient_id: UUID
    symptoms: str
    duration_days: int
    severity: int
    llm_urgency_level: Optional[str] = None
    llm_summary: Optional[str] = None
    submitted_at: datetime

    class Config:
        from_attributes = True
