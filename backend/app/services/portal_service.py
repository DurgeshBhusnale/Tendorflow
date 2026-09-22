from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.credential import Credential
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


async def _get_portal(session: AsyncSession, portal_id: UUID) -> Portal:
    portal = await session.get(Portal, portal_id)
    if portal is None:
        raise NotFoundError(code="NOT_FOUND", message="Portal not found.")
    return portal


async def update_portal(session: AsyncSession, portal_id: UUID, payload: PortalUpdate) -> Portal:
    portal = await _get_portal(session, portal_id)

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != portal.name:
        await _assert_name_available(session, data["name"], exclude_id=portal_id)

    for field, value in data.items():
        setattr(portal, field, value)

    await session.commit()
    await session.refresh(portal)
    return portal


async def delete_portal(session: AsyncSession, portal_id: UUID) -> None:
    """Hard-delete a portal nothing references (CH-21). Admin-only at the router.

    `credentials.portal_id` is ON DELETE RESTRICT, so a portal in use could not
    be deleted anyway — checking first turns what would be a raw integrity error
    into a message that tells the admin what to do instead.
    """
    portal = await _get_portal(session, portal_id)

    in_use = await session.scalar(
        select(func.count()).select_from(Credential).where(Credential.portal_id == portal_id)
    )
    if in_use:
        raise ConflictError(
            code="PORTAL_IN_USE",
            message=(
                f"This portal is used by {in_use} saved credential(s), so it can't be "
                "deleted. Deactivate it instead."
            ),
        )

    await session.delete(portal)
    await session.commit()
