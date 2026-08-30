# Development Guide

Everything you (or Claude Code) need to run this app locally, add features, and deploy.

---

## 1. Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **`uv`** — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **`pnpm`** — install with `npm install -g pnpm`
- **Access to the "Tendorflow" Supabase project** — ask a teammate for the pooled connection string (Project Settings → Database → Connection String → Transaction pooler tab).
- **A Vercel account** — free tier is enough for prototype hosting.

---

## 2. First-Time Setup

### 2.1 Clone and configure

```bash
git clone <repo-url> tender-app
cd tender-app
```

### 2.2 Backend

```bash
cd backend
cp .env.example .env
```

Edit `.env`. `DATABASE_URL`/`TEST_DATABASE_URL` come from the "Tendorflow" Supabase project → **Project Settings → Database → Connection String → Transaction pooler tab** (port 6543 — not "Direct connection"). Convert the `postgresql://` scheme to `postgresql+asyncpg://`. Dev and test currently point at the **same** Supabase project/database (see §5) — ask a teammate for the connection string rather than creating a second project.

```
DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
TEST_DATABASE_URL=postgresql+asyncpg://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres
JWT_SECRET=<generate a random 64-char string, e.g. `openssl rand -hex 32`>
JWT_ACCESS_TTL_MINUTES=30
JWT_REFRESH_TTL_DAYS=7
CORS_ORIGINS=http://localhost:5173
ENVIRONMENT=development
LOG_LEVEL=INFO
```

Install dependencies and run migrations:

```bash
uv sync
uv run alembic upgrade head
```

Create the first admin (one-off bootstrap):

```bash
uv run python -m app.scripts.create_admin
# Follow the prompts: email, password, full name.
```

Start the dev server:

```bash
uv run uvicorn app.main:app --reload --port 8000
```

Visit `http://localhost:8000/docs` — FastAPI's auto-generated Swagger UI. You should see every endpoint.

### 2.3 Frontend

```bash
cd frontend
cp .env.example .env
```

Edit `.env`:

```
VITE_API_BASE_URL=http://localhost:8000
```

Install and run:

```bash
pnpm install
pnpm dev
```

Visit `http://localhost:5173`. Log in with the admin credentials you created above.

---

## 3. Environment Variables (Full Reference)

### Backend (`backend/.env`)

| Var | Required | Example | Notes |
|---|---|---|---|
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://...` | Must use the `+asyncpg` driver prefix. Use Supabase's **Transaction pooler** endpoint (port 6543), always — even locally. Every async engine must pass `connect_args={"statement_cache_size": 0}` (asyncpg + Supavisor transaction mode incompatibility) — see `app/database.py`. |
| `TEST_DATABASE_URL` | ⬜ | same as `DATABASE_URL` | Currently the same Supabase project as dev (see §5) — set it explicitly rather than relying on the old "`_test` suffix" fallback, which assumed a locally-creatable second database. |
| `JWT_SECRET` | ✅ | 64-char hex | Signs tokens. Rotate = invalidates all sessions. |
| `JWT_ACCESS_TTL_MINUTES` | ⬜ | `30` | Default 30. |
| `JWT_REFRESH_TTL_DAYS` | ⬜ | `7` | Default 7. |
| `CORS_ORIGINS` | ✅ | `http://localhost:5173,https://tender-app.vercel.app` | Comma-separated allowlist. **No wildcards in production.** |
| `ENVIRONMENT` | ⬜ | `development` \| `production` | Controls a few behaviors (SQL echo, error verbosity). |
| `LOG_LEVEL` | ⬜ | `INFO` | `DEBUG` for verbose. |

### Frontend (`frontend/.env`)

| Var | Required | Example |
|---|---|---|
| `VITE_API_BASE_URL` | ✅ | `http://localhost:8000` locally, `https://tender-app-backend.vercel.app` in prod |

Every `VITE_*` variable is bundled into the frontend and visible to users. **Never** put a secret in a `VITE_*` var.

---

## 4. Common Workflows

### 4.1 Add a new backend endpoint

