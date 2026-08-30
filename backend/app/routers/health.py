from datetime import UTC, datetime

from fastapi import APIRouter

from app.schemas.common import ok

router = APIRouter(prefix="/api/health", tags=["health"])


@router.get("")
async def health_check():
    return ok({"status": "ok", "timestamp": datetime.now(UTC).isoformat()})
