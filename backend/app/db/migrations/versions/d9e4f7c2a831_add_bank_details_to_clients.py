"""add bank_details to clients

CH-26: the bank account a client pays from or is paid into, kept as free text
because these arrive as whatever the client sends — an account number and IFSC,
a UPI handle, or a paragraph naming the branch. Structuring it would mean
rejecting half of what people actually have to record.

Nullable: every existing client predates the field, and it stays optional
afterwards because the details often arrive later than the client does.

Revision ID: d9e4f7c2a831
Revises: c8a3d5f9b026
Create Date: 2026-09-22 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d9e4f7c2a831"
down_revision: str | Sequence[str] | None = "c8a3d5f9b026"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table clients add column bank_details text")


def downgrade() -> None:
    op.execute("alter table clients drop column if exists bank_details")
