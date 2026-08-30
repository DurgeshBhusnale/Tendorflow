import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.client import Client
from app.models.user import User

dsc_key_status_enum = PGEnum(
    "Key Created",
    "Key Issued",
    "Key Returned",
    "Key Lost",
    name="dsc_key_status",
    create_type=False,
)


class DscKey(Base):
    __tablename__ = "dsc_keys"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    key_status: Mapped[str] = mapped_column(
        dsc_key_status_enum, nullable=False, server_default="Key Created"
    )
    storage_location_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Nullable, matching every other created_by — see the note in
    # DATABASE_SCHEMA.md; `not null` with `on delete set null` was contradictory.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    client: Mapped[Client] = relationship(Client, lazy="selectin")
    creator: Mapped[User | None] = relationship(User, lazy="selectin")
