from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead, ClientUpdate
from app.schemas.common import ok, paginated
from app.services import client_service

router = APIRouter(prefix="/api/clients", tags=["clients"])


@router.get("")
async def list_clients(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await client_service.list_clients(session, page, page_size, search)
    return paginated(
        [ClientRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    client = await client_service.create_client(session, current_user, payload)
    return ok(ClientRead.model_validate(client))


@router.get("/{client_id}")
async def get_client(
    client_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    client = await client_service.get_client(session, client_id)
    return ok(ClientRead.model_validate(client))


@router.patch("/{client_id}")
async def update_client(
    client_id: UUID,
    payload: ClientUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    client = await client_service.update_client(session, current_user, client_id, payload)
    return ok(ClientRead.model_validate(client))


@router.delete("/{client_id}")
async def delete_client(
    client_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    await client_service.delete_client(session, client_id)
    return ok({"id": str(client_id), "deleted": True})
