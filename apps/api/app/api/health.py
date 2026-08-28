from fastapi import APIRouter

from app.services.clock import now_ms

router = APIRouter(tags=["health"])


@router.get("/api/health")
def health() -> dict:
    return {"status": "ok", "serverTime": now_ms()}
