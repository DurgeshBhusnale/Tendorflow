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
create type tender_status   as enum ('Paid', 'Pending');
create type dsc_key_status  as enum ('Key Created', 'Key Issued', 'Key Returned', 'Key Lost');

-- =========================================================
-- 1.1 USERS  (application user accounts — NOT auth.users)
-- =========================================================
create table users (
  id              uuid primary key default uuid_generate_v4(),
  full_name       text not null,
  email           text not null unique,
  password_hash   text not null,               -- bcrypt hash
  role            user_role not null default 'employee',
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_users_email on users (email);

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
-- 1.5 TENDER NAMES  (admin-managed master list)
-- =========================================================
create table tender_names (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null unique,
  is_active       boolean not null default true,
  created_by      uuid references users (id) on delete set null,
  created_at      timestamptz not null default now()
);

-- Static fallback seed
insert into tender_names (name) values
  ('PMC'), ('Civil-Works'), ('Govt-Supply')
on conflict (name) do nothing;

-- =========================================================
-- 1.6 TENDERS
-- =========================================================
create table tenders (
  id                  uuid primary key default uuid_generate_v4(),
  client_id           uuid not null references clients (id) on delete cascade,
  tender_name_id      uuid not null references tender_names (id) on delete restrict,
  quantity            integer not null check (quantity > 0),
  price               numeric(12,2) not null check (price >= 0),
  total_amount        numeric(14,2) generated always as (quantity * price) stored,
  status              tender_status not null default 'Pending',
  created_by          uuid references users (id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_tenders_client_id on tenders (client_id);
create index idx_tenders_status on tenders (status);
create index idx_tenders_created_by on tenders (created_by);

-- =========================================================
-- 1.7 DSC KEYS
-- =========================================================
create table dsc_keys (
  id                      uuid primary key default uuid_generate_v4(),
  client_id               uuid not null references clients (id) on delete cascade,
  key_status              dsc_key_status not null default 'Key Created',
  storage_location_notes  text,
  created_by              uuid not null references users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_dsc_keys_client_id on dsc_keys (client_id);
create index idx_dsc_keys_created_by on dsc_keys (created_by);

-- =========================================================
-- 1.8 updated_at maintenance trigger (generic)
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
```

---

## 2. Cascade & Deletion Rules Summary

| Deleting a... | Effect |
|---|---|
| `client` | Cascades → deletes all their `credentials`, `tenders`, `dsc_keys` rows. |
| `portal` | **Blocked** (`on delete restrict`) if any `credentials` row references it. Admins must set `is_active = false` instead. |
| `tender_name` | **Blocked** if any `tenders` row references it. Admins must deactivate instead. |
| `user` | `created_by` foreign keys are `on delete set null` for records, meaning historical rows survive but lose their creator attribution. This is why we prefer `is_active = false` on users rather than hard delete. |

---

## 3. Row-Level Security

**Not used.** Authorization is enforced entirely in the FastAPI application layer (see `docs/ARCHITECTURE.md` §3.3). This is a deliberate simplification vs. the earlier Supabase-based plan, which relied on `auth.uid()` for RLS. Since we're not using Supabase Auth from the Python backend, database-side RLS would require passing the user ID via `SET LOCAL` on every connection — worth the effort in a multi-tenant SaaS, not worth it here.

The DB service role connection has full access. All access decisions happen in the service layer, using the authenticated user loaded via the `get_current_user` FastAPI dependency.

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

Migrations run automatically on backend deploy — see the `postbuild` step in `backend/vercel.json` (documented in `DEVELOPMENT_GUIDE.md`). If you'd rather run migrations manually, unset that step and run `uv run alembic upgrade head` against the production `DATABASE_URL` from your local machine.

---

## 5. Notes on Generated Columns

The `total_amount` column in `tenders` is a Postgres `GENERATED ALWAYS AS ... STORED` column. Alembic's autogenerate does **not** detect this — the first migration that creates the `tenders` table must include the column definition manually. See `backend/app/db/migrations/versions/xxx_create_tenders.py` for the reference pattern.

In the SQLAlchemy model, mark this column with `Computed("quantity * price", persisted=True)`:

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

Static seed data (e.g. the initial `tender_names`) lives in an Alembic migration, not a separate seed script. This ensures every environment (local, staging, prod) starts with the same baseline.

The first Admin user is **not** seeded — Admin creation is a manual bootstrap step via `backend/app/scripts/create_admin.py`, since Admin credentials should never live in version control.
