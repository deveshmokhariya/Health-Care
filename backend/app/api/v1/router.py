from fastapi import APIRouter
from app.api.v1.endpoints import health, auth, admin, patient, symptom, doctor

router = APIRouter(prefix="/api/v1")
router.include_router(health.router)
router.include_router(auth.router)
router.include_router(admin.router, prefix="/admin", tags=["admin"])
router.include_router(patient.router, prefix="/patient", tags=["patient"])
router.include_router(symptom.router, prefix="/symptom", tags=["symptom"])
router.include_router(doctor.router, prefix="/doctor", tags=["doctor"])

