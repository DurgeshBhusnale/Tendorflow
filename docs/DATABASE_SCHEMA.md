# Database Schema

**Engine:** PostgreSQL 15+ (Supabase ).
**Migrations:** Alembic. Every schema change goes through a migration file — never hand-edit the DB.

The DDL below is the *reference*, describing what the schema should look like after all migrations have run. The actual schema is created/evolved via Alembic. See `backend/app/db/migrations/` and `docs/DEVELOPMENT_GUIDE.md` for the migration workflow.

---

## 1. Reference DDL

```sql
-- =========================================================
-- EXTENSIONS
-- =========================================================
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =========================================================
-- ENUM TYPES
-- =========================================================
create type user_role       as enum ('admin', 'employee');
create type tender_status   as enum ('Paid', 'Pending', 'Partially Paid');
create type payment_mode    as enum ('Cash', 'Online');
-- 'Key Lost' is retired: nothing may write it any more (see §7). The value
-- stays in the type because Postgres cannot drop an enum value in place, and
-- rows created before the change may still hold it.
create type dsc_key_status  as enum ('Key Created', 'Key Issued', 'Key Returned', 'Key Lost');
create type dsc_event_type  as enum ('Created', 'Issued', 'Returned');

-- =========================================================
-- 1.1 USERS  (application user accounts — NOT auth.users)
-- =========================================================
create table users (
  id              uuid primary key default uuid_generate_v4(),
  full_name       text not null,
  -- The login credential. Lowercased, 3-30 chars of [a-z0-9._-].
  username        text not null unique,
  -- Still required and unique as the contact address, but no longer a credential.
  email           text not null unique,
  password_hash   text not null,               -- bcrypt hash
  role            user_role not null default 'employee',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_users_email on users (email);
create unique index idx_users_username on users (username);

-- =========================================================
-- 1.2 CLIENTS
-- =========================================================
create table clients (
  id                     uuid primary key default uuid_generate_v4(),
  contact_person_name    text not null,
  company_name           text not null,
  contact_number         text not null,
  email                  text not null unique,
  created_by             uuid references users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index idx_clients_company_name on clients (company_name);
create index idx_clients_email on clients (email);
create index idx_clients_created_by on clients (created_by);

-- =========================================================
-- 1.3 PORTALS  (admin-managed master list)
-- =========================================================
create table portals (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null unique,
  is_active       boolean not null default true,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- =========================================================
-- 1.4 CREDENTIALS
-- =========================================================
create table credentials (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references clients (id) on delete cascade,
  portal_id           uuid not null references portals (id) on delete restrict,
  login_identifier    text,               -- optional
  password            text not null,      -- plaintext per spec; flagged for encryption
  created_by          uuid references users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_credentials_client_id on credentials (client_id);
create index idx_credentials_portal_id on credentials (portal_id);
create index idx_credentials_created_by on credentials (created_by);

-- =========================================================
-- 1.5 TENDER DEPARTMENTS  (admin-managed master list)
-- =========================================================
create table tender_departments (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null unique,
  is_active       boolean not null default true,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Static fallback seed
insert into tender_departments (name) values
  ('PMC'), ('Civil-Works'), ('Govt-Supply')
on conflict (name) do nothing;

-- =========================================================
-- 1.6 TENDERS
-- =========================================================
create table tenders (
  id                   uuid primary key default uuid_generate_v4(),
  client_id            uuid not null references clients (id) on delete cascade,
  tender_department_id uuid not null references tender_departments (id) on delete restrict,
  quantity             integer not null check (quantity > 0),
  price                numeric(12,2) not null check (price >= 0),
  total_amount         numeric(14,2) generated always as (quantity * price) stored,
  paid_amount          numeric(14,2) not null default 0,
  -- Restates quantity * price rather than reading total_amount: Postgres does
  -- not allow one generated column to reference another.
  remaining_amount     numeric(14,2) generated always as (quantity * price - paid_amount) stored,
  status               tender_status not null default 'Pending',
  -- Null for Pending tenders, and for rows paid before this column existed.
  payment_mode         payment_mode,
  created_by           uuid references users (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  -- Makes it impossible to store a Paid tender that isn't fully paid, or a
  -- Partially Paid one that is. The app must keep paid_amount in step whenever
  -- quantity, price or status changes.
  constraint tenders_paid_amount_consistent check (
    (status = 'Pending' and paid_amount = 0)
    or (status = 'Partially Paid' and paid_amount > 0 and paid_amount < quantity * price)
    or (status = 'Paid' and paid_amount = quantity * price)
  )
);

create index idx_tenders_client_id on tenders (client_id);
create index idx_tenders_status on tenders (status);
create index idx_tenders_created_by on tenders (created_by);
create index idx_tenders_created_at on tenders (created_at desc);

-- =========================================================
-- 1.7 DSC KEYS
-- =========================================================
create table dsc_keys (
  id                      uuid primary key default uuid_generate_v4(),
  client_id               uuid not null references clients (id) on delete cascade,
  key_status              dsc_key_status not null default 'Key Created',
  storage_location_notes  text,
  -- Nullable, like every other created_by. It was originally written as
  -- `not null ... on delete set null`, which contradicts itself: deleting a
  -- user would force a null into a non-nullable column and fail.
  created_by              uuid references users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_dsc_keys_client_id on dsc_keys (client_id);
create index idx_dsc_keys_created_by on dsc_keys (created_by);

-- =========================================================
-- 1.9 DSC KEY EVENTS  (append-only history for 1.8)
-- =========================================================
-- dsc_keys.key_status stays the current-state denormalization so the list query
-- needs no join; this table records how a key reached that state and who has
-- been holding it.
create table dsc_key_events (
  id            uuid primary key default uuid_generate_v4(),
  -- What the history is ordered by. See the note under section 2.
  seq           bigserial not null,
  dsc_key_id    uuid not null references dsc_keys (id) on delete cascade,
  event_type    dsc_event_type not null,
  issued_to     text,          -- required on 'Issued', optional on 'Returned'
  issued_phone  text,          -- ten digits, same rule as clients.contact_number
  notes         text,
  created_by    uuid references users (id) on delete set null,
  -- clock_timestamp(), not now(): now() is transaction start time, so two
  -- events written in one transaction would carry the same timestamp.
  created_at    timestamptz not null default clock_timestamp(),
  constraint dsc_key_events_issued_details check (
    event_type <> 'Issued'
    or (issued_to is not null and issued_phone is not null)
  )
);

create index idx_dsc_key_events_key on dsc_key_events (dsc_key_id, seq desc);
create index idx_dsc_key_events_created_by on dsc_key_events (created_by);

-- =========================================================
-- 1.10 updated_at maintenance trigger (generic)
-- =========================================================
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_users_updated_at        before update on users        for each row execute function set_updated_at();
create trigger trg_clients_updated_at      before update on clients      for each row execute function set_updated_at();
create trigger trg_credentials_updated_at  before update on credentials  for each row execute function set_updated_at();
create trigger trg_tenders_updated_at      before update on tenders      for each row execute function set_updated_at();
create trigger trg_dsc_keys_updated_at     before update on dsc_keys     for each row execute function set_updated_at();
-- dsc_key_events deliberately has no trigger: it is append-only and has no
-- updated_at to maintain.
```

