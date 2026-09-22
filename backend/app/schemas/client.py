from datetime import datetime
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, BeforeValidator, ConfigDict, EmailStr, Field, field_validator

from app.schemas.validators import normalize_phone


def _blank_to_none(value: object) -> object:
    """An emptied bank-details box means "none on file", not an empty string."""
    if isinstance(value, str) and not value.strip():
        return None
    return value


# Capped, unlike an expense note: this is a few lines of account detail, and
# the column is rendered in the clients table. The length constraint sits on the
# str arm of the union — applied to the whole union it would be checked against
# None too, which is a TypeError rather than a validation error.
BankDetails = Annotated[
    Annotated[str, Field(max_length=500)] | None, BeforeValidator(_blank_to_none)
]


class CreatorRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class ClientCreate(BaseModel):
    contact_person_name: str = Field(min_length=1, max_length=120)
    company_name: str = Field(min_length=1, max_length=200)
    contact_number: str
    email: EmailStr
    # Optional free text (CH-26) — whatever the client actually sends.
    bank_details: BankDetails = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str) -> str:
        return normalize_phone(v)


class ClientUpdate(BaseModel):
    contact_person_name: str | None = Field(default=None, min_length=1, max_length=120)
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_number: str | None = None
    email: EmailStr | None = None
    bank_details: BankDetails = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return normalize_phone(v)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contact_person_name: str
    company_name: str
    contact_number: str
    email: str
    bank_details: str | None
    # Whoever last touched the row, not necessarily who first onboarded it —
    # every module is open-edit and reports the latest hand (CH-19). Paired with
    # `updated_at`, which the set_updated_at trigger maintains.
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime
