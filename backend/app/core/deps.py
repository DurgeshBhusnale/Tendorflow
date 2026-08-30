from collections.abc import AsyncGenerator
from uuid import UUID

from fastapi import Depends, Header
from jose import ExpiredSignatureError, JWTError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import decode_token
from app.core.exceptions import ForbiddenError, UnauthorizedError
from app.database import async_session_maker
from app.models.user import User


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session


async def get_current_user(
    authorization: str | None = Header(default=None),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    if not authorization or not authorization.startswith("Bearer "):
        raise UnauthorizedError(
            code="UNAUTHENTICATED", message="Missing or invalid Authorization header."
        )

    token = authorization.removeprefix("Bearer ")
    try:
        payload = decode_token(token)
    except ExpiredSignatureError as exc:
        raise UnauthorizedError(code="TOKEN_EXPIRED", message="Access token has expired.") from exc
    except JWTError as exc:
        raise UnauthorizedError(code="UNAUTHENTICATED", message="Invalid token.") from exc

    if payload.get("type") != "access":
        raise UnauthorizedError(code="UNAUTHENTICATED", message="Invalid token type.")

    user = await session.get(User, UUID(payload["sub"]))
    if user is None or not user.is_active:
        raise UnauthorizedError(code="UNAUTHENTICATED", message="User not found or inactive.")
    return user


async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="Admin access required.")
    return current_user
