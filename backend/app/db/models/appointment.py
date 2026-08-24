import uuid
import enum
from sqlalchemy import (
    Column, DateTime, ForeignKey, Text, UniqueConstraint, Index,
    Enum as SAEnum, CheckConstraint, text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    held = "held"
    expired = "expired"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    slot_start = Column(DateTime(timezone=True), nullable=False)
    slot_end = Column(DateTime(timezone=True), nullable=False)
    status = Column(
        SAEnum(AppointmentStatus, name="appointmentstatus"),
        nullable=False,
        default=AppointmentStatus.pending,
        index=True,
    )
    expires_at = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Text, nullable=True)
    cancelled_by = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index(
            "uq_active_appointments", 
            "doctor_id", 
            "slot_start", 
            unique=True, 
            postgresql_where=text("status IN ('held', 'confirmed')")
        ),
        CheckConstraint("slot_end > slot_start", name="ck_appointments_slot_end_after_start"),
        CheckConstraint("patient_id != doctor_id", name="ck_appointments_patient_ne_doctor"),
    )

    # Relationships
    patient = relationship("User", back_populates="patient_appointments", foreign_keys=[patient_id])
    doctor = relationship("User", back_populates="doctor_appointments", foreign_keys=[doctor_id])
    symptom_form = relationship("SymptomForm", back_populates="appointment", uselist=False)
    visit_note = relationship("VisitNote", back_populates="appointment", uselist=False)
    notifications = relationship("Notification", back_populates="appointment")
    calendar_event = relationship("CalendarEvent", back_populates="appointment", uselist=False)
