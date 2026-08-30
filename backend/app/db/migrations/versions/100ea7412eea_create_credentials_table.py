"""create credentials table

Revision ID: 100ea7412eea
Revises: 1e2267a1d947
Create Date: 2026-08-30 18:52:17.640288

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "100ea7412eea"
down_revision: str | Sequence[str] | None = "1e2267a1d947"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # portal_id is ON DELETE RESTRICT: a portal referenced by any credential
    # cannot be deleted, admins deactivate it instead (DATABASE_SCHEMA.md 2).
    op.execute(
        """
        create table credentials (
          id                  uuid primary key default uuid_generate_v4(),
          client_id           uuid not null references clients (id) on delete cascade,
          portal_id           uuid not null references portals (id) on delete restrict,
          login_identifier    text,
          password            text not null,
          created_by          uuid references users (id) on delete set null,
          created_at          timestamptz not null default now(),
          updated_at          timestamptz not null default now()
        )
        """
    )
    op.execute("create index idx_credentials_client_id on credentials (client_id)")
    op.execute("create index idx_credentials_portal_id on credentials (portal_id)")
    op.execute("create index idx_credentials_created_by on credentials (created_by)")
    op.execute(
        "create trigger trg_credentials_updated_at before update on credentials "
        "for each row execute function set_updated_at()"
    )
    # See DATABASE_SCHEMA.md 3 — RLS on with no policies blocks Supabase's
    # PostgREST surface. Especially important here: this table holds plaintext
    # portal passwords, which must never be reachable via the public anon key.
    op.execute("alter table credentials enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists credentials")
