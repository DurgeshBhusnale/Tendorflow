import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Integer, Numeric, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.client import Client
from app.models.tender_name import TenderName
from app.models.user import User

tender_status_enum = PGEnum("Paid", "Pending", name="tender_status", create_type=False)


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    tender_name_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("tender_names.id", ondelete="RESTRICT"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Postgres GENERATED ALWAYS ... STORED. Never written by the app: SQLAlchemy
    # omits Computed columns from INSERT/UPDATE, so quantity * price is the only
    # source of this value. Alembic can't autogenerate this — see
    # DATABASE_SCHEMA.md 5 and the hand-written migration.
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), Computed("quantity * price", persisted=True)
    )
    status: Mapped[str] = mapped_column(
        tender_status_enum, nullable=False, server_default="Pending"
    )
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
    tender_name: Mapped[TenderName] = relationship(TenderName, lazy="selectin")
    creator: Mapped[User | None] = relationship(User, lazy="selectin")
