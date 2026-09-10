"""add paid_amount, remaining_amount and payment_mode to tenders

Backs the 'Partially Paid' status (CH-05) and the cash/online capture (CH-06).

`remaining_amount` is a second generated column. It restates `quantity * price`
rather than reading `total_amount`, because Postgres forbids one generated
column from referencing another.

The paid/status CHECK is deliberate: it makes it impossible to store a Paid
tender that isn't fully paid, or a Partially Paid tender that is. Existing Paid
rows are backfilled to their own total first, which is definitionally correct
and invents nothing.

`payment_mode` gets no matching CHECK on purpose. Rows paid before this
migration carry no record of *how* they were paid, and defaulting them to
'Cash' would fabricate business data. It is required going forward by the
Pydantic layer (schemas/tender.py) and left null on those legacy rows.

Revision ID: e4d0f6a2743b
Revises: d3c9e5f1632a
Create Date: 2026-09-10 10:15:47.203866

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e4d0f6a2743b"
down_revision: str | Sequence[str] | None = "d3c9e5f1632a"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("create type payment_mode as enum ('Cash', 'Online')")

    op.execute("alter table tenders add column paid_amount numeric(14,2) not null default 0")
    op.execute("update tenders set paid_amount = quantity * price where status = 'Paid'")

    op.execute(
        "alter table tenders add column remaining_amount numeric(14,2) "
        "generated always as (quantity * price - paid_amount) stored"
    )
    op.execute("alter table tenders add column payment_mode payment_mode")

    op.execute(
        """
        alter table tenders add constraint tenders_paid_amount_consistent check (
          (status = 'Pending' and paid_amount = 0)
          or (status = 'Partially Paid' and paid_amount > 0 and paid_amount < quantity * price)
          or (status = 'Paid' and paid_amount = quantity * price)
        )
        """
    )

    # The tenders list is filtered by date range and always ordered by
    # created_at desc (CH-11).
    op.execute("create index idx_tenders_created_at on tenders (created_at desc)")


def downgrade() -> None:
    op.execute("drop index if exists idx_tenders_created_at")
    op.execute("alter table tenders drop constraint if exists tenders_paid_amount_consistent")
    op.execute("alter table tenders drop column if exists payment_mode")
    op.execute("alter table tenders drop column if exists remaining_amount")
    op.execute("alter table tenders drop column if exists paid_amount")
    op.execute("drop type if exists payment_mode")
