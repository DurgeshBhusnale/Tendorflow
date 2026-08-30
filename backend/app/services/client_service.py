from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, ForbiddenError, NotFoundError
from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate


def _assert_can_modify(client: Client, current_user: User) -> None:
    if client.created_by != current_user.id and current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="You can only edit clients you created.")


async def _assert_email_available(
    session: AsyncSession, email: str, exclude_id: UUID | None = None
) -> None:
    query = select(Client).where(Client.email == email)
    if exclude_id is not None:
        query = query.where(Client.id != exclude_id)
    if await session.scalar(query) is not None:
        raise ConflictError(
            code="EMAIL_EXISTS",
            message="This email is already onboarded to another client.",
        )


async def list_clients(
    session: AsyncSession,
    page: int,
    page_size: int,
    search: str | None = None,
) -> tuple[list[Client], int]:
    query = select(Client)
    count_query = select(func.count()).select_from(Client)

    if search:
        pattern = f"%{search}%"
        condition = or_(
            Client.contact_person_name.ilike(pattern),
            Client.company_name.ilike(pattern),
            Client.email.ilike(pattern),
        )
        query = query.where(condition)
        count_query = count_query.where(condition)

    total_count = await session.scalar(count_query)
    query = query.order_by(Client.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(query)).unique().all())
    return items, total_count or 0


async def get_client(session: AsyncSession, client_id: UUID) -> Client:
    client = await session.get(Client, client_id)
    if client is None:
        raise NotFoundError(code="NOT_FOUND", message="Client not found.")
    return client


async def create_client(session: AsyncSession, current_user: User, payload: ClientCreate) -> Client:
    await _assert_email_available(session, payload.email)

    client = Client(**payload.model_dump(), created_by=current_user.id)
    session.add(client)
    await session.commit()
    await session.refresh(client)
    return client


async def update_client(
    session: AsyncSession, current_user: User, client_id: UUID, payload: ClientUpdate
) -> Client:
    client = await get_client(session, client_id)
    _assert_can_modify(client, current_user)

    data = payload.model_dump(exclude_unset=True)
    if "email" in data and data["email"] != client.email:
        await _assert_email_available(session, data["email"], exclude_id=client_id)

    for field, value in data.items():
        setattr(client, field, value)

    await session.commit()
    await session.refresh(client)
    return client


async def delete_client(session: AsyncSession, current_user: User, client_id: UUID) -> None:
    client = await get_client(session, client_id)
    _assert_can_modify(client, current_user)

    await session.delete(client)
    await session.commit()
