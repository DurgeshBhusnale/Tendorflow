from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.common import ok
from app.schemas.user import UserOption
from app.services import user_service

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("")
async def list_user_directory(
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """Names for the "Added/Updated By" filter, readable by any role (CH-37).

    Account management stays under /api/admin/users. This exposes only the
    names the tables already print beside every row, so an employee can
    filter by them too.
    """
    users = await user_service.list_user_directory(session)
    return ok([UserOption.model_validate(u) for u in users])
