from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class TenderDepartmentCreate(BaseModel):
    name: str = Field(min_length=1, max_length=120)


class TenderDepartmentUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=120)
    is_active: bool | None = None


class TenderDepartmentRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    is_active: bool
    created_at: datetime
