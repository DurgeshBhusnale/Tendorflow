from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.dates import ist_day_end_utc, ist_day_start_utc
from app.core.exceptions import NotFoundError, ValidationError
from app.models.client import Client
from app.models.tender import Tender
from app.models.tender_department import TenderDepartment
from app.models.user import User
from app.schemas.tender import TenderCreate, TenderSummary, TenderUpdate, validate_payment

# No ownership check in this module any more (CH-19): any signed-in user may
# edit any tender, and the row reports whoever touched it last. Deletion is
# gated to admins at the router.


async def _assert_refs_exist(
    session: AsyncSession, client_id: UUID | None, tender_department_id: UUID | None
) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")
    if (
        tender_department_id is not None
        and await session.get(TenderDepartment, tender_department_id) is None
    ):
        raise NotFoundError(
            code="TENDER_DEPARTMENT_NOT_FOUND", message="Tender department not found."
        )


def _apply_filters(
    query,
    client_id,
    status,
    search,
    start_date: date | None = None,
    end_date: date | None = None,
    *,
    needs_join: bool,
):
    """Apply the shared list/summary filters to a select.

    One function, two callers, so the summary strip can never describe a
    different set of rows than the table beneath it.
    """
    if client_id is not None:
        query = query.where(Tender.client_id == client_id)
    if status is not None:
        query = query.where(Tender.status == status)
    # Both bounds are IST calendar days and both are inclusive; see
    # core/dates.py for why the upper bound is expressed as a `<`.
    if start_date is not None:
        query = query.where(Tender.created_at >= ist_day_start_utc(start_date))
    if end_date is not None:
        query = query.where(Tender.created_at < ist_day_end_utc(end_date))
    if search:
        pattern = f"%{search}%"
        if needs_join:
            query = query.join(Client, Tender.client_id == Client.id).join(
                TenderDepartment, Tender.tender_department_id == TenderDepartment.id
            )
        query = query.where(
            or_(
                Client.contact_person_name.ilike(pattern),
                Client.company_name.ilike(pattern),
                TenderDepartment.name.ilike(pattern),
            )
        )
    return query


def _eager(query):
    """Force relationships (and the DB-computed amounts) to be re-read.

    See credential_service._eager — a row written earlier in the same session
    sits in the identity map with stale/unloaded state otherwise. It matters
    doubly here: total_amount and remaining_amount are generated columns, so
    their post-write values exist only in the database.
    """
    return query.execution_options(populate_existing=True)


async def list_tenders(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[list[Tender], int]:
    query = _apply_filters(
        select(Tender), client_id, status, search, start_date, end_date, needs_join=True
    )
    count_query = _apply_filters(
        select(func.count()).select_from(Tender),
        client_id,
        status,
        search,
        start_date,
        end_date,
        needs_join=True,
    )

    total_count = await session.scalar(count_query)
    # Ordered by when the tender was logged, never by when it was last edited:
    # editing a row must not reshuffle the table (CH-11).
    query = query.order_by(Tender.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


async def summarize_tenders(
    session: AsyncSession,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> TenderSummary:
    """Totals for exactly the rows the same filters select, summed in Postgres.

    Sums `remaining_amount` alongside `total_amount` so a partially paid tender
    contributes only its unpaid balance to the outstanding figure. Summing
    `total_amount` over the unpaid statuses — which is what this did before
    partial payments existed — would over-report every partly settled row.
    """
    query = _apply_filters(
        select(
            Tender.status,
            func.coalesce(func.sum(Tender.total_amount), 0),
            func.coalesce(func.sum(Tender.remaining_amount), 0),
            func.count(),
        ),
        client_id,
        status,
        search,
        start_date,
        end_date,
        needs_join=True,
    ).group_by(Tender.status)

    zero = (Decimal("0"), Decimal("0"), 0)
    totals: dict[str, tuple[Decimal, Decimal, int]] = {
        row_status: (total, remaining, count)
        for row_status, total, remaining, count in (await session.execute(query))
    }

    pending_total, pending_remaining, pending_count = totals.get("Pending", zero)
    paid_total, _, paid_count = totals.get("Paid", zero)
    partial_total, partial_remaining, partial_count = totals.get("Partially Paid", zero)

    return TenderSummary(
        total_pending_value=pending_total,
        total_paid_value=paid_total,
        total_partially_paid_value=partial_total,
        total_outstanding_value=pending_remaining + partial_remaining,
        pending_count=pending_count,
        paid_count=paid_count,
        partially_paid_count=partial_count,
    )


async def get_tender(session: AsyncSession, tender_id: UUID) -> Tender:
    tender = await session.scalar(_eager(select(Tender).where(Tender.id == tender_id)))
    if tender is None:
        raise NotFoundError(code="NOT_FOUND", message="Tender not found.")
    return tender


async def create_tender(session: AsyncSession, current_user: User, payload: TenderCreate) -> Tender:
    await _assert_refs_exist(session, payload.client_id, payload.tender_department_id)

    # TenderCreate's model_validator has already run validate_payment and
    # normalized paid_amount, so the payload is safe to splat.
    tender = Tender(**payload.model_dump(), created_by=current_user.id)
    session.add(tender)
    await session.commit()
    return await get_tender(session, tender.id)


async def update_tender(
    session: AsyncSession, current_user: User, tender_id: UUID, payload: TenderUpdate
) -> Tender:
    tender = await get_tender(session, tender_id)

    data = payload.model_dump(exclude_unset=True)
    await _assert_refs_exist(session, data.get("client_id"), data.get("tender_department_id"))

    # A PATCH may omit any of these, so the payment rules are checked against
    # the row as it will be after the merge, not against the payload alone.
    quantity = data.get("quantity", tender.quantity)
    price = data.get("price", tender.price)
    status = data.get("status", tender.status)
    paid_amount = data.get("paid_amount", tender.paid_amount)
    payment_mode = data.get("payment_mode", tender.payment_mode)

    if status == "Pending":
        # Moving back to Pending clears the payment record, rather than failing
        # on the stale mode still sitting in the row.
        paid_amount = None
        payment_mode = None

    try:
        paid_amount = validate_payment(status, paid_amount, payment_mode, quantity * price)
    except ValueError as exc:
        raise ValidationError(code="VALIDATION_ERROR", message=str(exc)) from exc

    for field, value in data.items():
        setattr(tender, field, value)
    tender.status = status
    tender.paid_amount = paid_amount
    tender.payment_mode = payment_mode
    # Attribution follows the latest edit (CH-19).
    tender.created_by = current_user.id

    await session.commit()
    return await get_tender(session, tender_id)


async def delete_tender(session: AsyncSession, tender_id: UUID) -> None:
    """Admin-only, enforced by the router's require_admin dependency."""
    tender = await get_tender(session, tender_id)
    await session.delete(tender)
    await session.commit()
