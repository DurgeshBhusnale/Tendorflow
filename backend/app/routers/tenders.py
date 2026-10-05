from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.tender import (
    TenderBulkDelete,
    TenderCreate,
    TenderRead,
    TenderSettlement,
    TenderStatus,
    TenderUpdate,
)
from app.services import tender_service

router = APIRouter(prefix="/api/tenders", tags=["tenders"])


@router.get("")
async def list_tenders(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    client_id: UUID | None = Query(default=None),
    status: TenderStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    created_by: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await tender_service.list_tenders(
        session, page, page_size, client_id, status, search, start_date, end_date, created_by
    )
    return paginated(
        [TenderRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.get("/summary")
async def summarize_tenders(
    client_id: UUID | None = Query(default=None),
    status: TenderStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    created_by: UUID | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    """Admin-only (CH-12).

    These totals are the business's revenue and receivables. Hiding the cards
    in the UI would leave the numbers one API call away from any employee, so
    the endpoint itself is what enforces it.
    """
    summary = await tender_service.summarize_tenders(
        session, client_id, status, search, start_date, end_date, created_by
    )
    return ok(summary)


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_tender(
    payload: TenderCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    tender = await tender_service.create_tender(session, current_user, payload)
    return ok(TenderRead.model_validate(tender))


@router.get("/outstanding")
async def client_outstanding(
    client_id: UUID = Query(...),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """What one client still owes (CH-35).

    Not admin-gated, unlike `/summary`. CH-12 withheld the business's own
    revenue from employees; a single client's balance is the number the person
    taking their money needs in front of them.
    """
    outstanding = await tender_service.get_client_outstanding(session, client_id)
    return ok(outstanding)


@router.post("/settle")
async def settle_client_dues(
    payload: TenderSettlement,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Spread one payment across a client's unpaid tenders, oldest first (CH-35).

    Any signed-in user, like every other tender edit. With `preview: true` the
    same allocation is returned without being written, so the plan shown to the
    user comes from the code that carries it out rather than a second copy of
    the arithmetic in the browser.
    """
    result = await tender_service.settle_client_dues(session, current_user, payload)
    return ok(result)


@router.post("/bulk-delete")
async def bulk_delete_tenders(
    payload: TenderBulkDelete,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    """Admin-only (CH-29) — clearing out a client's finished tenders in one go.

    A POST rather than a DELETE because the ids travel in a body, which DELETE
    is not reliably allowed to carry.
    """
    deleted = await tender_service.bulk_delete_tenders(session, payload.ids)
    return ok({"deleted": deleted, "requested": len(payload.ids)})


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
    current_user: User = Depends(require_admin),
):
    await tender_service.delete_tender(session, tender_id)
    return ok({"id": str(tender_id), "deleted": True})
