# Import all models here so Alembic autogenerate picks them up
from app.db.base import Base  # noqa: F401
from app.db.models.user import User  # noqa: F401
from app.db.models.doctor_profile import DoctorProfile  # noqa: F401
from app.db.models.doctor_leave import DoctorLeave  # noqa: F401
from app.db.models.appointment import Appointment  # noqa: F401
from app.db.models.symptom_form import SymptomForm  # noqa: F401
from app.db.models.visit_note import VisitNote  # noqa: F401
from app.db.models.prescription import Prescription  # noqa: F401
from app.db.models.notification import Notification  # noqa: F401
from app.db.models.calendar_event import CalendarEvent  # noqa: F401
