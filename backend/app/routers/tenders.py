from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.tender import TenderCreate, TenderRead, TenderStatus, TenderUpdate
from app.services import tender_service

router = APIRouter(prefix="/api/tenders", tags=["tenders"])


@router.get("")
async def list_tenders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    client_id: UUID | None = Query(default=None),
    status: TenderStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await tender_service.list_tenders(
        session, page, page_size, client_id, status, search
    )
    return paginated(
        [TenderRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.get("/summary")
async def summarize_tenders(
    client_id: UUID | None = Query(default=None),
    status: TenderStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    summary = await tender_service.summarize_tenders(session, client_id, status, search)
    return ok(summary)


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_tender(
    payload: TenderCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    tender = await tender_service.create_tender(session, current_user, payload)
    return ok(TenderRead.model_validate(tender))


@router.get("/{tender_id}")
async def get_tender(
    tender_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    tender = await tender_service.get_tender(session, tender_id)
    return ok(TenderRead.model_validate(tender))


@router.patch("/{tender_id}")
async def update_tender(
    tender_id: UUID,
    payload: TenderUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    tender = await tender_service.update_tender(session, current_user, tender_id, payload)
    return ok(TenderRead.model_validate(tender))


@router.delete("/{tender_id}")
async def delete_tender(
    tender_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    await tender_service.delete_tender(session, current_user, tender_id)
    return ok({"id": str(tender_id), "deleted": True})
