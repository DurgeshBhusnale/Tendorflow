from uuid import UUID

from jose import ExpiredSignatureError, JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    verify_password,
)
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.models.user import User
from app.schemas.auth import LoginRequest


async def login(session: AsyncSession, payload: LoginRequest) -> tuple[str, str, User]:
    # Usernames are stored case-folded (schemas/validators.normalize_username),
    # so the lookup folds too and 'Asha' signs in as 'asha'.
    username = payload.username.strip().lower()
    user = await session.scalar(select(User).where(User.username == username))
    if user is None or not verify_password(payload.password, user.password_hash):
        raise UnauthorizedError(code="INVALID_CREDENTIALS", message="Invalid username or password.")
    if not user.is_active:
        raise ForbiddenError(code="ACCOUNT_INACTIVE", message="This account has been deactivated.")

    access_token = create_access_token(user.id)
    refresh_token = create_refresh_token(user.id)
    return access_token, refresh_token, user


async def refresh_access_token(session: AsyncSession, refresh_token: str) -> str:
    try:
        payload = decode_token(refresh_token)
    except ExpiredSignatureError as exc:
        raise UnauthorizedError(code="TOKEN_EXPIRED", message="Refresh token has expired.") from exc
    except JWTError as exc:
        raise UnauthorizedError(
            code="INVALID_REFRESH_TOKEN", message="Invalid refresh token."
        ) from exc

    if payload.get("type") != "refresh":
        raise UnauthorizedError(code="INVALID_REFRESH_TOKEN", message="Invalid refresh token.")

    user = await session.get(User, UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError(code="INVALID_REFRESH_TOKEN", message="Invalid refresh token.")

    return create_access_token(user.id)
