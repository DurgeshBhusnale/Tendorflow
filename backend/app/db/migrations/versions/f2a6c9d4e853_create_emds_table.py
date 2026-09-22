"""create emds table

CH-30: an EMD (earnest money deposit) is money taken from a client so the
deposit can be paid online at submission time. The business holds it until it
goes back, so the row's whole purpose is answering "is this still with us".

Open-edit like tenders rather than admin-only like expenses: whoever takes the
deposit or hands it back records it, and deletion stays admin-only (CH-19).

`contact_number` is stored on the row rather than read from the client, because
the person handing over or collecting a deposit is not always the client's
standing contact. It follows the same Indian-mobile rule as every other phone
field (CH-17) and is stored as bare ten digits.

Revision ID: f2a6c9d4e853
Revises: e1f5a8d3b942
Create Date: 2026-09-22 12:00:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f2a6c9d4e853"
down_revision: str | Sequence[str] | None = "e1f5a8d3b942"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Creating a type and using it in the same transaction is fine; only
    # ALTER TYPE ... ADD VALUE is not (DATABASE_SCHEMA.md 7).
    op.execute("create type emd_status as enum ('With Us', 'Returned')")
    op.execute(
        """
        create table emds (
          id              uuid primary key default uuid_generate_v4(),
          client_id       uuid not null references clients (id) on delete cascade,
          -- Ten digits, same rule as every other phone field.
          contact_number  text not null,
          amount          numeric(12,2) not null check (amount >= 0),
          status          emd_status not null default 'With Us',
          -- The day the deposit was taken, not the day it was typed in — the
          -- same split as tenders.tender_date. Defaults to the IST day.
          emd_date        date not null default ((now() at time zone 'Asia/Kolkata')::date),
          created_by      uuid references users (id) on delete set null,
          created_at      timestamptz not null default now(),
          updated_at      timestamptz not null default now()
        )
        """
    )
    op.execute("create index idx_emds_client_id on emds (client_id)")
    op.execute("create index idx_emds_status on emds (status)")
    op.execute("create index idx_emds_created_by on emds (created_by)")
    # Matches the list ordering: deposit date first, entry time as the tiebreak.
    op.execute("create index idx_emds_emd_date on emds (emd_date desc, created_at desc)")
    op.execute(
        "create trigger trg_emds_updated_at before update on emds "
        "for each row execute function set_updated_at()"
    )
    # See DATABASE_SCHEMA.md 3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table emds enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists emds")
    op.execute("drop type if exists emd_status")
