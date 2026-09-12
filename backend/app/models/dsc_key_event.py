import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, FetchedValue, ForeignKey, Text, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User

dsc_event_type_enum = PGEnum(
    "Created", "Issued", "Returned", name="dsc_event_type", create_type=False
)


class DscKeyEvent(Base):
    """One entry in a DSC key's history (CH-18).

    Append-only. `dsc_keys.key_status` remains the current-state
    denormalization so the list query needs no join; this is the record of how
    the key reached that state, and who it went to on the way.
    """

    __tablename__ = "dsc_key_events"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    # What the history is ordered by. `created_at` cannot do it: its default is
    # transaction-scoped, so events written together share a timestamp exactly.
    # Assigned by a Postgres sequence, so FetchedValue keeps it out of INSERT.
    seq: Mapped[int] = mapped_column(BigInteger, FetchedValue(), nullable=False)
    dsc_key_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("dsc_keys.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(dsc_event_type_enum, nullable=False)
    # Mandatory on 'Issued' (enforced by a DB CHECK as well as the schema),
    # optional on 'Returned', unused on 'Created'.
    issued_to: Mapped[str | None] = mapped_column(Text, nullable=True)
    issued_phone: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    creator: Mapped[User | None] = relationship(User, lazy="selectin")
