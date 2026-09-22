"""create expenses table

CH-27: what the business spends, logged against a date with a note saying where
the money went. Admin-only in its entirety — this is the cost side of the same
ledger whose revenue totals are already withheld from employees (CH-12).

`details` is unbounded text on purpose: it is the answer to "what was this for",
and a length cap would only ever truncate the explanation someone needs later.

`expense_date` mirrors tenders.tender_date (CH-22) — the day the money was
spent, which is not necessarily the day it was typed in, and the column the
date-range filter and the ordering use. Its default is the IST day.

Revision ID: e1f5a8d3b942
Revises: d9e4f7c2a831
Create Date: 2026-09-22 10:05:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e1f5a8d3b942"
down_revision: str | Sequence[str] | None = "d9e4f7c2a831"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Creating a type and using it in the same transaction is fine; only
    # ALTER TYPE ... ADD VALUE is not (DATABASE_SCHEMA.md 7).
    op.execute("create type expense_status as enum ('Paid', 'Pending')")
    op.execute(
        """
        create table expenses (
          id            uuid primary key default uuid_generate_v4(),
          amount        numeric(12,2) not null check (amount >= 0),
          details       text not null,
          status        expense_status not null default 'Pending',
          expense_date  date not null default ((now() at time zone 'Asia/Kolkata')::date),
          created_by    uuid references users (id) on delete set null,
          created_at    timestamptz not null default now(),
          updated_at    timestamptz not null default now()
        )
        """
    )
    # Matches the list ordering: business date first, entry time as the tiebreak.
    op.execute(
        "create index idx_expenses_expense_date on expenses (expense_date desc, created_at desc)"
    )
    op.execute("create index idx_expenses_status on expenses (status)")
    op.execute("create index idx_expenses_created_by on expenses (created_by)")
    op.execute(
        "create trigger trg_expenses_updated_at before update on expenses "
        "for each row execute function set_updated_at()"
    )
    # See DATABASE_SCHEMA.md 3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table expenses enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists expenses")
    op.execute("drop type if exists expense_status")
