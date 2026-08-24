import uuid
import enum
from sqlalchemy import (
    Column, String, Boolean, DateTime, Enum as SAEnum, func, text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    email = Column(String(255), unique=True, nullable=False, index=True)
    hashed_password = Column(String, nullable=False)
    role = Column(SAEnum(UserRole, name="userrole"), nullable=False)
    full_name = Column(String(255), nullable=False)
    phone = Column(String(20), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False)
    doctor_leaves = relationship("DoctorLeave", back_populates="doctor", foreign_keys="DoctorLeave.doctor_id")
    patient_appointments = relationship("Appointment", back_populates="patient", foreign_keys="Appointment.patient_id")
    doctor_appointments = relationship("Appointment", back_populates="doctor", foreign_keys="Appointment.doctor_id")
    notifications = relationship("Notification", back_populates="user", foreign_keys="Notification.user_id")
    calendar_events = relationship("CalendarEvent", back_populates="user")
