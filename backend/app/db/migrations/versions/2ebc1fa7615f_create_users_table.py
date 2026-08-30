"""create users table

Revision ID: 2ebc1fa7615f
Revises: e05fca814ac4
Create Date: 2026-08-30 15:36:37.027806

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "2ebc1fa7615f"
down_revision: str | Sequence[str] | None = "e05fca814ac4"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute(
        """
        create table users (
          id              uuid primary key default uuid_generate_v4(),
          full_name       text not null,
          email           text not null unique,
          password_hash   text not null,
          role            user_role not null default 'employee',
          is_active       boolean not null default true,
          created_at      timestamptz not null default now(),
          updated_at      timestamptz not null default now()
        )
        """
    )
    op.execute("create index idx_users_email on users (email)")
    op.execute(
        "create trigger trg_users_updated_at before update on users "
        "for each row execute function set_updated_at()"
    )


def downgrade() -> None:
    op.execute("drop table if exists users")
