"""enable row level security on users and alembic_version tables

Supabase auto-exposes every public table via PostgREST, gated by the
anon/authenticated Postgres roles used by Supabase client libraries. Our
backend never uses PostgREST (it connects directly as the postgres role,
which owns these tables and is exempt from its own RLS by default), so
enabling RLS with no policies fully blocks that exposure without touching
our own access. This is a hosting-specific hardening step, distinct from
the app-level authorization decision in DATABASE_SCHEMA.md #3 (which
remains: no RLS-based *authorization*, that stays in the FastAPI service
layer).

Revision ID: 46d416635855
Revises: 2ebc1fa7615f
Create Date: 2026-08-30 16:57:25.545602

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "46d416635855"
down_revision: str | Sequence[str] | None = "2ebc1fa7615f"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table users enable row level security")
    op.execute("alter table alembic_version enable row level security")


def downgrade() -> None:
    op.execute("alter table alembic_version disable row level security")
    op.execute("alter table users disable row level security")
