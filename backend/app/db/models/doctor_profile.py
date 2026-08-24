import uuid
from sqlalchemy import (
    Column, String, Integer, Time, DateTime, ForeignKey, Text, ARRAY, text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="RESTRICT"), unique=True, nullable=False, index=True)
    specialisation = Column(String(100), nullable=False, index=True)
    qualification = Column(Text, nullable=True)
    bio = Column(Text, nullable=True)
    slot_duration_minutes = Column(Integer, nullable=False, default=30)
    working_hours_start = Column(Time, nullable=False)
    working_hours_end = Column(Time, nullable=False)
    # ISO weekdays: 1=Monday … 7=Sunday
    working_days = Column(ARRAY(Integer), nullable=False)
    max_advance_days = Column(Integer, nullable=False, default=30)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="doctor_profile")
