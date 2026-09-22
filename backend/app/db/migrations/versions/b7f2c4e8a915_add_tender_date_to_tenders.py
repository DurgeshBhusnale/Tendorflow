"""add tender_date to tenders

CH-22: a tender is logged *for* a calendar day, which is not necessarily the day
someone typed it in. `created_at` cannot carry that — it is server-set and never
accepted from a client (root CLAUDE.md invariant 2) — so the business date gets
its own column, and `created_at` stays the audit timestamp.

Existing rows are backfilled with the IST day they were logged on, so the table,
the date filter and the ordering all look exactly as they did before.

The default is the IST calendar day, not the UTC one: between 00:00 and 05:30
IST those differ, and a tender logged at 01:00 IST belongs to that IST day.

Revision ID: b7f2c4e8a915
Revises: a3e9b2c7d541
Create Date: 2026-09-20 10:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7f2c4e8a915"
down_revision: str | Sequence[str] | None = "a3e9b2c7d541"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table tenders add column tender_date date")
    op.execute("update tenders set tender_date = (created_at at time zone 'Asia/Kolkata')::date")
    op.execute("alter table tenders alter column tender_date set not null")
    op.execute(
        "alter table tenders alter column tender_date "
        "set default ((now() at time zone 'Asia/Kolkata')::date)"
    )
    # Matches the list ordering: tender_date first, created_at as the tiebreak
    # among tenders logged for the same day.
    op.execute(
        "create index idx_tenders_tender_date on tenders (tender_date desc, created_at desc)"
    )


def downgrade() -> None:
    op.execute("drop index if exists idx_tenders_tender_date")
    op.execute("alter table tenders drop column if exists tender_date")
