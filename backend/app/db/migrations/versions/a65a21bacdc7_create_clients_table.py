"""create clients table

Revision ID: a65a21bacdc7
Revises: 46d416635855
Create Date: 2026-08-30 17:42:11.284919

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a65a21bacdc7"
down_revision: str | Sequence[str] | None = "46d416635855"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        create table clients (
          id                     uuid primary key default uuid_generate_v4(),
          contact_person_name    text not null,
          company_name           text not null,
          contact_number         text not null,
          email                  text not null unique,
          created_by             uuid references users (id) on delete set null,
          created_at             timestamptz not null default now(),
          updated_at             timestamptz not null default now()
        )
        """
    )
    op.execute("create index idx_clients_company_name on clients (company_name)")
    op.execute("create index idx_clients_email on clients (email)")
    op.execute("create index idx_clients_created_by on clients (created_by)")
    op.execute(
        "create trigger trg_clients_updated_at before update on clients "
        "for each row execute function set_updated_at()"
    )
    # See DATABASE_SCHEMA.md #3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table clients enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists clients")
