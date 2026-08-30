from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class PortalCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class PortalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None


class PortalRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_active: bool
    created_at: datetime
