import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

CONTACT_NUMBER_RE = re.compile(r"^[\d +\-]{7,20}$")


def _validate_contact_number(v: str) -> str:
    if not CONTACT_NUMBER_RE.match(v):
        raise ValueError("Contact number must be 7-20 characters of digits, spaces, '+' or '-'.")
    return v


class CreatorRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    full_name: str


class ClientCreate(BaseModel):
    contact_person_name: str = Field(min_length=1, max_length=120)
    company_name: str = Field(min_length=1, max_length=200)
    contact_number: str
    email: EmailStr

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str) -> str:
        return _validate_contact_number(v)


class ClientUpdate(BaseModel):
    contact_person_name: str | None = Field(default=None, min_length=1, max_length=120)
    company_name: str | None = Field(default=None, min_length=1, max_length=200)
    contact_number: str | None = None
    email: EmailStr | None = None

    @field_validator("contact_number")
    @classmethod
    def validate_contact_number(cls, v: str | None) -> str | None:
        if v is None:
            return v
        return _validate_contact_number(v)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contact_person_name: str
    company_name: str
    contact_number: str
    email: str
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
