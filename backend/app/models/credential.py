import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.client import Client
from app.models.portal import Portal
from app.models.user import User


class Credential(Base):
    __tablename__ = "credentials"

    id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), primary_key=True, server_default=text("uuid_generate_v4()")
    )
    client_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("clients.id", ondelete="CASCADE"), nullable=False
    )
    portal_id: Mapped[uuid.UUID] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("portals.id", ondelete="RESTRICT"), nullable=False
    )
    login_identifier: Mapped[str | None] = mapped_column(String, nullable=True)
    # Plaintext per spec (PRD 4.3). Never returned by the list endpoint — see
    # app/schemas/credential.py and the encryption hardening item in ARCHITECTURE.md 7.
    password: Mapped[str] = mapped_column(String, nullable=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        PGUUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )

    # selectin (not joined) so filtering joins in list queries don't collide
    # with the loader's own joins.
    client: Mapped[Client] = relationship(Client, lazy="selectin")
    portal: Mapped[Portal] = relationship(Portal, lazy="selectin")
    creator: Mapped[User | None] = relationship(User, lazy="selectin")
