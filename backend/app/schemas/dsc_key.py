from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.client import CreatorRef
from app.schemas.credential import ClientRef
from app.schemas.validators import normalize_phone

# 'Key Lost' is retired (CH-15). The value still exists in the Postgres enum —
# it cannot be dropped in place without rebuilding the type — but nothing may
# write it any more, so it is absent here. DscKeyRead.key_status is a plain
# `str` precisely so a legacy row still in that state can still be read.
DscKeyStatus = Literal["Key Created", "Key Issued", "Key Returned"]

DscEventType = Literal["Created", "Issued", "Returned"]

# Statuses that mean the key is physically present in the office. Used by the
# dashboard's "DSC Keys in Office" metric (PRD 4.6).
IN_OFFICE_STATUSES: tuple[DscKeyStatus, ...] = ("Key Created", "Key Returned")

# Which event a status change records. 'Key Created' is only ever the opening
# state, written by create_dsc_key itself.
STATUS_EVENT_TYPES: dict[str, DscEventType] = {
    "Key Issued": "Issued",
    "Key Returned": "Returned",
}


def validate_issuance(
    key_status: str | None, issued_to: str | None, issued_phone: str | None
) -> None:
    """Enforce that an issuance names the person holding the key.

    Mandatory on 'Key Issued' — a key out of the office with no record of who
    has it is the failure this module exists to prevent — and optional on
    'Key Returned', where the details are a nice-to-have. Raises ValueError.
    """
    if key_status == "Key Issued":
        if not issued_to:
            raise ValueError("Enter who this key is being issued to.")
        if not issued_phone:
            raise ValueError("Enter a contact number for the person receiving this key.")
    elif key_status == "Key Created" and (issued_to or issued_phone):
        raise ValueError("Issuance details only apply when a key is issued or returned.")


class DscKeyCreate(BaseModel):
    client_id: UUID
    key_status: DscKeyStatus = "Key Created"
    storage_location_notes: str | None = Field(default=None, max_length=500)
    issued_to: str | None = Field(default=None, max_length=120)
    issued_phone: str | None = Field(default=None, max_length=20)

    @field_validator("issued_phone")
    @classmethod
    def validate_issued_phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else None

    @model_validator(mode="after")
    def check_issuance(self) -> "DscKeyCreate":
        validate_issuance(self.key_status, self.issued_to, self.issued_phone)
        return self


class DscKeyUpdate(BaseModel):
    client_id: UUID | None = None
    key_status: DscKeyStatus | None = None
    storage_location_notes: str | None = Field(default=None, max_length=500)
    issued_to: str | None = Field(default=None, max_length=120)
    issued_phone: str | None = Field(default=None, max_length=20)

    @field_validator("issued_phone")
    @classmethod
    def validate_issued_phone(cls, v: str | None) -> str | None:
        return normalize_phone(v) if v else None

    @model_validator(mode="after")
    def check_issuance(self) -> "DscKeyUpdate":
        # key_status is None on an edit that doesn't touch the lifecycle (a
        # storage-location correction, say); validate_issuance ignores that.
        validate_issuance(self.key_status, self.issued_to, self.issued_phone)
        return self


class DscKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    key_status: str
    storage_location_notes: str | None
    # Last editor, not original author — every module is open-edit (CH-19).
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
    updated_at: datetime


class DscKeyEventRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_type: str
    issued_to: str | None
    issued_phone: str | None
    notes: str | None
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
