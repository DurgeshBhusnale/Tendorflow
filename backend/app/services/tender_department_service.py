from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ConflictError, NotFoundError
from app.models.tender_department import TenderDepartment
from app.models.user import User
from app.schemas.tender_department import TenderDepartmentCreate, TenderDepartmentUpdate


async def _assert_name_available(
    session: AsyncSession, name: str, exclude_id: UUID | None = None
) -> None:
    query = select(TenderDepartment).where(TenderDepartment.name == name)
    if exclude_id is not None:
        query = query.where(TenderDepartment.id != exclude_id)
    if await session.scalar(query) is not None:
        raise ConflictError(
            code="TENDER_DEPARTMENT_EXISTS",
            message="A tender department with this name already exists.",
        )


async def list_tender_departments(
    session: AsyncSession, active_only: bool = False
) -> list[TenderDepartment]:
    query = select(TenderDepartment)
    if active_only:
        query = query.where(TenderDepartment.is_active.is_(True))
    return list((await session.scalars(query.order_by(TenderDepartment.name))).all())


async def create_tender_department(
    session: AsyncSession, current_user: User, payload: TenderDepartmentCreate
) -> TenderDepartment:
    await _assert_name_available(session, payload.name)

    department = TenderDepartment(name=payload.name, created_by=current_user.id)
    session.add(department)
    await session.commit()
    await session.refresh(department)
    return department


async def update_tender_department(
    session: AsyncSession, tender_department_id: UUID, payload: TenderDepartmentUpdate
) -> TenderDepartment:
    department = await session.get(TenderDepartment, tender_department_id)
    if department is None:
        raise NotFoundError(code="NOT_FOUND", message="Tender department not found.")

    data = payload.model_dump(exclude_unset=True)
    if "name" in data and data["name"] != department.name:
        await _assert_name_available(session, data["name"], exclude_id=tender_department_id)

    for field, value in data.items():
        setattr(department, field, value)

    await session.commit()
    await session.refresh(department)
    return department
