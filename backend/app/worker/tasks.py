import logging

logger = logging.getLogger(__name__)

# In a real application, this would use Celery:
# from celery import Celery
# celery_app = Celery('tasks', broker='redis://localhost:6379/0')
# @celery_app.task
def send_email_notification(email: str, subject: str, body: str):
    """
    Mock Celery Task for Step 6: Email Notification System.
    This simulates sending an email via SendGrid asynchronously.
    """
    logger.info(f"[BACKGROUND JOB] Sending email to {email}")
    logger.info(f"Subject: {subject}")
    logger.info(f"Body: {body}")
    logger.info("[BACKGROUND JOB] Email sent successfully.")

def sync_calendar_event(user_id: str, event_details: dict):
    """
    Mock Celery Task for Step 7: Google Calendar Integration.
    This simulates syncing an appointment to Google Calendar via OAuth.
    """
    logger.info(f"[BACKGROUND JOB] Syncing calendar event for user {user_id}")
    logger.info(f"Event Details: {event_details}")
    logger.info("[BACKGROUND JOB] Calendar synced successfully.")

def schedule_reminders(prescription_id: str):
    """
    Mock Celery Task for Step 8: Background Job System (Medication Reminders).
    """
    logger.info(f"[BACKGROUND JOB] Scheduling medication reminders for prescription {prescription_id}")
    logger.info("[BACKGROUND JOB] Reminders scheduled successfully.")
