"""add 'Partially Paid' to the tender_status enum

Deliberately alone in its own revision, and deliberately inside an autocommit
block. Postgres forbids *using* a newly added enum value until the transaction
that added it has committed, and the very next migration writes a CHECK
constraint naming 'Partially Paid'.

A separate revision is not sufficient on its own: Alembic runs the whole
upgrade chain in a single transaction, so `alembic upgrade head` from a state
before this revision would still fail with UnsafeNewEnumValueUsageError.
`autocommit_block()` is what actually ends the transaction here, which is why
this cannot simply be folded into the next migration.

Revision ID: d3c9e5f1632a
Revises: c2b8d4e0f521
Create Date: 2026-09-10 10:11:24.550319

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d3c9e5f1632a"
down_revision: str | Sequence[str] | None = "c2b8d4e0f521"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.get_context().autocommit_block():
        op.execute("alter type tender_status add value if not exists 'Partially Paid'")


def downgrade() -> None:
    # Postgres cannot drop a value from an enum in place; undoing this means
    # rebuilding the type, which would require rewriting every dependent column.
    # Not worth it for a forward-only prototype — the value is simply left.
    pass
