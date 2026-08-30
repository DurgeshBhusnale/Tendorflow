from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok
from app.schemas.portal import PortalCreate, PortalRead, PortalUpdate
from app.services import portal_service

router = APIRouter(prefix="/api/portals", tags=["portals"])


@router.get("")
async def list_portals(
    active_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    portals = await portal_service.list_portals(session, active_only)
    return ok([PortalRead.model_validate(p) for p in portals])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_portal(
    payload: PortalCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    portal = await portal_service.create_portal(session, current_user, payload)
    return ok(PortalRead.model_validate(portal))


@router.patch("/{portal_id}")
async def update_portal(
    portal_id: UUID,
    payload: PortalUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    portal = await portal_service.update_portal(session, portal_id, payload)
    return ok(PortalRead.model_validate(portal))
