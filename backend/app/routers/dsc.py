from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.dsc_key import DscKeyCreate, DscKeyRead, DscKeyStatus, DscKeyUpdate
from app.services import dsc_key_service

router = APIRouter(prefix="/api/dsc", tags=["dsc"])


@router.get("")
async def list_dsc_keys(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    client_id: UUID | None = Query(default=None),
    status: DscKeyStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await dsc_key_service.list_dsc_keys(
        session, page, page_size, client_id, status, search
    )
    return paginated(
        [DscKeyRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_dsc_key(
    payload: DscKeyCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    dsc_key = await dsc_key_service.create_dsc_key(session, current_user, payload)
    return ok(DscKeyRead.model_validate(dsc_key))


@router.get("/{dsc_key_id}")
async def get_dsc_key(
    dsc_key_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    dsc_key = await dsc_key_service.get_dsc_key(session, dsc_key_id)
    return ok(DscKeyRead.model_validate(dsc_key))


@router.patch("/{dsc_key_id}")
async def update_dsc_key(
    dsc_key_id: UUID,
    payload: DscKeyUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    dsc_key = await dsc_key_service.update_dsc_key(session, current_user, dsc_key_id, payload)
    return ok(DscKeyRead.model_validate(dsc_key))


@router.delete("/{dsc_key_id}")
async def delete_dsc_key(
    dsc_key_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    await dsc_key_service.delete_dsc_key(session, current_user, dsc_key_id)
    return ok({"id": str(dsc_key_id), "deleted": True})
