from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.client import CreatorRef
from app.schemas.credential import ClientRef

DscKeyStatus = Literal["Key Created", "Key Issued", "Key Returned", "Key Lost"]

# Statuses that mean the key is physically present in the office. Used by the
# dashboard's "DSC Keys in Office" metric (PRD 4.6).
IN_OFFICE_STATUSES: tuple[DscKeyStatus, ...] = ("Key Created", "Key Returned")


class DscKeyCreate(BaseModel):
    client_id: UUID
    key_status: DscKeyStatus = "Key Created"
    storage_location_notes: str | None = Field(default=None, max_length=500)


class DscKeyUpdate(BaseModel):
    client_id: UUID | None = None
    key_status: DscKeyStatus | None = None
    storage_location_notes: str | None = Field(default=None, max_length=500)


class DscKeyRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    key_status: str
    storage_location_notes: str | None
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime
