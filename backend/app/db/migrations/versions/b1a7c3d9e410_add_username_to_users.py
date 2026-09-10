"""add username to users

Login moves from email to username (CH-02). Email stays required and unique —
it is still the contact address — but it is no longer the credential.

The column lands nullable, gets backfilled from the email local-part, and is
only then marked `not null`. A one-shot `add column ... not null` would fail on
any existing row, and this repo's database carries committed demo/smoke data
(DEVELOPMENT_GUIDE.md section 5) that has to survive the migration.

Revision ID: b1a7c3d9e410
Revises: 231c461152bd
Create Date: 2026-09-10 10:02:11.417820

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b1a7c3d9e410"
down_revision: str | Sequence[str] | None = "231c461152bd"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table users add column username text")

    # Backfill: lowercase the email local-part, drop anything outside the
    # allowed alphabet, and suffix duplicates with their ordinal so the unique
    # index below can be created. `nullif(..., '')` catches an address whose
    # local-part is entirely punctuation; those fall back to 'user'.
    op.execute(
        """
        with normalized as (
          select
            id,
            created_at,
            coalesce(
              nullif(
                left(regexp_replace(lower(split_part(email, '@', 1)), '[^a-z0-9._-]', '', 'g'), 28),
                ''
              ),
              'user'
            ) as base
          from users
        ),
        candidates as (
          select
            id,
            base,
            row_number() over (partition by base order by created_at, id) as rn
          from normalized
        )
        update users u
        set username = case when c.rn = 1 then c.base else c.base || c.rn::text end
        from candidates c
        where u.id = c.id
        """
    )

    # The alphabet allows 3-30 chars; a 1- or 2-character local-part is legal in
    # an email address, so pad rather than let the app's own validator reject a
    # username it generated itself.
    op.execute("update users set username = rpad(username, 3, '0') where length(username) < 3")

    op.execute("alter table users alter column username set not null")
    op.execute("create unique index idx_users_username on users (username)")


def downgrade() -> None:
    op.execute("drop index if exists idx_users_username")
    op.execute("alter table users drop column if exists username")
