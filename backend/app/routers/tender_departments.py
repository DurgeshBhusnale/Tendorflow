from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok
from app.schemas.tender_department import (
    TenderDepartmentCreate,
    TenderDepartmentRead,
    TenderDepartmentUpdate,
)
from app.services import tender_department_service

router = APIRouter(prefix="/api/tender-departments", tags=["tender-departments"])


@router.get("")
async def list_tender_departments(
    active_only: bool = Query(default=False),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    departments = await tender_department_service.list_tender_departments(session, active_only)
    return ok([TenderDepartmentRead.model_validate(d) for d in departments])


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_tender_department(
    payload: TenderDepartmentCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    department = await tender_department_service.create_tender_department(
        session, current_user, payload
    )
    return ok(TenderDepartmentRead.model_validate(department))


@router.patch("/{tender_department_id}")
async def update_tender_department(
    tender_department_id: UUID,
    payload: TenderDepartmentUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    department = await tender_department_service.update_tender_department(
        session, tender_department_id, payload
    )
    return ok(TenderDepartmentRead.model_validate(department))
