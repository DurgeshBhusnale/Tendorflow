"""add payer details to tenders

CH-32: whoever physically comes in to pay is not always the same person, and is
often not the client's standing contact. Both fields are optional — plenty of
tenders are settled by transfer with nobody walking in — and they are notes
about the payment, not a second client record.

Revision ID: a1b2c3d4e5f6
Revises: f2a6c9d4e853
Create Date: 2026-09-24 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a1b2c3d4e5f6"
down_revision: str | Sequence[str] | None = "f2a6c9d4e853"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table tenders add column payer_name text")
    # Ten digits when present, same rule as every other phone field (CH-17).
    op.execute("alter table tenders add column payer_contact text")


def downgrade() -> None:
    op.execute("alter table tenders drop column if exists payer_contact")
    op.execute("alter table tenders drop column if exists payer_name")
