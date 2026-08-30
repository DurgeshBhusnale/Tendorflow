"""create extensions and enum types

Revision ID: e05fca814ac4
Revises:
Create Date: 2026-08-30 15:36:37.027806

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "e05fca814ac4"
down_revision: str | Sequence[str] | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute('create extension if not exists "uuid-ossp"')
    op.execute('create extension if not exists "pgcrypto"')

    op.execute("create type user_role as enum ('admin', 'employee')")
    op.execute("create type tender_status as enum ('Paid', 'Pending')")
    op.execute(
        "create type dsc_key_status as enum "
        "('Key Created', 'Key Issued', 'Key Returned', 'Key Lost')"
    )

    op.execute(
        """
        create or replace function set_updated_at()
        returns trigger language plpgsql as $$
        begin
          new.updated_at = now();
          return new;
        end;
        $$;
        """
    )


def downgrade() -> None:
    op.execute("drop function if exists set_updated_at()")

    op.execute("drop type if exists dsc_key_status")
    op.execute("drop type if exists tender_status")
    op.execute("drop type if exists user_role")

    op.execute('drop extension if exists "pgcrypto"')
    op.execute('drop extension if exists "uuid-ossp"')
