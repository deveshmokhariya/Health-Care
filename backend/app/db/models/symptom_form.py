import uuid
import enum
from sqlalchemy import (
    Column, DateTime, ForeignKey, Text, Integer,
    Enum as SAEnum, CheckConstraint, text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class UrgencyLevel(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"
    critical = "critical"


class SymptomForm(Base):
    __tablename__ = "symptom_forms"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False)
    patient_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False, index=True)
    symptoms = Column(Text, nullable=False)
    duration_days = Column(Integer, nullable=True)
    severity = Column(Integer, nullable=True)
    llm_urgency_level = Column(SAEnum(UrgencyLevel, name="urgencylevel"), nullable=True)
    llm_summary = Column(Text, nullable=True)
    submitted_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        CheckConstraint("severity BETWEEN 1 AND 10", name="ck_symptom_forms_severity_range"),
    )

    # Relationships
    appointment = relationship("Appointment", back_populates="symptom_form")
