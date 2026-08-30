from decimal import Decimal

from pydantic import BaseModel, field_serializer

from app.schemas.client import ClientRead
from app.schemas.tender import TenderRead


class DashboardSummary(BaseModel):
    total_active_clients: int
    pending_tenders_count: int
    total_paid_tender_value: Decimal
    dsc_keys_in_office: int
    recent_tenders: list[TenderRead]
    recent_clients: list[ClientRead]

    @field_serializer("total_paid_tender_value")
    def serialize_money(self, value: Decimal) -> str:
        """Same fixed-2dp string treatment as everywhere else money crosses the wire."""
        return f"{value:.2f}"
