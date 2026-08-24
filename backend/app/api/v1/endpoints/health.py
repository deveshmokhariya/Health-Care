from fastapi import APIRouter

response = {"status": "ok", "version": "0.1.0"}

router = APIRouter()


@router.get("/health", tags=["Health"])
async def health_check():
    """Returns service health status."""
    return response
