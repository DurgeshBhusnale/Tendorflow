from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.emd import EmdBulkDelete, EmdCreate, EmdRead, EmdStatus, EmdUpdate
from app.services import emd_service

# Readable and writable by any signed-in user, like tenders (CH-19): whoever
# takes a deposit or hands it back records it. Only deletion is admin-gated.
router = APIRouter(prefix="/api/emds", tags=["emds"])


@router.get("")
async def list_emds(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status: EmdStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await emd_service.list_emds(
        session, page, page_size, status, search, start_date, end_date
    )
    return paginated([EmdRead.model_validate(item) for item in items], total_count, page, page_size)


@router.get("/summary")
async def summarize_emds(
    status: EmdStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Not admin-gated, unlike the tender summary.

    These are deposits held on a client's behalf rather than the business's own
    revenue, and the people handling them need to see what is outstanding.
    """
    summary = await emd_service.summarize_emds(session, status, search, start_date, end_date)
    return ok(summary)


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_emd(
    payload: EmdCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    emd = await emd_service.create_emd(session, current_user, payload)
    return ok(EmdRead.model_validate(emd))


@router.post("/bulk-delete")
async def bulk_delete_emds(
    payload: EmdBulkDelete,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    """Admin-only (CH-34), mirroring the tenders bulk delete.

    A POST rather than a DELETE because the ids travel in a body, which
    DELETE is not reliably allowed to carry.
    """
    deleted = await emd_service.bulk_delete_emds(session, payload.ids)
    return ok({"deleted": deleted, "requested": len(payload.ids)})


@router.get("/{emd_id}")
async def get_emd(
    emd_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    emd = await emd_service.get_emd(session, emd_id)
    return ok(EmdRead.model_validate(emd))


@router.patch("/{emd_id}")
async def update_emd(
    emd_id: UUID,
    payload: EmdUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    emd = await emd_service.update_emd(session, current_user, emd_id, payload)
    return ok(EmdRead.model_validate(emd))


@router.delete("/{emd_id}")
async def delete_emd(
    emd_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    await emd_service.delete_emd(session, emd_id)
    return ok({"id": str(emd_id), "deleted": True})
