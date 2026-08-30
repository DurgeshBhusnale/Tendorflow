from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.tender_name import TenderName
from app.models.user import User
from app.schemas.tender_name import TenderNameCreate, TenderNameUpdate


async def _assert_name_available(
    session: AsyncSession, name: str, exclude_id: UUID | None = None
) -> None:
    query = select(TenderName).where(TenderName.name == name)
    if exclude_id is not None:
        query = query.where(TenderName.id != exclude_id)
    if await session.scalar(query) is not None:
        raise ConflictError(
            code="TENDER_NAME_EXISTS", message="A tender name with this name already exists."
        )


async def list_tender_names(session: AsyncSession, active_only: bool = False) -> list[TenderName]:
    query = select(TenderName)
    if active_only:
        query = query.where(TenderName.is_active.is_(True))
    return list((await session.scalars(query.order_by(TenderName.name))).all())


async def create_tender_name(
    session: AsyncSession, current_user: User, payload: TenderNameCreate
) -> TenderName:
    await _assert_name_available(session, payload.name)

    tender_name = TenderName(name=payload.name, created_by=current_user.id)
    session.add(tender_name)
    await session.commit()
    await session.refresh(tender_name)
    return tender_name


async def update_tender_name(
    session: AsyncSession, tender_name_id: UUID, payload: TenderNameUpdate
) -> TenderName:
    tender_name = await session.get(TenderName, tender_name_id)
    if tender_name is None:
        raise NotFoundError(code="NOT_FOUND", message="Tender name not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != tender_name.name:
        await _assert_name_available(session, data["name"], exclude_id=tender_name_id)

    for field, value in data.items():
        setattr(tender_name, field, value)

    await session.commit()
    await session.refresh(tender_name)
    return tender_name
