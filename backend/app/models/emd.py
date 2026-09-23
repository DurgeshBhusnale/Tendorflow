import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import Date, DateTime, ForeignKey, Numeric, String, Text, func, text
from sqlalchemy.dialects.postgresql import ENUM as PGEnum
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.user import User

emd_status_enum = PGEnum("With Us", "Returned", name="emd_status", create_type=False)


class Emd(Base):
    """An earnest money deposit held on a client's behalf (CH-30)."""

    __tablename__ = "emds"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    # Typed in full rather than linked to a client record (CH-33): a deposit
    # often arrives with someone who is not on file yet, and the office would
    # rather write the name down than stop to onboard a client first. The
    # cost is that these are strings — no cascade, no filtering by client
    # entity, and two spellings are two different companies.
    client_name: Mapped[str] = mapped_column(String, nullable=False)
    company_name: Mapped[str] = mapped_column(String, nullable=False)
    contact_number: Mapped[str] = mapped_column(String, nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(12, 2), nullable=False)
    status: Mapped[str] = mapped_column(emd_status_enum, nullable=False, server_default="With Us")
    # The day the deposit was taken (CH-30), which the date filter and the
    # ordering use. Defaults to the IST day.
    emd_date: Mapped[date] = mapped_column(
        Date, nullable=False, server_default=text("((now() at time zone 'Asia/Kolkata')::date)")
    )
    # Which account the deposit was actually paid into (CH-33). Free text and
    # optional: it is a note, and the detail arrives in whatever shape the
    # bank gave it.
    paid_to_bank_account: Mapped[str | None] = mapped_column(Text, nullable=True)
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
