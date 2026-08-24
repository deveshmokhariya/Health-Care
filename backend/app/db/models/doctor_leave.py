import uuid
from sqlalchemy import (
    Column, Date, DateTime, ForeignKey, Text, UniqueConstraint, text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class DoctorLeave(Base):
    __tablename__ = "doctor_leaves"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    leave_date = Column(Date, nullable=False)
    reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    __table_args__ = (
        UniqueConstraint("doctor_id", "leave_date", name="uq_doctor_leaves_doctor_date"),
    )

    # Relationships
    doctor = relationship("User", back_populates="doctor_leaves", foreign_keys=[doctor_id])