---

## 2. Cascade & Deletion Rules Summary

| Deleting a... | Effect |
|---|---|
| `client` | Cascades → deletes all their `credentials`, `tenders`, `dsc_keys` rows. Admin-only, for exactly that reason. |
| `dsc_key` | Cascades → deletes its `dsc_key_events` history. |
| `portal` | **Blocked** (`on delete restrict`) if any `credentials` row references it. Admins must set `is_active = false` instead. |
| `tender_department` | **Blocked** if any `tenders` row references it. Admins must deactivate instead. |
| `user` | Supported and admin-only (`DELETE /api/admin/users/:id`). `created_by` foreign keys are `on delete set null`, so the person's clients, tenders, credentials and DSC keys survive and simply report `created_by: null`. Two guards apply: an admin cannot delete themselves, and the last active admin cannot be deleted, demoted or deactivated. Use `is_active = false` instead when the attribution should be preserved. |

### Never order an append-only log by `created_at`

`now()` in Postgres is **transaction start time**, identical for every row
written in the same transaction. `dsc_key_events` writes two rows at once when a
key is logged as already issued ('Created' then 'Issued'), so ordering by
`created_at` left those two tied, and the fallback tiebreaker was a random UUID
primary key — the history could show a key issued *before* it was logged.

`dsc_key_events.seq` (`bigserial`) exists for this. A sequence is monotonic,
non-transactional, and independent of clock resolution, so it orders the log
exactly. `created_at` also uses `clock_timestamp()` rather than `now()`, so the
timestamps *displayed* against same-transaction events are distinct as well —
but the ordering is the sequence's job, not the timestamp's.

Any future append-only table needs the same treatment.

### A note on `created_by`

Across `clients`, `credentials`, `tenders` and `dsc_keys`, `created_by` is
**re-set to the acting user on every update**, so it names the last person to
touch the row rather than its original author. That is deliberate — every one
of those modules is open-edit, and the UI reports "who last changed this" — but
it means `created_by` is *not* an ownership column and must never be used as
one. Authorization for deletion is role-based (admin), not ownership-based.

---

## 3. Row-Level Security

