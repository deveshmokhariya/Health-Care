import uuid
import enum
from sqlalchemy import Column, String, DateTime, ForeignKey, Enum as SAEnum, text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class CalendarSyncStatus(str, enum.Enum):
    pending = "pending"
    synced = "synced"
    failed = "failed"


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    google_event_id = Column(String(255), nullable=True)
    google_calendar_id = Column(String(255), nullable=True)
    sync_status = Column(SAEnum(CalendarSyncStatus, name="calendarsyncstatus"), nullable=False, default=CalendarSyncStatus.pending)
    last_synced_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    appointment = relationship("Appointment", back_populates="calendar_event")
    user = relationship("User", back_populates="calendar_events")
