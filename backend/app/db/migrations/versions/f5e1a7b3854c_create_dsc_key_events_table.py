"""create dsc_key_events table

The audit trail behind the DSC key history panel (CH-18). `dsc_keys.key_status`
stays as the current-state denormalization so the list query needs no join;
this table is the append-only record of how it got there.

Every existing key is backfilled with a single 'Created' event so no key opens
to an empty history. Keys already sitting in 'Key Issued' get no synthetic
issuance event: who the key went to was never recorded, and the CHECK below
requires those details. Their history starts at creation and picks up real
detail from the next status change.

Revision ID: f5e1a7b3854c
Revises: e4d0f6a2743b
Create Date: 2026-09-10 10:21:36.744029

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f5e1a7b3854c"
down_revision: str | Sequence[str] | None = "e4d0f6a2743b"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("create type dsc_event_type as enum ('Created', 'Issued', 'Returned')")

    op.execute(
        """
        create table dsc_key_events (
          id            uuid primary key default uuid_generate_v4(),
          dsc_key_id    uuid not null references dsc_keys (id) on delete cascade,
          event_type    dsc_event_type not null,
          issued_to     text,
          issued_phone  text,
          notes         text,
          created_by    uuid references users (id) on delete set null,
          created_at    timestamptz not null default now(),
          constraint dsc_key_events_issued_details check (
            event_type <> 'Issued'
            or (issued_to is not null and issued_phone is not null)
          )
        )
        """
    )
    op.execute(
        "create index idx_dsc_key_events_key on dsc_key_events (dsc_key_id, created_at desc)"
    )
    op.execute("create index idx_dsc_key_events_created_by on dsc_key_events (created_by)")

    op.execute(
        """
        insert into dsc_key_events (dsc_key_id, event_type, notes, created_by, created_at)
        select id, 'Created', 'Backfilled when history tracking was added.', created_by, created_at
        from dsc_keys
        """
    )

    # See DATABASE_SCHEMA.md #3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table dsc_key_events enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists dsc_key_events")
    op.execute("drop type if exists dsc_event_type")
