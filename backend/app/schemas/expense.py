from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.core.dates import today_ist
from app.schemas.client import CreatorRef

ExpenseStatus = Literal["Paid", "Pending"]


class ExpenseCreate(BaseModel):
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    # No max_length: the note is the record of where the money went (CH-27).
    details: str = Field(min_length=1)
    status: ExpenseStatus = "Pending"
    # Defaults to today in IST, so a client that never sends it behaves as
    # though the expense was logged for the day it was entered.
    expense_date: date = Field(default_factory=today_ist)


class ExpenseUpdate(BaseModel):
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    details: str | None = Field(default=None, min_length=1)
    status: ExpenseStatus | None = None
    expense_date: date | None = None


class ExpenseRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    amount: Decimal
    details: str
    status: str
    expense_date: date
    # Last editor, not original author — every module is open-edit (CH-19).
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime

    @field_serializer("amount")
    def serialize_money(self, value: Decimal) -> str:
        """Money crosses the wire as a fixed-2dp string (API_CONTRACT.md 7)."""
        return f"{value:.2f}"


class ExpenseSummary(BaseModel):
    """Totals for exactly the rows the current filter selects.

    `total_amount` is every filtered expense; the paid and pending figures split
    that same set, so the two always add up to it.
    """

    total_amount: Decimal
    paid_amount: Decimal
    pending_amount: Decimal
    total_count: int
    paid_count: int
    pending_count: int

    @field_serializer("total_amount", "paid_amount", "pending_amount")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
