from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok
from app.schemas.tender_name import TenderNameCreate, TenderNameRead, TenderNameUpdate
from app.services import tender_name_service

router = APIRouter(prefix="/api/tender-names", tags=["tender-names"])


@router.get("")
async def list_tender_names(
    active_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    tender_names = await tender_name_service.list_tender_names(session, active_only)
    return ok([TenderNameRead.model_validate(t) for t in tender_names])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tender_name(
    payload: TenderNameCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    tender_name = await tender_name_service.create_tender_name(session, current_user, payload)
    return ok(TenderNameRead.model_validate(tender_name))


@router.patch("/{tender_name_id}")
async def update_tender_name(
    tender_name_id: UUID,
    payload: TenderNameUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    tender_name = await tender_name_service.update_tender_name(session, tender_name_id, payload)
    return ok(TenderNameRead.model_validate(tender_name))
