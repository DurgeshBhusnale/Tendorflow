"""create portals and tender_names tables

Seeds tender_names with the three baseline values from DATABASE_SCHEMA.md #6
(seed data lives in a migration, not a separate script, so every environment
starts from the same baseline). Portals are not seeded — they're entirely
admin-managed from the UI.

Revision ID: 9761e57c6016
Revises: a65a21bacdc7
Create Date: 2026-08-30 18:12:44.901233

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "9761e57c6016"
down_revision: str | Sequence[str] | None = "a65a21bacdc7"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        create table portals (
          id              uuid primary key default uuid_generate_v4(),
          name            text not null unique,
          is_active       boolean not null default true,
          created_by      uuid references users (id) on delete set null,
          created_at      timestamptz not null default now()
        )
        """
    )
    op.execute(
        """
        create table tender_names (
          id              uuid primary key default uuid_generate_v4(),
          name            text not null unique,
          is_active       boolean not null default true,
          created_by      uuid references users (id) on delete set null,
          created_at      timestamptz not null default now()
        )
        """
    )

    op.execute(
        """
        insert into tender_names (name) values
          ('PMC'), ('Civil-Works'), ('Govt-Supply')
        on conflict (name) do nothing
        """
    )

    # See DATABASE_SCHEMA.md #3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table portals enable row level security")
    op.execute("alter table tender_names enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists tender_names")
    op.execute("drop table if exists portals")
