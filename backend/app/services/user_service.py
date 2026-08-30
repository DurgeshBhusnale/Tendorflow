from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.core.exceptions import ConflictError, NotFoundError
from app.models.user import User
from app.schemas.user import UserCreate, UserUpdate


async def list_users(
    session: AsyncSession,
    page: int,
    page_size: int,
    search: str | None = None,
    role: str | None = None,
) -> tuple[list[User], int]:
    query = select(User)
    count_query = select(func.count()).select_from(User)

    if search:
        pattern = f"%{search}%"
        condition = or_(User.full_name.ilike(pattern), User.email.ilike(pattern))
        query = query.where(condition)
        count_query = count_query.where(condition)

    if role:
        query = query.where(User.role == role)
        count_query = count_query.where(User.role == role)

    total_count = await session.scalar(count_query)
    query = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(query)).all())
    return items, total_count or 0


async def create_user(session: AsyncSession, payload: UserCreate) -> User:
    existing = await session.scalar(select(User).where(User.email == payload.email))
    if existing is not None:
        raise ConflictError(code="EMAIL_EXISTS", message="A user with this email already exists.")

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=payload.role,
    )
    session.add(user)
    await session.commit()
    await session.refresh(user)
    return user


async def update_user(session: AsyncSession, user_id: UUID, payload: UserUpdate) -> User:
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError(code="NOT_FOUND", message="User not found.")

    data = payload.model_dump(exclude_unset=True)
    password = data.pop("password", None)
    if password:
        user.password_hash = hash_password(password)
    for field, value in data.items():
        setattr(user, field, value)

    await session.commit()
    await session.refresh(user)
    return user
