import uuid
import enum
from sqlalchemy import (
    Column, String, Integer, DateTime, ForeignKey, Text,
    Enum as SAEnum, text, func
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.db.base import Base


class NotificationType(str, enum.Enum):
    booking_confirmation = "booking_confirmation"
    reminder = "reminder"
    cancellation = "cancellation"
    leave_alert = "leave_alert"
    leave_conflict = "leave_conflict"
    llm_summary = "llm_summary"


class NotificationChannel(str, enum.Enum):
    email = "email"
    sms = "sms"
    push = "push"


class NotificationStatus(str, enum.Enum):
    pending = "pending"
    sent = "sent"
    failed = "failed"


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, server_default=text("gen_random_uuid()"))
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    appointment_id = Column(UUID(as_uuid=True), ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True, index=True)
    type = Column(SAEnum(NotificationType, name="notificationtype"), nullable=False)
    channel = Column(SAEnum(NotificationChannel, name="notificationchannel"), nullable=False, default=NotificationChannel.email)
    subject = Column(String(255), nullable=True)
    body = Column(Text, nullable=False)
    status = Column(SAEnum(NotificationStatus, name="notificationstatus"), nullable=False, default=NotificationStatus.pending, index=True)
    retry_count = Column(Integer, default=0, nullable=False)
    max_retries = Column(Integer, default=3, nullable=False)
    scheduled_at = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    appointment = relationship("Appointment", back_populates="notifications")
