from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.portal import Portal
from app.models.user import User
from app.schemas.portal import PortalCreate, PortalUpdate


async def _assert_name_available(
    session: AsyncSession, name: str, exclude_id: UUID | None = None
) -> None:
    query = select(Portal).where(Portal.name == name)
    if exclude_id is not None:
        query = query.where(Portal.id != exclude_id)
    if await session.scalar(query) is not None:
        raise ConflictError(code="PORTAL_EXISTS", message="A portal with this name already exists.")


async def list_portals(session: AsyncSession, active_only: bool = False) -> list[Portal]:
    query = select(Portal)
    if active_only:
        query = query.where(Portal.is_active.is_(True))
    return list((await session.scalars(query.order_by(Portal.name))).all())


async def create_portal(session: AsyncSession, current_user: User, payload: PortalCreate) -> Portal:
    await _assert_name_available(session, payload.name)

    portal = Portal(name=payload.name, created_by=current_user.id)
    session.add(portal)
    await session.commit()
    await session.refresh(portal)
    return portal


async def update_portal(session: AsyncSession, portal_id: UUID, payload: PortalUpdate) -> Portal:
    portal = await session.get(Portal, portal_id)
    if portal is None:
        raise NotFoundError(code="NOT_FOUND", message="Portal not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != portal.name:
        await _assert_name_available(session, data["name"], exclude_id=portal_id)

    for field, value in data.items():
        setattr(portal, field, value)

    await session.commit()
    await session.refresh(portal)
    return portal
