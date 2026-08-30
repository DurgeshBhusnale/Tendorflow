"""create dsc_keys table

created_by is nullable here, unlike the original DDL in DATABASE_SCHEMA.md
which declared it `not null ... on delete set null`. Those contradict: if a
referenced user were ever deleted, Postgres would try to write null into a
non-nullable column and the delete would fail. Confirmed with the product
owner to drop `not null`, matching every other table's created_by.

Revision ID: 231c461152bd
Revises: 9c5581b01a80
Create Date: 2026-08-30 19:44:03.271854

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "231c461152bd"
down_revision: str | Sequence[str] | None = "9c5581b01a80"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        create table dsc_keys (
          id                      uuid primary key default uuid_generate_v4(),
          client_id               uuid not null references clients (id) on delete cascade,
          key_status              dsc_key_status not null default 'Key Created',
          storage_location_notes  text,
          created_by              uuid references users (id) on delete set null,
          created_at              timestamptz not null default now(),
          updated_at              timestamptz not null default now()
        )
        """
    )
    op.execute("create index idx_dsc_keys_client_id on dsc_keys (client_id)")
    op.execute("create index idx_dsc_keys_created_by on dsc_keys (created_by)")
    op.execute(
        "create trigger trg_dsc_keys_updated_at before update on dsc_keys "
        "for each row execute function set_updated_at()"
    )
    # See DATABASE_SCHEMA.md 3 — RLS on with no policies blocks Supabase's
    # PostgREST surface; app authorization stays in the FastAPI service layer.
    op.execute("alter table dsc_keys enable row level security")


def downgrade() -> None:
    op.execute("drop table if exists dsc_keys")
