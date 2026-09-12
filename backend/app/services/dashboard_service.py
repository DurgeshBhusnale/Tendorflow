from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.client import Client
from app.models.dsc_key import DscKey
from app.models.user import User
from app.schemas.client import ClientRead
from app.schemas.dashboard import DashboardSummary
from app.schemas.dsc_key import IN_OFFICE_STATUSES
from app.schemas.tender import TenderRead
from app.services import client_service, tender_service

RECENT_LIMIT = 5


async def get_dashboard_summary(session: AsyncSession, current_user: User) -> DashboardSummary:
    """Aggregate the landing-page metrics.

    Counts and recent rows are delegated to the modules' own services rather
    than re-derived here, so the dashboard cannot drift from what the Clients
    and Tenders pages show.

    The response is no longer identical for both roles: total paid value is
    revenue, and employees do not see revenue (CH-12). It is withheld here in
    the service rather than trimmed in the UI, so hiding the card is not the
    only thing standing between an employee and the number.
    """
    # "Active" clients means all of them — `clients` has no status column and
    # deletion is a hard cascade. See BUILD_PLAN open question 2.
    total_active_clients = await session.scalar(select(func.count()).select_from(Client)) or 0

    dsc_keys_in_office = (
        await session.scalar(
            select(func.count())
            .select_from(DscKey)
            .where(DscKey.key_status.in_(IN_OFFICE_STATUSES))
        )
        or 0
    )

    tender_totals = await tender_service.summarize_tenders(session)

    recent_tenders, _ = await tender_service.list_tenders(session, page=1, page_size=RECENT_LIMIT)
    recent_clients, _ = await client_service.list_clients(session, page=1, page_size=RECENT_LIMIT)

    is_admin = current_user.role == "admin"

    return DashboardSummary(
        total_active_clients=total_active_clients,
        pending_tenders_count=tender_totals.pending_count,
        total_paid_tender_value=tender_totals.total_paid_value if is_admin else None,
        dsc_keys_in_office=dsc_keys_in_office,
        recent_tenders=[TenderRead.model_validate(t) for t in recent_tenders],
        recent_clients=[ClientRead.model_validate(c) for c in recent_clients],
    )
