from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.expense import Expense
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseSummary, ExpenseUpdate

# Every function here is reached only through require_admin at the router
# (CH-27): expenses are the cost side of the ledger whose revenue figures are
# already admin-only (CH-12).


def _apply_filters(query, status, search, start_date: date | None, end_date: date | None):
    """Apply the shared list/summary filters.

    One function, two callers, so the KPI strip can never describe a different
    set of rows than the table beneath it.
    """
    if status is not None:
        query = query.where(Expense.status == status)
    # Both bounds are inclusive calendar days; expense_date is already a date,
    # so no timezone conversion is involved.
    if start_date is not None:
        query = query.where(Expense.expense_date >= start_date)
    if end_date is not None:
        query = query.where(Expense.expense_date <= end_date)
    if search:
        query = query.where(Expense.details.ilike(f"%{search}%"))
    return query


async def list_expenses(
    session: AsyncSession,
    page: int,
    page_size: int,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[list[Expense], int]:
    query = _apply_filters(select(Expense), status, search, start_date, end_date)
    count_query = _apply_filters(
        select(func.count()).select_from(Expense), status, search, start_date, end_date
    )

    total_count = await session.scalar(count_query)
    # Newest spend first, with created_at breaking ties inside a day. Editing a
    # row must not reshuffle the table.
    query = (
        query.order_by(Expense.expense_date.desc(), Expense.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list((await session.scalars(query.execution_options(populate_existing=True))).all())
    return items, total_count or 0


async def summarize_expenses(
    session: AsyncSession,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> ExpenseSummary:
    """Totals for exactly the rows the same filters select, summed in Postgres."""
    query = _apply_filters(
        select(Expense.status, func.coalesce(func.sum(Expense.amount), 0), func.count()),
        status,
        search,
        start_date,
        end_date,
    ).group_by(Expense.status)

    zero = (Decimal("0"), 0)
    totals: dict[str, tuple[Decimal, int]] = {
        row_status: (amount, count) for row_status, amount, count in (await session.execute(query))
    }

    paid_amount, paid_count = totals.get("Paid", zero)
    pending_amount, pending_count = totals.get("Pending", zero)

    return ExpenseSummary(
        total_amount=paid_amount + pending_amount,
        paid_amount=paid_amount,
        pending_amount=pending_amount,
        total_count=paid_count + pending_count,
        paid_count=paid_count,
        pending_count=pending_count,
    )


async def get_expense(session: AsyncSession, expense_id: UUID) -> Expense:
    expense = await session.scalar(
        select(Expense).where(Expense.id == expense_id).execution_options(populate_existing=True)
    )
    if expense is None:
        raise NotFoundError(code="NOT_FOUND", message="Expense not found.")
    return expense


async def create_expense(
    session: AsyncSession, current_user: User, payload: ExpenseCreate
) -> Expense:
    expense = Expense(**payload.model_dump(), created_by=current_user.id)
    session.add(expense)
    await session.commit()
    return await get_expense(session, expense.id)


async def update_expense(
    session: AsyncSession, current_user: User, expense_id: UUID, payload: ExpenseUpdate
) -> Expense:
    expense = await get_expense(session, expense_id)

    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(expense, field, value)
    # Attribution follows the latest edit (CH-19).
    expense.created_by = current_user.id

    await session.commit()
    return await get_expense(session, expense_id)


async def delete_expense(session: AsyncSession, expense_id: UUID) -> None:
    expense = await get_expense(session, expense_id)
    await session.delete(expense)
    await session.commit()
