from datetime import date, datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer, field_validator

from app.core.dates import today_ist
from app.schemas.client import CreatorRef
from app.schemas.validators import normalize_phone

# "With Us" is the money the business is still holding; "Returned" has gone
# back to the client. Those two words are what the office already says.
EmdStatus = Literal["With Us", "Returned"]


def _blank_to_none(value: str | None) -> str | None:
    """An emptied note means "not recorded", not an empty string."""
    if value is None or not value.strip():
        return None
    return value.strip()


class EmdBase(BaseModel):
    """The fields a deposit is typed with (CH-33).

    Client name, company and number are plain text rather than a link to a
    client record: a deposit often arrives with someone not yet on file, and
    stopping to onboard a client first is not how the office works.
    """

    client_name: str = Field(min_length=1, max_length=120)
    company_name: str = Field(min_length=1, max_length=200)
    contact_number: str
    amount: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    status: EmdStatus = "With Us"
    emd_date: date = Field(default_factory=today_ist)
    # No max_length: an account detail arrives in whatever shape the bank gave
    # it, and truncating it would lose the part that identifies the account.
    paid_to_bank_account: str | None = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str) -> str:
        return normalize_phone(v)

    @field_validator("paid_to_bank_account")
    @classmethod
    def clean_bank_account(cls, v: str | None) -> str | None:
        return _blank_to_none(v)


class EmdCreate(EmdBase):
    pass


class EmdUpdate(BaseModel):
    client_name: str | None = Field(default=None, min_length=1, max_length=120)
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_number: str | None = None
    amount: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: EmdStatus | None = None
    emd_date: date | None = None
    paid_to_bank_account: str | None = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return normalize_phone(v)

    @field_validator("paid_to_bank_account")
    @classmethod
    def clean_bank_account(cls, v: str | None) -> str | None:
        return _blank_to_none(v)


class EmdBulkDelete(BaseModel):
    """Ids to delete in one go (CH-34), exactly as for tenders (CH-29).

    Explicit ids rather than a filter, and capped at the list endpoint's own
    page-size ceiling, so one call can never exceed what one screenful could
    have selected.
    """

    ids: list[UUID] = Field(min_length=1, max_length=100)


class EmdRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client_name: str
    company_name: str
    contact_number: str
    amount: Decimal
    status: str
    emd_date: date
    paid_to_bank_account: str | None
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
