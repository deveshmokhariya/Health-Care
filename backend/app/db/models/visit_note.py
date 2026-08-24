import uuid
from sqlalchemy import Column, DateTime, ForeignKey, Text, text, func
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from app.db.base import Base


class VisitNote(Base):
    __tablename__ = "visit_notes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    raw_notes = Column(Text, nullable=False)
    llm_patient_summary = Column(Text, nullable=True)
    # Structured schedule: [{"medication": str, "dose": str, "frequency": str, "days": int}]
    llm_medication_schedule = Column(JSONB, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    appointment = relationship("Appointment", back_populates="visit_note")
    prescriptions = relationship("Prescription", back_populates="visit_note")
