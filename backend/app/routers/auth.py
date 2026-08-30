from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session
from app.models.user import User
from app.schemas.auth import AuthUser, LoginRequest, MeResponse, RefreshRequest
from app.schemas.common import ok
from app.services import auth_service

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
async def login(
    payload: LoginRequest,
    session: AsyncSession = Depends(get_db_session),
):
    access_token, refresh_token, user = await auth_service.login(session, payload)
    return ok(
        {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "user": AuthUser.model_validate(user),
        }
    )


@router.post("/refresh")
async def refresh(
    payload: RefreshRequest,
    session: AsyncSession = Depends(get_db_session),
):
    access_token = await auth_service.refresh_access_token(session, payload.refresh_token)
    return ok({"access_token": access_token})


@router.post("/logout")
async def logout(current_user: User = Depends(get_current_user)):
    return ok({"logged_out": True})


@router.get("/me")
async def me(current_user: User = Depends(get_current_user)):
    return ok(MeResponse.model_validate(current_user))
