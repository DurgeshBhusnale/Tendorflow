from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.client import Client
from app.models.dsc_key import DscKey
from app.models.user import User
from app.schemas.dsc_key import DscKeyCreate, DscKeyUpdate


def _assert_can_modify(dsc_key: DscKey, current_user: User) -> None:
    if dsc_key.created_by != current_user.id and current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="You can only edit DSC keys you created.")


async def _assert_client_exists(session: AsyncSession, client_id: UUID | None) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")


def _eager(query):
    """See credential_service._eager — forces relationships to be re-read."""
    return query.execution_options(populate_existing=True)


async def list_dsc_keys(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[DscKey], int]:
    query = select(DscKey)
    count_query = select(func.count()).select_from(DscKey)

    if client_id is not None:
        query = query.where(DscKey.client_id == client_id)
        count_query = count_query.where(DscKey.client_id == client_id)

    if status is not None:
        query = query.where(DscKey.key_status == status)
        count_query = count_query.where(DscKey.key_status == status)

    if search:
        pattern = f"%{search}%"
        # Storage notes are searchable because locating a key by "Drawer 3" is
        # the whole point of this module (PRD 4.5).
        matching = or_(
            Client.company_name.ilike(pattern),
            DscKey.storage_location_notes.ilike(pattern),
        )
        query = query.join(Client, DscKey.client_id == Client.id).where(matching)
        count_query = count_query.join(Client, DscKey.client_id == Client.id).where(matching)

    total_count = await session.scalar(count_query)
    query = query.order_by(DscKey.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


async def get_dsc_key(session: AsyncSession, dsc_key_id: UUID) -> DscKey:
    dsc_key = await session.scalar(_eager(select(DscKey).where(DscKey.id == dsc_key_id)))
    if dsc_key is None:
        raise NotFoundError(code="NOT_FOUND", message="DSC key not found.")
    return dsc_key


async def create_dsc_key(
    session: AsyncSession, current_user: User, payload: DscKeyCreate
) -> DscKey:
    await _assert_client_exists(session, payload.client_id)

    dsc_key = DscKey(**payload.model_dump(), created_by=current_user.id)
    session.add(dsc_key)
    await session.commit()
    return await get_dsc_key(session, dsc_key.id)


async def update_dsc_key(
    session: AsyncSession, current_user: User, dsc_key_id: UUID, payload: DscKeyUpdate
) -> DscKey:
    dsc_key = await get_dsc_key(session, dsc_key_id)
    _assert_can_modify(dsc_key, current_user)

    data = payload.model_dump(exclude_unset=True)
    await _assert_client_exists(session, data.get("client_id"))

    for field, value in data.items():
        setattr(dsc_key, field, value)

    await session.commit()
    return await get_dsc_key(session, dsc_key_id)


async def delete_dsc_key(session: AsyncSession, current_user: User, dsc_key_id: UUID) -> None:
    dsc_key = await get_dsc_key(session, dsc_key_id)
    _assert_can_modify(dsc_key, current_user)

    await session.delete(dsc_key)
    await session.commit()
