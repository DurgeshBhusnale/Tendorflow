from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.user import UserCreate, UserRead, UserUpdate
from app.services import user_service

router = APIRouter(prefix="/api/admin/users", tags=["admin-users"])


@router.get("")
async def list_users(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    search: str | None = Query(default=None),
    role: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    items, total_count = await user_service.list_users(session, page, page_size, search, role)
    return paginated(
        [UserRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    user = await user_service.create_user(session, payload)
    return ok(UserRead.model_validate(user))


@router.patch("/{user_id}")
async def update_user(
    user_id: UUID,
    payload: UserUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    user = await user_service.update_user(session, user_id, payload)
    return ok(UserRead.model_validate(user))


@router.delete("/{user_id}")
async def delete_user(
    user_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    await user_service.delete_user(session, current_user, user_id)
    return ok({"id": str(user_id), "deleted": True})
