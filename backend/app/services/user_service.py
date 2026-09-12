from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import hash_password
from app.core.exceptions import ConflictError, NotFoundError, ValidationError
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
        condition = or_(
            User.full_name.ilike(pattern),
            User.username.ilike(pattern),
            User.email.ilike(pattern),
        )
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
    if await session.scalar(select(User).where(User.username == payload.username)) is not None:
        raise ConflictError(
            code="USERNAME_EXISTS", message="A user with this username already exists."
        )
    if await session.scalar(select(User).where(User.email == payload.email)) is not None:
        raise ConflictError(code="EMAIL_EXISTS", message="A user with this email already exists.")

    user = User(
        full_name=payload.full_name,
        username=payload.username,
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

    if data.get("is_active") is False or data.get("role") == "employee":
        await _assert_not_last_active_admin(
            session, user, action="deactivate" if "is_active" in data else "demote"
        )

    for field, value in data.items():
        setattr(user, field, value)

    await session.commit()
    await session.refresh(user)
    return user


async def delete_user(session: AsyncSession, current_user: User, user_id: UUID) -> None:
    """Permanently remove a user (CH-01).

    A hard delete, not a deactivation. Every `created_by` foreign key is
    ON DELETE SET NULL, so the person's clients, tenders, credentials and DSC
    keys survive and simply lose their attribution — see DATABASE_SCHEMA.md 2.

    Two guards, because both mistakes lock people out of the tool permanently
    and neither is undoable from the UI.
    """
    user = await session.get(User, user_id)
    if user is None:
        raise NotFoundError(code="NOT_FOUND", message="User not found.")

    if user.id == current_user.id:
        raise ValidationError(
            code="CANNOT_DELETE_SELF",
            message="You cannot delete your own account. Ask another admin to do it.",
        )

    await _assert_not_last_active_admin(session, user, action="delete")

    await session.delete(user)
    await session.commit()


async def _assert_not_last_active_admin(session: AsyncSession, user: User, *, action: str) -> None:
    """Refuse anything that would leave the workspace with no active admin.

    Without this, deleting or demoting the wrong row leaves a tool whose admin
    pages nobody can reach and whose only fix is a database console.
    """
    if user.role != "admin" or not user.is_active:
        return

    remaining = await session.scalar(
        select(func.count())
        .select_from(User)
        .where(User.role == "admin", User.is_active.is_(True), User.id != user.id)
    )
    if not remaining:
        raise ValidationError(
            code="LAST_ADMIN",
            message=f"You cannot {action} the only active admin. Promote another admin first.",
        )
