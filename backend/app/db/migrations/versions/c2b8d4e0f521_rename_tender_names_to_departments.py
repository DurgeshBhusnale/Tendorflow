"""rename tender_names to tender_departments

The master list was always a list of departments a tender is filed with, not a
list of tender names (CH-04). Renaming the table, the FK column, and the
endpoint together keeps code, API and UI reading the same word.

Constraints and indexes do not follow a table rename in Postgres, so they are
renamed explicitly. The DO blocks make each rename idempotent: a database
restored from a dump taken at a different point could carry either name.

Revision ID: c2b8d4e0f521
Revises: b1a7c3d9e410
Create Date: 2026-09-10 10:07:53.882104

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "c2b8d4e0f521"
down_revision: str | Sequence[str] | None = "b1a7c3d9e410"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _rename_constraint(table: str, old: str, new: str) -> str:
    return f"""
        do $$
        begin
          if exists (
            select 1 from pg_constraint where conname = '{old}'
              and conrelid = '{table}'::regclass
          ) then
            alter table {table} rename constraint {old} to {new};
          end if;
        end $$;
    """


def upgrade() -> None:
    op.execute("alter table tender_names rename to tender_departments")
    op.execute("alter table tenders rename column tender_name_id to tender_department_id")

    op.execute("alter index if exists tender_names_pkey rename to tender_departments_pkey")
    op.execute("alter index if exists tender_names_name_key rename to tender_departments_name_key")
    op.execute(
        _rename_constraint(
            "tender_departments", "tender_names_name_key", "tender_departments_name_key"
        )
    )
    op.execute(
        _rename_constraint(
            "tender_departments",
            "tender_names_created_by_fkey",
            "tender_departments_created_by_fkey",
        )
    )
    op.execute(
        _rename_constraint(
            "tenders", "tenders_tender_name_id_fkey", "tenders_tender_department_id_fkey"
        )
    )


def downgrade() -> None:
    op.execute(
        _rename_constraint(
            "tenders", "tenders_tender_department_id_fkey", "tenders_tender_name_id_fkey"
        )
    )
    op.execute(
        _rename_constraint(
            "tender_departments",
            "tender_departments_created_by_fkey",
            "tender_names_created_by_fkey",
        )
    )
    op.execute(
        _rename_constraint(
            "tender_departments", "tender_departments_name_key", "tender_names_name_key"
        )
    )
    op.execute("alter index if exists tender_departments_pkey rename to tender_names_pkey")
    op.execute("alter table tenders rename column tender_department_id to tender_name_id")
    op.execute("alter table tender_departments rename to tender_names")
