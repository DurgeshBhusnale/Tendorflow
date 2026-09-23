"""emd client details become manual text

CH-33: an EMD is now typed in full — client name, company and contact number are
free text rather than a link to a client record, because a deposit often arrives
with someone who is not on file yet, and the office would rather write the name
down than stop to onboard a client first.

The trade-off, recorded here because it is not obvious later: these rows no
longer point at `clients`. Deleting a client therefore no longer removes their
deposits, filtering by client entity is gone (search covers the text instead),
and two spellings of the same company are two different strings. That is the
cost of letting the form accept anything.

Existing rows are backfilled from the client they referenced, so nothing that
was already logged loses its names.

Also adds `paid_to_bank_account`: which account the deposit was actually paid
into. Free text and optional — it is a note, and the detail arrives in whatever
shape the bank gave it.

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-09-24 10:05:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b2c3d4e5f6a7"
down_revision: str | Sequence[str] | None = "a1b2c3d4e5f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.execute("alter table emds add column client_name text")
    op.execute("alter table emds add column company_name text")
    op.execute("alter table emds add column paid_to_bank_account text")
    # Every existing row has a client (client_id was not null), so nothing is
    # left without names.
    op.execute(
        """
        update emds e
           set client_name = c.contact_person_name,
               company_name = c.company_name
          from clients c
         where c.id = e.client_id
        """
    )
    # Belt and braces for any row the join somehow missed, so the NOT NULL below
    # cannot fail on production data.
    op.execute("update emds set client_name = '' where client_name is null")
    op.execute("update emds set company_name = '' where company_name is null")
    op.execute("alter table emds alter column client_name set not null")
    op.execute("alter table emds alter column company_name set not null")

    op.execute("drop index if exists idx_emds_client_id")
    op.execute("alter table emds drop column client_id")


def downgrade() -> None:
    """Re-adds the column but not the links — the client ids are gone for good."""
    op.execute(
        "alter table emds add column client_id uuid references clients (id) on delete cascade"
    )
    op.execute("create index idx_emds_client_id on emds (client_id)")
    op.execute("alter table emds drop column if exists paid_to_bank_account")
    op.execute("alter table emds drop column if exists company_name")
    op.execute("alter table emds drop column if exists client_name")
