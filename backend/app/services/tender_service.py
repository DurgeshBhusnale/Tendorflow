from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import ForbiddenError, NotFoundError
from app.models.client import Client
from app.models.tender import Tender
from app.models.tender_name import TenderName
from app.models.user import User
from app.schemas.tender import TenderCreate, TenderSummary, TenderUpdate


def _assert_can_modify(tender: Tender, current_user: User) -> None:
    if tender.created_by != current_user.id and current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="You can only edit tenders you created.")


async def _assert_refs_exist(
    session: AsyncSession, client_id: UUID | None, tender_name_id: UUID | None
) -> None:
    if client_id is not None and await session.get(Client, client_id) is None:
        raise NotFoundError(code="CLIENT_NOT_FOUND", message="Client not found.")
    if tender_name_id is not None and await session.get(TenderName, tender_name_id) is None:
        raise NotFoundError(code="TENDER_NAME_NOT_FOUND", message="Tender name not found.")


def _apply_filters(query, client_id, status, search, *, needs_join: bool):
    """Apply the shared list/summary filters to a select."""
    if client_id is not None:
        query = query.where(Tender.client_id == client_id)
    if status is not None:
        query = query.where(Tender.status == status)
    if search:
        pattern = f"%{search}%"
        if needs_join:
            query = query.join(Client, Tender.client_id == Client.id).join(
                TenderName, Tender.tender_name_id == TenderName.id
            )
        query = query.where(or_(Client.company_name.ilike(pattern), TenderName.name.ilike(pattern)))
    return query


def _eager(query):
    """Force relationships (and the DB-computed total_amount) to be re-read.

    See credential_service._eager — a row written earlier in the same session
    sits in the identity map with stale/unloaded state otherwise.
    """
    return query.execution_options(populate_existing=True)


async def list_tenders(
    session: AsyncSession,
    page: int,
    page_size: int,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> tuple[list[Tender], int]:
    query = _apply_filters(select(Tender), client_id, status, search, needs_join=True)
    count_query = _apply_filters(
        select(func.count()).select_from(Tender), client_id, status, search, needs_join=True
    )

    total_count = await session.scalar(count_query)
    query = query.order_by(Tender.created_at.desc()).offset((page - 1) * page_size).limit(page_size)
    items = list((await session.scalars(_eager(query))).unique().all())
    return items, total_count or 0


async def summarize_tenders(
    session: AsyncSession,
    client_id: UUID | None = None,
    status: str | None = None,
    search: str | None = None,
) -> TenderSummary:
    """Totals for exactly the rows the same filters select, summed in Postgres."""
    query = _apply_filters(
        select(
            Tender.status,
            func.coalesce(func.sum(Tender.total_amount), 0),
            func.count(),
        ),
        client_id,
        status,
        search,
        needs_join=True,
    ).group_by(Tender.status)

    totals: dict[str, tuple[Decimal, int]] = {
        row_status: (value, count) for row_status, value, count in (await session.execute(query))
    }
    pending_value, pending_count = totals.get("Pending", (Decimal("0"), 0))
    paid_value, paid_count = totals.get("Paid", (Decimal("0"), 0))

    return TenderSummary(
        total_pending_value=pending_value,
        total_paid_value=paid_value,
        pending_count=pending_count,
        paid_count=paid_count,
    )


async def get_tender(session: AsyncSession, tender_id: UUID) -> Tender:
    tender = await session.scalar(_eager(select(Tender).where(Tender.id == tender_id)))
    if tender is None:
        raise NotFoundError(code="NOT_FOUND", message="Tender not found.")
    return tender


async def create_tender(session: AsyncSession, current_user: User, payload: TenderCreate) -> Tender:
    await _assert_refs_exist(session, payload.client_id, payload.tender_name_id)

    tender = Tender(**payload.model_dump(), created_by=current_user.id)
    session.add(tender)
    await session.commit()
    # Re-read so total_amount reflects what Postgres computed.
    return await get_tender(session, tender.id)


async def update_tender(
    session: AsyncSession, current_user: User, tender_id: UUID, payload: TenderUpdate
) -> Tender:
    tender = await get_tender(session, tender_id)
    _assert_can_modify(tender, current_user)

    data = payload.model_dump(exclude_unset=True)
    await _assert_refs_exist(session, data.get("client_id"), data.get("tender_name_id"))

    for field, value in data.items():
        setattr(tender, field, value)

    await session.commit()
    # Re-read so total_amount reflects the recomputed value.
    return await get_tender(session, tender_id)


async def delete_tender(session: AsyncSession, current_user: User, tender_id: UUID) -> None:
    tender = await get_tender(session, tender_id)
    _assert_can_modify(tender, current_user)

    await session.delete(tender)
    await session.commit()