1. Update `docs/API_CONTRACT.md` with the endpoint spec (path, method, request, response, errors). Get this reviewed / self-review it against the PRD.
2. Add / update the SQLAlchemy model in `backend/app/models/` if the data shape changes.
3. Generate a migration: `uv run alembic revision --autogenerate -m "..."` and review the diff.
4. Apply locally: `uv run alembic upgrade head`.
5. Add Pydantic schemas (request + response) in `backend/app/schemas/`.
6. Add the business logic in `backend/app/services/`.
7. Add the FastAPI route in `backend/app/routers/`.
8. Wire the router into `app.main`.
9. Add tests in `backend/tests/`.

### 4.2 Add a new frontend page

1. Confirm the endpoint(s) you need exist and match `API_CONTRACT.md`.
2. Add TypeScript types in `frontend/src/types/` (mirror the Pydantic response schemas).
3. Add the typed API function in `frontend/src/api/`.
4. Add a React Query hook (`useXxx`, `useCreateXxx`, etc.) in `frontend/src/hooks/`.
5. Create the page component in `frontend/src/pages/<module>/`.
6. Register the route in `frontend/src/router.tsx`, wrapping with `<ProtectedRoute>` (and `<AdminRoute>` if admin-only).
7. Add a nav entry in the sidebar component if it needs one.

### 4.3 Change the database schema

Never edit the DB directly. Always:

1. Edit the SQLAlchemy model.
2. `uv run alembic revision --autogenerate -m "descriptive message"`.
3. Review the generated migration file. Alembic misses generated columns, enum changes, and some constraints — hand-edit as needed. Reference `docs/DATABASE_SCHEMA.md`.
4. `uv run alembic upgrade head` to apply.
5. Commit the model + migration together.

### 4.4 Rolling back a migration

```bash
uv run alembic downgrade -1        # step back one revision
uv run alembic downgrade <revision-id>  # jump to a specific one
uv run alembic history             # see all revisions
```

Never edit a migration that has been applied in production. Instead, write a new migration that reverses it.

---

## 5. Testing

### Backend

```bash
cd backend
uv run pytest                       # run all tests
uv run pytest tests/test_clients.py # single file
uv run pytest -k "test_create"      # match by name
uv run pytest -v                    # verbose
uv run pytest --cov=app             # coverage
```

Tests run against whatever `TEST_DATABASE_URL` points at (falls back to `DATABASE_URL` with a `_test` suffix if unset — irrelevant right now, see below). Each test runs inside a transaction that's rolled back at the end, so tests are isolated and the DB stays clean.

**Current state (pre-launch):** `TEST_DATABASE_URL` is set to the *same* Supabase project as `DATABASE_URL` — there's no separate test database yet. This is safe only because of the transaction-rollback isolation above; it's flagged in `ARCHITECTURE.md` §7 as a hardening item to fix (a dedicated Supabase branch, or a local Postgres instance for tests) before this project holds real client data.

#### Writing tests against a non-empty database

That shared database also holds **committed demo data** left behind deliberately by each phase's smoke test, so it is inspectable in the Supabase dashboard. Rollback isolates rows a *test* creates, but pre-existing committed rows are visible to every test. Two rules follow, and breaking either produces tests that pass today and fail after the next smoke test:

1. **Never assert an absolute count or an exact set.** `assert total_count == 1` breaks the moment one more row exists. Assert membership (`assert name in names`), a subset, or a delta against a baseline read taken at the start of the test.
2. **Never insert under a hardcoded name or email.** It will eventually collide with committed data and fail with a `409`. Use the `uniq` fixture (a short per-test token) to suffix every name and email: `f"GeM Portal {uniq}"`, `f"rohan-{uniq}@example.com"`.

The `admin_headers`, `employee_headers`, and `other_employee_headers` fixtures already generate unique accounts per test. `admin_user` / `employee_user` expose the underlying `(user, password)` if a test needs to assert on the account itself.

### Frontend

Not yet configured. When we add it:

```bash
cd frontend
pnpm test          # vitest run
pnpm test:watch    # vitest watch
```

---

## 6. Deploying to Vercel

### 6.0 Environments

Two Supabase projects, both in `ap-southeast-1`:

