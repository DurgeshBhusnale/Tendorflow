from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import NotFoundError
from app.models.client import Client
from app.models.emd import Emd
from app.models.user import User
from app.schemas.emd import EmdCreate, EmdSummary, EmdUpdate

# Open-edit, like every record module (CH-19): any signed-in user may log or
# amend a deposit, and the row reports whoever touched it last. Deletion is
# gated to admins at the router.


async def _assert_client_exists(session: AsyncSession, client_id: UUID | None) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")


def _apply_filters(query, client_id, status, search, start_date, end_date, *, needs_join: bool):
    """Apply the shared list/summary filters.

    One function, two callers, so the KPI strip can never describe a different
    set of rows than the table beneath it.
    """
    if client_id is not None:
        query = query.where(Emd.client_id == client_id)
    if status is not None:
        query = query.where(Emd.status == status)
    # Both bounds are inclusive; emd_date is already a calendar day.
    if start_date is not None:
        query = query.where(Emd.emd_date >= start_date)
    if end_date is not None:
        query = query.where(Emd.emd_date <= end_date)
    if search:
        pattern = f"%{search}%"
        if needs_join:
            query = query.join(Client, Emd.client_id == Client.id)
        query = query.where(
            or_(
                Client.contact_person_name.ilike(pattern),
                Client.company_name.ilike(pattern),
                Emd.contact_number.ilike(pattern),
            )
        )
    return query


def _eager(query):
    """Re-read relationships rather than trusting the identity map.

    See credential_service._eager: a row written earlier in the same session
    sits there with stale or unloaded state otherwise.
    """
    return query.execution_options(populate_existing=True)


async def list_emds(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> tuple[list[Emd], int]:
    query = _apply_filters(
        select(Emd), client_id, status, search, start_date, end_date, needs_join=True
    )
    count_query = _apply_filters(
        select(func.count()).select_from(Emd),
        client_id,
        status,
        search,
        start_date,
        end_date,
        needs_join=True,
    )

    total_count = await session.scalar(count_query)
    # Newest deposit first, with created_at breaking ties inside a day. Editing
    # a row must not reshuffle the table.
    query = (
        query.order_by(Emd.emd_date.desc(), Emd.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


async def summarize_emds(
    session: AsyncSession,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
    start_date: date | None = None,
    end_date: date | None = None,
) -> EmdSummary:
    """Totals for exactly the rows the same filters select, summed in Postgres."""
    query = _apply_filters(
        select(Emd.status, func.coalesce(func.sum(Emd.amount), 0), func.count()),
        client_id,
        status,
        search,
        start_date,
        end_date,
        needs_join=True,
    ).group_by(Emd.status)

    zero = (Decimal("0"), 0)
    totals: dict[str, tuple[Decimal, int]] = {
        row_status: (amount, count) for row_status, amount, count in (await session.execute(query))
    }

    with_us_amount, with_us_count = totals.get("With Us", zero)
    returned_amount, returned_count = totals.get("Returned", zero)

    return EmdSummary(
        total_with_us=with_us_amount,
        total_returned=returned_amount,
        with_us_count=with_us_count,
        returned_count=returned_count,
    )


async def get_emd(session: AsyncSession, emd_id: UUID) -> Emd:
    emd = await session.scalar(_eager(select(Emd).where(Emd.id == emd_id)))
    if emd is None:
        raise NotFoundError(code="NOT_FOUND", message="EMD not found.")
    return emd


async def create_emd(session: AsyncSession, current_user: User, payload: EmdCreate) -> Emd:
    await _assert_client_exists(session, payload.client_id)

    emd = Emd(**payload.model_dump(), created_by=current_user.id)
    session.add(emd)
    await session.commit()
    return await get_emd(session, emd.id)


async def update_emd(
    session: AsyncSession, current_user: User, emd_id: UUID, payload: EmdUpdate
) -> Emd:
    emd = await get_emd(session, emd_id)

    data = payload.model_dump(exclude_unset=True)
    await _assert_client_exists(session, data.get("client_id"))

    for field, value in data.items():
        setattr(emd, field, value)
    # Attribution follows the latest edit (CH-19).
    emd.created_by = current_user.id

    await session.commit()
    return await get_emd(session, emd_id)


async def delete_emd(session: AsyncSession, emd_id: UUID) -> None:
    """Admin-only, enforced by the router's require_admin dependency."""
    emd = await get_emd(session, emd_id)
    await session.delete(emd)
    await session.commit()
