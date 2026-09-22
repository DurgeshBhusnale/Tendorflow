from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, model_validator

from app.core.dates import today_ist
from app.schemas.client import CreatorRef
from app.schemas.credential import ClientRef

TenderStatus = Literal["Paid", "Pending", "Partially Paid"]
PaymentMode = Literal["Cash", "Online"]

# Statuses that mean money changed hands, and therefore require a payment mode.
PAID_STATUSES: tuple[TenderStatus, ...] = ("Paid", "Partially Paid")


def validate_payment(
    status: str,
    paid_amount: Decimal | None,
    payment_mode: str | None,
    total_amount: Decimal,
) -> Decimal:
    """Check a tender's payment fields against its status and return paid_amount.

    One definition, called from two places: the create schema (where quantity
    and price are always present, so the total is known) and the service (which
    re-runs it against the merged row after a partial update). The DB CHECK in
    migration e4d0f6a2743b is the third line of defence.

    Raises ValueError; the caller decides whether that surfaces as a Pydantic
    422 or a domain ValidationError.
    """
    if status == "Pending":
        if payment_mode is not None:
            raise ValueError("A pending tender cannot have a payment mode.")
        if paid_amount not in (None, Decimal("0")):
            raise ValueError("A pending tender cannot have a paid amount.")
        return Decimal("0")

    if payment_mode is None:
        raise ValueError("Select how this tender was paid: Cash or Online.")

    if status == "Paid":
        # Not taken from the request: 'Paid' means the whole total arrived, so
        # the server derives it and the two can never disagree.
        return total_amount

    if paid_amount is None:
        raise ValueError("Enter how much has been paid so far.")
    if paid_amount <= 0:
        raise ValueError("A partial payment must be more than zero.")
    if paid_amount >= total_amount:
        raise ValueError(
            "A partial payment must be less than the total amount. Mark the tender as Paid instead."
        )
    return paid_amount


class TenderDepartmentRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class TenderCreate(BaseModel):
    client_id: UUID
    tender_department_id: UUID
    quantity: int = Field(gt=0)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    status: TenderStatus = "Pending"
    paid_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    payment_mode: PaymentMode | None = None
    # The day the tender is logged for (CH-22). Defaults to today in IST, so a
    # client that never sends it behaves exactly as before the field existed.
    tender_date: date = Field(default_factory=today_ist)
    # total_amount and remaining_amount are deliberately absent: both are
    # Postgres generated columns. Pydantic ignores unknown keys, so sending
    # either has no effect.

    @model_validator(mode="after")
    def check_payment(self) -> "TenderCreate":
        self.paid_amount = validate_payment(
            self.status, self.paid_amount, self.payment_mode, self.quantity * self.price
        )
        return self


class TenderUpdate(BaseModel):
    client_id: UUID | None = None
    tender_department_id: UUID | None = None
    quantity: int | None = Field(default=None, gt=0)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: TenderStatus | None = None
    paid_amount: Decimal | None = Field(default=None, ge=0, max_digits=14, decimal_places=2)
    payment_mode: PaymentMode | None = None
    tender_date: date | None = None
    # No model_validator here: a PATCH may omit quantity or price, so the total
    # this has to be checked against is only knowable once the payload is merged
    # onto the stored row. tender_service.update_tender does that.


class TenderBulkDelete(BaseModel):
    """Ids to delete in one go (CH-29).

    Explicit ids rather than a filter: the server then deletes exactly the
    rows the user ticked. Re-running a filter here would let a row that
    changed between the click and the request be deleted unseen, and a
    dropped query param would mean deleting everything.

    Capped at the list endpoint's own page-size ceiling, so a single call can
    never exceed what one screenful could have selected.
    """

    ids: list[UUID] = Field(min_length=1, max_length=100)


class TenderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    tender_department: TenderDepartmentRef
    quantity: int
    price: Decimal
    total_amount: Decimal
    paid_amount: Decimal
    remaining_amount: Decimal
    status: str
    payment_mode: str | None
    # Last editor, not original author — every module is open-edit (CH-19).
    created_by: CreatorRef | None = Field(validation_alias="creator")
    # tender_date is the business date — what the table shows and what the
    # date-range filter and ordering use (CH-22). created_at is when the row
    # was typed in; updated_at is when it last changed.
    tender_date: date
    created_at: datetime
    updated_at: datetime

    @field_serializer("price", "total_amount", "paid_amount", "remaining_amount")
    def serialize_money(self, value: Decimal) -> str:
        """Money crosses the wire as a fixed-2dp string.

        Without this FastAPI's encoder would turn Decimal into a float and lose
        exactness — see the note in API_CONTRACT.md section 7.
        """
        return f"{value:.2f}"


class TenderSummary(BaseModel):
    """Totals for exactly the rows the current filter selects.

    `total_outstanding_value` is the number the Tenders page leads with. It is
    not `total_pending_value`: a partially paid tender still owes the balance,
    so outstanding sums `remaining_amount` across Pending *and* Partially Paid
    rows, while the pending/partial values below report each bucket's full
    contract value.
    """

    total_pending_value: Decimal
    total_paid_value: Decimal
    total_partially_paid_value: Decimal
    total_outstanding_value: Decimal
    pending_count: int
    paid_count: int
    partially_paid_count: int

    @field_serializer(
        "total_pending_value",
        "total_paid_value",
        "total_partially_paid_value",
        "total_outstanding_value",
    )
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
