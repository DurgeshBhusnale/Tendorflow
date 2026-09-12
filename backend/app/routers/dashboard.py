from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.common import ok
from app.services import dashboard_service

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    summary = await dashboard_service.get_dashboard_summary(session, current_user)
    return ok(summary)
