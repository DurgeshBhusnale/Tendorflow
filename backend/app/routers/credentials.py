from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.credential import (
    CredentialCreate,
    CredentialUpdate,
    serialize_credential,
)
from app.services import credential_service

router = APIRouter(prefix="/api/credentials", tags=["credentials"])


@router.get("")
async def list_credentials(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    client_id: UUID | None = Query(default=None),
    portal_id: UUID | None = Query(default=None),
    search: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    items, total_count = await credential_service.list_credentials(
        session, page, page_size, client_id, portal_id, search
    )
    # Passwords are never revealed in bulk — only via the single-row endpoint.
    return paginated([serialize_credential(item) for item in items], total_count, page, page_size)


@router.get("/{credential_id}")
async def get_credential(
    credential_id: UUID,
    reveal: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    credential = await credential_service.get_credential(session, credential_id)
    return ok(serialize_credential(credential, reveal=reveal))


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_credential(
    payload: CredentialCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    credential = await credential_service.create_credential(session, current_user, payload)
    return ok(serialize_credential(credential))


@router.patch("/{credential_id}")
async def update_credential(
    credential_id: UUID,
    payload: CredentialUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    credential = await credential_service.update_credential(
        session, current_user, credential_id, payload
    )
    return ok(serialize_credential(credential))


@router.delete("/{credential_id}")
async def delete_credential(
    credential_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    await credential_service.delete_credential(session, credential_id)
    return ok({"id": str(credential_id), "deleted": True})
