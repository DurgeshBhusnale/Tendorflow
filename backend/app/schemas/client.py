from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.validators import normalize_phone


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
        return normalize_phone(v)


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
        return normalize_phone(v)


class ClientRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    contact_person_name: str
    company_name: str
    contact_number: str
    email: str
    # Whoever last touched the row, not necessarily who first onboarded it —
    # every module is open-edit and reports the latest hand (CH-19). Paired with
    # `updated_at`, which the set_updated_at trigger maintains.
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime
