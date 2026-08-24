from pydantic import BaseModel, EmailStr, Field
from typing import List, Optional
from datetime import date, time, datetime
from uuid import UUID
from app.db.models.user import UserRole

class DoctorCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None
    specialisation: str
    qualification: Optional[str] = None
    bio: Optional[str] = None
    working_days: List[int] = Field(..., description="1=Monday, 7=Sunday")
    working_hours_start: time
    working_hours_end: time
    slot_duration_minutes: int = 30
    max_advance_days: int = 30

class DoctorUpdate(BaseModel):
    email: Optional[EmailStr] = None
    password: Optional[str] = Field(None, min_length=8)
    specialisation: Optional[str] = None
    qualification: Optional[str] = None
    bio: Optional[str] = None
    working_days: Optional[List[int]] = None
    working_hours_start: Optional[time] = None
    working_hours_end: Optional[time] = None
    slot_duration_minutes: Optional[int] = None
    is_active: Optional[bool] = None

class DoctorResponse(BaseModel):
    id: UUID
    user_id: UUID
    full_name: str
    email: EmailStr
    specialisation: str
    working_days: List[int]
    working_hours_start: time
    working_hours_end: time
    slot_duration_minutes: int
    is_active: bool

    model_config = {"from_attributes": True}

class LeaveCreate(BaseModel):
    leave_date: date
    reason: Optional[str] = None

class LeaveResponse(BaseModel):
    id: UUID
    doctor_id: UUID
    leave_date: date
    reason: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}

class ConflictResponse(BaseModel):
    cancelled_appointments: int

class PatientCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str
    phone: Optional[str] = None

class PatientResponse(BaseModel):
    id: UUID
    full_name: str
    email: EmailStr
    phone: Optional[str]
    is_active: bool

    model_config = {"from_attributes": True}
