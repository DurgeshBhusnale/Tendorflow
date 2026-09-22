from datetime import date
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, require_admin
from app.models.user import User
from app.schemas.common import ok, paginated
from app.schemas.expense import ExpenseCreate, ExpenseRead, ExpenseStatus, ExpenseUpdate
from app.services import expense_service

# Admin-only in full (CH-27). What the business spends is the cost side of the
# ledger whose revenue totals employees already cannot see (CH-12), so the
# restriction sits on every route rather than on the page that calls them.
router = APIRouter(prefix="/api/expenses", tags=["expenses"])


@router.get("")
async def list_expenses(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=25, ge=1, le=100),
    status: ExpenseStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    items, total_count = await expense_service.list_expenses(
        session, page, page_size, status, search, start_date, end_date
    )
    return paginated(
        [ExpenseRead.model_validate(item) for item in items], total_count, page, page_size
    )


@router.get("/summary")
async def summarize_expenses(
    status: ExpenseStatus | None = Query(default=None),
    search: str | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    summary = await expense_service.summarize_expenses(
        session, status, search, start_date, end_date
    )
    return ok(summary)


@router.post("", status_code=http_status.HTTP_201_CREATED)
async def create_expense(
    payload: ExpenseCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    expense = await expense_service.create_expense(session, current_user, payload)
    return ok(ExpenseRead.model_validate(expense))


@router.get("/{expense_id}")
async def get_expense(
    expense_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    expense = await expense_service.get_expense(session, expense_id)
    return ok(ExpenseRead.model_validate(expense))


@router.patch("/{expense_id}")
async def update_expense(
    expense_id: UUID,
    payload: ExpenseUpdate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    expense = await expense_service.update_expense(session, current_user, expense_id, payload)
    return ok(ExpenseRead.model_validate(expense))


@router.delete("/{expense_id}")
async def delete_expense(
    expense_id: UUID,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(require_admin),
):
    await expense_service.delete_expense(session, expense_id)
    return ok({"id": str(expense_id), "deleted": True})