| Environment | Supabase project | Ref | Used by |
|---|---|---|---|
| Development + tests | `Tendorflow` | `sxylliqkymxffzzsfowi` | local `backend/.env` (`DATABASE_URL` **and** `TEST_DATABASE_URL`) |
| Production | `Tendorflow-Prod` | `knsivapygfpcqxgcgdur` | the deployed backend's Vercel env var only |

They are deliberately separate so `pytest` — which writes and rolls back constantly — can never reach live client data, and so demo rows don't show up in production. **Never point `TEST_DATABASE_URL` at the prod project.**

`JWT_SECRET` must also differ per environment; a token minted for dev must not be valid in production.

### 6.1 Initial project setup

**Prerequisite:** the repo must be pushed to GitHub — Vercel deploys from the remote, not your working copy.

You'll create **two Vercel projects** pointing at the same repo. This is not a contradiction of the monorepo: a monorepo is a source-control layout, while the two halves have different runtimes (Python serverless vs. static assets) and so need different build pipelines. Each project sets its own **Root Directory** against the same repo.

1. **Backend project**
   - Import repo → set **Root Directory** to `backend/`.
   - Framework Preset: **Other**.
   - Build & Output Settings: leave default (Vercel reads `vercel.json`).
   - Add environment variables: `DATABASE_URL` (pooled endpoint!), `JWT_SECRET`, `CORS_ORIGINS` (your frontend's Vercel URL), `ENVIRONMENT=production`, `LOG_LEVEL=INFO`.
   - Deploy.
   - Note the deployed URL, e.g. `https://tender-app-backend.vercel.app`.

2. **Frontend project**
   - Import same repo → set **Root Directory** to `frontend/`.
   - Framework Preset: **Vite** (auto-detected).
   - Add env var: `VITE_API_BASE_URL=https://tender-app-backend.vercel.app` (the URL from step 1).
   - Deploy.
   - Note the deployed URL, e.g. `https://tender-app.vercel.app`.

3. Go back to the backend project and **update `CORS_ORIGINS`** to include the frontend URL. Redeploy the backend so the new env var takes effect.

### 6.2 Running migrations on production

Migrations are **not** run automatically on deploy — a failed migration would take the deploy down with it. Run them from your machine against the prod URL, before the first deploy and after any schema change:

```bash
cd backend
DATABASE_URL="postgresql+asyncpg://postgres.knsivapygfpcqxgcgdur:<PROD-PASSWORD>@aws-0-ap-southeast-1.pooler.supabase.com:6543/postgres" \
  uv run alembic upgrade head
```

Note this overrides `DATABASE_URL` for one command only; your `.env` still points at the dev project afterwards.

Then bootstrap the first production admin the same way (the script reads the same env var):

```bash
DATABASE_URL="<same prod URL>" uv run python -m app.scripts.create_admin
```

There is no other way to create the first account — there is no self-signup, and every `/api/admin/users` call requires an existing admin.

### 6.2a `requirements.txt`

Vercel's Python runtime installs from `backend/requirements.txt` and ignores `pyproject.toml`. Regenerate it after **any** dependency change or the deployed function will run against stale packages:

```bash
cd backend
uv pip compile pyproject.toml -o requirements.txt
```

Only `[project.dependencies]` are exported — `pytest`, `ruff` and `httpx` stay out of the deployed bundle.

### 6.3 Custom domain (optional)

Vercel → project settings → Domains → add your domain, follow DNS instructions. Update `CORS_ORIGINS` accordingly.

### 6.4 Deploy-time gotchas

- **`CORS_ORIGINS` is a chicken-and-egg.** You don't know the frontend's URL until it's deployed, and the frontend needs the backend's URL to build. Deploy backend → deploy frontend → come back and set the real `CORS_ORIGINS` on the backend → redeploy the backend. Step 3 above is not optional; skipping it means every API call from the browser fails CORS.
- **Vercel preview deployments get their own URLs** (`*-git-branch-*.vercel.app`), which are not in `CORS_ORIGINS`. Preview frontends will fail to reach the backend unless you add them. Fine to ignore while only `main` is deployed.
- **Cold starts.** The first request after idle takes 1–2s on Vercel Python. Expected, not a bug. If it becomes painful, `ARCHITECTURE.md` §7 item 8 covers moving to Railway/Fly.
- **Use the pooled (Supavisor, port 6543) URL, never the direct 5432 one.** Serverless functions open a connection per invocation and would exhaust direct connections. The `statement_cache_size: 0` setting this repo already applies is what makes asyncpg work through that pooler.
- **Verify `/api/health` on the deployed backend before touching the frontend.** It needs no auth and no database, so a failure there isolates the problem to the Python build rather than config.

---

## 7. Debugging Tips

### Backend

- **Auto-generated API docs:** `http://localhost:8000/docs` — try any endpoint directly with the "Authorize" button (paste your access token).
- **SQL debugging:** set `SQLALCHEMY_ECHO=1` in `.env` to print every query to stdout.
- **JWT decode:** paste any token at [jwt.io](https://jwt.io) to see its claims and expiry.
- **Vercel logs:** `vercel logs <deployment-url>` from the CLI, or the Vercel dashboard.

### Frontend

- **React Query devtools:** open in dev mode — pinned bottom-right of the app. Inspect cache state, refetch manually, see mutation history.
- **Network tab:** filter to `Fetch/XHR` and watch API calls. Check request headers for the Authorization bearer.
- **Auth state:** `localStorage.getItem('refresh_token')` in devtools console. Clear it to simulate logout.

---

## 8. Common Gotchas

- **CORS errors in the browser** → check `CORS_ORIGINS` on the backend includes the frontend's exact origin (including port). No trailing slash.
- **`401 UNAUTHENTICATED` right after login** → the axios interceptor probably isn't attaching the Bearer header. Check `frontend/src/api/client.ts`.
- **Migrations "no changes detected"** → Alembic autogenerate compares SQLAlchemy models to the DB. If you edited raw SQL, Alembic doesn't see it. Also, ensure you imported all model files in `alembic/env.py` so autogenerate sees them.
- **Vercel Python cold start slow** → expected. First request after inactivity takes 1–2s. Subsequent requests are fast. If it's painful, move backend to Railway/Fly.
- **`asyncpg` connection issues on Vercel** → make sure `DATABASE_URL` uses the Supabase **Transaction pooler** endpoint (port 6543) and SQLAlchemy is configured with `poolclass=NullPool`. See `backend/app/database.py`.
- **`asyncpg.exceptions.DuplicatePreparedStatementError`** → you created an async engine without `connect_args={"statement_cache_size": 0}`. Supavisor's transaction-mode pooler doesn't support asyncpg's prepared statement cache. Every engine construction in this repo already handles this (`app/database.py`, `app/db/migrations/env.py`, `tests/conftest.py`) — if you add a new one (a script, a one-off tool), copy the pattern.
- **`passlib`/`bcrypt` warning: `module 'bcrypt' has no attribute '__about__'`** → `passlib` 1.7.4 probes an attribute `bcrypt` removed in 4.1+. `pyproject.toml` pins `bcrypt<4.1.0` to avoid it; if you see this, your venv has a stale/mismatched bcrypt install — `uv sync --reinstall-package bcrypt` (stop anything holding the `.venv` file lock first, e.g. a running `uvicorn`).
- **`422 VALIDATION_ERROR` on an email that looks fine** → Pydantic's `EmailStr` (via `email-validator`) rejects reserved/special-use TLDs: `.test`, `.local`, `.example`, `.invalid`. Use a real-looking domain in seed/demo data (e.g. `@tenderflow-demo.com`), not `@something.test`. This is correct behavior for an app whose clients have real email addresses — don't relax it.

---

## 9. Splitting the Monorepo Later

When the time comes (see `ARCHITECTURE.md` §3):

```bash
git subtree split --prefix=backend  -b backend-only
git push git@github.com:you/tender-app-backend.git backend-only:main

git subtree split --prefix=frontend -b frontend-only
git push git@github.com:you/tender-app-frontend.git frontend-only:main
```

Then in each new repo, copy `/docs` in manually. Update each Vercel project to point at the new repo instead of the monorepo. Zero code changes required.
