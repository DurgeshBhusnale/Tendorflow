import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import Computed, DateTime, ForeignKey, Integer, Numeric, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.client import Client
from app.models.tender_department import TenderDepartment
from app.models.user import User

tender_status_enum = PGEnum(
    "Paid", "Pending", "Partially Paid", name="tender_status", create_type=False
)
payment_mode_enum = PGEnum("Cash", "Online", name="payment_mode", create_type=False)


class Tender(Base):
    __tablename__ = "tenders"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    tender_department_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True),
        ForeignKey("tender_departments.id", ondelete="RESTRICT"),
        nullable=False,
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
    # How much of total_amount has actually been received. A DB CHECK ties it to
    # `status` (see migration e4d0f6a2743b), so the service must keep the two in
    # step — tender_service._normalize_payment() is the single place that does.
    paid_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), nullable=False, server_default=text("0")
    )
    # Restates quantity * price rather than reading total_amount: Postgres does
    # not let one generated column reference another.
    remaining_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2), Computed("quantity * price - paid_amount", persisted=True)
    )
    status: Mapped[str] = mapped_column(
        tender_status_enum, nullable=False, server_default="Pending"
    )
    # Null only for Pending tenders, and for rows paid before CH-06 added the
    # field — those predate any record of how the money arrived.
    payment_mode: Mapped[str | None] = mapped_column(payment_mode_enum, nullable=True)
    # Overwritten with whoever last edited the row: every module is open-edit
    # and reports the latest hand that touched it (CH-19).
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
    tender_department: Mapped[TenderDepartment] = relationship(TenderDepartment, lazy="selectin")
    creator: Mapped[User | None] = relationship(User, lazy="selectin")
