from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_serializer

from app.schemas.client import CreatorRef
from app.schemas.credential import ClientRef

TenderStatus = Literal["Paid", "Pending"]


class TenderNameRef(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class TenderCreate(BaseModel):
    client_id: UUID
    tender_name_id: UUID
    quantity: int = Field(gt=0)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    status: TenderStatus = "Pending"
    # total_amount is deliberately absent: it is a Postgres generated column.
    # Pydantic ignores unknown keys, so sending it has no effect.


class TenderUpdate(BaseModel):
    client_id: UUID | None = None
    tender_name_id: UUID | None = None
    quantity: int | None = Field(default=None, gt=0)
    price: Decimal | None = Field(default=None, ge=0, max_digits=12, decimal_places=2)
    status: TenderStatus | None = None


class TenderRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    client: ClientRef
    tender_name: TenderNameRef
    quantity: int
    price: Decimal
    total_amount: Decimal
    status: str
    created_by: CreatorRef | None = Field(validation_alias="creator")
    created_at: datetime

    @field_serializer("price", "total_amount")
    def serialize_money(self, value: Decimal) -> str:
        """Money crosses the wire as a fixed-2dp string.

        Without this FastAPI's encoder would turn Decimal into a float and lose
        exactness — see the note in API_CONTRACT.md section 7.
        """
        return f"{value:.2f}"


class TenderSummary(BaseModel):
    total_pending_value: Decimal
    total_paid_value: Decimal
    pending_count: int
    paid_count: int

    @field_serializer("total_pending_value", "total_paid_value")
    def serialize_money(self, value: Decimal) -> str:
        return f"{value:.2f}"
