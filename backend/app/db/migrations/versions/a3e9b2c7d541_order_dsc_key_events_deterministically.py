"""order dsc_key_events deterministically

`created_at` cannot order this log. Its default was `now()`, which in Postgres
is *transaction start time* and is therefore identical for every row written in
one transaction — and creating a key that is already issued writes its 'Created'
and 'Issued' events together. With equal timestamps the query fell back to
`id desc` on a random UUID, so the two events came back in arbitrary order and
the history panel could show a key issued before it was logged.

Two changes, each fixing a different half:

- `seq bigserial` is what the history is now ordered by. A sequence is
  monotonic, is not transactional, and does not depend on clock resolution, so
  the order is exact no matter how many events share a transaction.
- `created_at` moves to `clock_timestamp()`, which is evaluated per statement
  rather than per transaction, so the times *displayed* against same-transaction
  events are distinct and truthful too.

Existing rows are numbered by `ADD COLUMN ... bigserial` in physical order. They
are all backfilled 'Created' events, one per key, so their relative order
carries no meaning to preserve.

Revision ID: a3e9b2c7d541
Revises: f5e1a7b3854c
Create Date: 2026-09-10 10:31:08.662140

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a3e9b2c7d541"
down_revision: str | Sequence[str] | None = "f5e1a7b3854c"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table dsc_key_events add column seq bigserial not null")
    op.execute("alter table dsc_key_events alter column created_at set default clock_timestamp()")

    # Replaces the created_at index: nothing orders by timestamp any more.
    op.execute("drop index if exists idx_dsc_key_events_key")
    op.execute("create index idx_dsc_key_events_key on dsc_key_events (dsc_key_id, seq desc)")


def downgrade() -> None:
    op.execute("drop index if exists idx_dsc_key_events_key")
    op.execute(
        "create index idx_dsc_key_events_key on dsc_key_events (dsc_key_id, created_at desc)"
    )
    op.execute("alter table dsc_key_events alter column created_at set default now()")
    op.execute("alter table dsc_key_events drop column if exists seq")
