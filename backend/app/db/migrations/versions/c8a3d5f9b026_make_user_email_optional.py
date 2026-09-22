"""make user email optional

CH-25: email is a contact address, not a credential (sign-in has been by
username since CH-02), and not every account holder has one. The column stays
unique — Postgres treats NULLs as distinct, so any number of accounts may leave
it empty while two accounts still cannot share an address.

Revision ID: c8a3d5f9b026
Revises: b7f2c4e8a915
Create Date: 2026-09-20 10:05:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c8a3d5f9b026"
down_revision: str | Sequence[str] | None = "b7f2c4e8a915"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table users alter column email drop not null")


def downgrade() -> None:
    # Fails while any user has no email. That is deliberate: inventing an
    # address to satisfy the constraint would be worse than refusing.
    op.execute("alter table users alter column email set not null")
