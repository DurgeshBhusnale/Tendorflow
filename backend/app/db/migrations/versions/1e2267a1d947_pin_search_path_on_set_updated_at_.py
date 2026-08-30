"""pin search_path on set_updated_at function

Closes Supabase's `function_search_path_mutable` advisor warning. A function
with a role-mutable search_path can resolve unqualified names against a schema
an attacker controls; pinning it to empty removes that. The body only calls
`now()`, which lives in pg_catalog and is always resolvable regardless of
search_path, so nothing in the function needs to change.

Revision ID: 1e2267a1d947
Revises: 9761e57c6016
Create Date: 2026-08-30 18:31:02.118374

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "1e2267a1d947"
down_revision: str | Sequence[str] | None = "9761e57c6016"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter function set_updated_at() set search_path = ''")


def downgrade() -> None:
    op.execute("alter function set_updated_at() reset search_path")
