from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.core.dates import today_ist
from app.schemas.client import CreatorRef
from app.schemas.credential import ClientRef
from app.schemas.validators import normalize_phone

# "With Us" is the money the business is still holding; "Returned" has gone
# back to the client. Those two words are what the office already says.
EmdStatus = Literal["With Us", "Returned"]


class EmdCreate(BaseModel):
    client_id: UUID
    contact_number: str
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    status: EmdStatus = "With Us"
    # Defaults to today in IST, like every other business date in the app.
    emd_date: date = Field(default_factory=today_ist)

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str) -> str:
        return normalize_phone(v)


class EmdUpdate(BaseModel):
    client_id: UUID | None = None
    contact_number: str | None = None
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: EmdStatus | None = None
    emd_date: date | None = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return normalize_phone(v)


class EmdRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    contact_number: str
    amount: Decimal
    status: str
    emd_date: date
    # Last editor, not original author — every module is open-edit (CH-19).
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime

    @field_serializer("amount")
    def serialize_money(self, value: Decimal) -> str:
        """Money crosses the wire as a fixed-2dp string (API_CONTRACT.md 7)."""
        return f"{value:.2f}"


class EmdSummary(BaseModel):
    """Totals for exactly the rows the current filter selects.

    `total_with_us` is the figure the page leads with: how much client money the
    business is holding right now, and therefore still owes back.
    """

    total_with_us: Decimal
    total_returned: Decimal
    with_us_count: int
    returned_count: int

    @field_serializer("total_with_us", "total_returned")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