**Not used for authorization.** Authorization is enforced entirely in the FastAPI application layer (see `docs/ARCHITECTURE.md` §3.3). This is a deliberate simplification vs. the earlier Supabase-based plan, which relied on `auth.uid()` for RLS. Since we're not using Supabase Auth from the Python backend, database-side RLS-as-authorization would require passing the user ID via `SET LOCAL` on every connection — worth the effort in a multi-tenant SaaS, not worth it here.

The DB service role (`postgres`) connection has full access. All access decisions happen in the service layer, using the authenticated user loaded via the `get_current_user` FastAPI dependency.

**RLS is nonetheless turned on (with zero policies) on every table**, purely as hosting hardening: Supabase auto-exposes every `public` table through PostgREST to the `anon`/`authenticated` Postgres roles, and our backend never uses that surface. Enabling RLS with no policies blocks PostgREST entirely while leaving our own `postgres`-role connection untouched (the table owner is exempt from its own RLS). Every migration that creates a new table should include this — see `46d416635855_enable_row_level_security_on_users_table.py` for the pattern.

---

## 4. Alembic Workflow

### Initial setup (one-time)

```bash
cd backend
uv run alembic init -t async app/db/migrations
```

The scaffold in this repo already has this done — the `alembic.ini`, `env.py`, and the `versions/` folder are in place.

### Making a schema change

1. Edit the SQLAlchemy model in `backend/app/models/`.
2. Run: `uv run alembic revision --autogenerate -m "add contact_number index to clients"`
3. Review the generated file in `backend/app/db/migrations/versions/`. Autogenerate misses some things (custom types, check constraints, generated columns) — hand-edit if needed. Reference this DDL doc when in doubt.
4. Apply locally: `uv run alembic upgrade head`
5. Commit the model change + the migration file together.

### Production deploy

Migrations are **not** run automatically on deploy. There is no `postbuild` step
in `backend/vercel.json` — this section previously claimed there was, which is
wrong and is the kind of mistake that takes production down: deploying code that
expects a column the database has not got yet.

Run them from your machine against the production URL **before** the deploy that
needs them, exactly as `DEVELOPMENT_GUIDE.md` §6.2 sets out:

```bash
cd backend
DATABASE_URL="<prod URL>" uv run alembic upgrade head
```

Note that dev and production are **separate Supabase projects**. `backend/.env`
points at dev, so `alembic upgrade head` with no override migrates dev only.

---

## 5. Notes on Generated Columns

`tenders` has **two** Postgres `GENERATED ALWAYS AS ... STORED` columns:
`total_amount` (`quantity * price`) and `remaining_amount`
(`quantity * price - paid_amount`).

`remaining_amount` restates the product rather than reading `total_amount`
because **Postgres forbids one generated column from referencing another**.

Alembic's autogenerate does **not** detect generated columns — the migration
that creates or adds one must include the definition manually. See
`backend/app/db/migrations/versions/9c5581b01a80_create_tenders_table.py` and
`e4d0f6a2743b_add_tender_payment_fields.py` for the reference pattern.

In the SQLAlchemy model, mark such a column with `Computed(..., persisted=True)` — SQLAlchemy then omits it from INSERT and UPDATE entirely:

```python
from sqlalchemy import Computed

class Tender(Base):
    __tablename__ = "tenders"
    ...
    total_amount: Mapped[Decimal] = mapped_column(
        Numeric(14, 2),
        Computed("quantity * price", persisted=True),
    )
```

---

## 6. Seeding

Static seed data (e.g. the initial `tender_departments`) lives in an Alembic migration, not a separate seed script. This ensures every environment (local, staging, prod) starts with the same baseline.

The first Admin user is **not** seeded — Admin creation is a manual bootstrap step via `backend/app/scripts/create_admin.py`, since Admin credentials should never live in version control.

---

## 7. Retired Enum Values

Postgres cannot drop a value from an enum in place — doing so means rebuilding
the type and rewriting every dependent column. For a forward-only prototype
that is not worth it, so a retired value is retired **at the application layer**
instead:

| Type | Retired value | Status |
|---|---|---|
| `dsc_key_status` | `Key Lost` | Not writable and not filterable. The Pydantic `DscKeyStatus` literal and the frontend union both exclude it, so a request carrying it returns `422`. |

Two consequences worth remembering:

1. **Reads must stay tolerant.** `DscKeyRead.key_status` is a plain `str`, and
   the frontend type is a union widened with `string`, precisely so a row
   created before the change still deserializes and still renders. Anything
   mapping a status to a colour or a label needs a fallback.
2. **Adding a value is a migration of its own.** `ALTER TYPE ... ADD VALUE`
   cannot be used in the same transaction that adds it, so
   `d3c9e5f1632a_add_partially_paid_tender_status.py` does nothing but add
   `'Partially Paid'`; the next revision is what writes the `CHECK` constraint
   naming it. Splitting them is not tidiness — combining them fails at runtime.
