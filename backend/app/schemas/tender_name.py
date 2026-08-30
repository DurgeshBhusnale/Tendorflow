from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenderNameCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TenderNameUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None


class TenderNameRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_active: bool
    created_at: datetime
