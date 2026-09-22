import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, Text, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User

expense_status_enum = PGEnum("Paid", "Pending", name="expense_status", create_type=False)


class Expense(Base):
    """A business cost (CH-27). Admin-only across the API and the UI."""

    __tablename__ = "expenses"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    # Unbounded: this is the answer to "what was this for", and a cap would
    # truncate the one thing that makes an old row legible.
    details: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(
        expense_status_enum, nullable=False, server_default="Pending"
    )
    # The day the money was spent, not the day it was logged — same split as
    # tenders.tender_date (CH-22). Defaults to the IST day.
    expense_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=text("((now() at time zone 'Asia/Kolkata')::date)")
    )
    # Overwritten with whoever last edited the row, like every other module.
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    creator: Mapped[User | None] = relationship(User, lazy="selectin")
