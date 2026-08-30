from datetime import UTC, datetime, timedelta
from uuid import UUID

from jose import jwt
from passlib.context import CryptContext

from app.config import get_settings

settings = get_settings()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ALGORITHM = "HS256"


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    return pwd_context.verify(password, password_hash)


def create_access_token(user_id: UUID) -> str:
    return _create_token(user_id, "access", timedelta(minutes=settings.JWT_ACCESS_TTL_MINUTES))


def create_refresh_token(user_id: UUID) -> str:
    return _create_token(user_id, "refresh", timedelta(days=settings.JWT_REFRESH_TTL_DAYS))


def _create_token(user_id: UUID, token_type: str, ttl: timedelta) -> str:
    now = datetime.now(UTC)
    claims = {"sub": str(user_id), "type": token_type, "iat": now, "exp": now + ttl}
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])
