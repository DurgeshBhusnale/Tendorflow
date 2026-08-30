# Development Guide

Everything you (or Claude Code) need to run this app locally, add features, and deploy.

---

## 1. Prerequisites

- **Python 3.12+**
- **Node.js 20+**
- **`uv`** — install with `curl -LsSf https://astral.sh/uv/install.sh | sh`
- **`pnpm`** — install with `npm install -g pnpm`
- **A Postgres URL** — get one free from [Supabase](https://supabase.com) or [Neon](https://neon.tech). Both give you a connection string with SSL.
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

Edit `.env`:

```
DATABASE_URL=postgresql+asyncpg://user:pass@host:5432/dbname?sslmode=require
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
| `DATABASE_URL` | ✅ | `postgresql+asyncpg://...` | Must use the `+asyncpg` driver prefix. Use your DB's **pooled** endpoint in production (e.g. Supabase pgbouncer or Neon pooled URL). |
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

Tests use a separate Postgres schema (or a separate test database — configured via `TEST_DATABASE_URL` in `.env`). Each test runs inside a transaction that's rolled back at the end, so tests are isolated and the DB stays clean.

### Frontend

Not yet configured. When we add it:

```bash
cd frontend
pnpm test          # vitest run
pnpm test:watch    # vitest watch
```

---

## 6. Deploying to Vercel

### 6.1 Initial project setup

You'll create **two Vercel projects** pointing at the same repo:

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

Two options:

**Option A: run manually from your local machine** (safer, recommended for prototype):
```bash
cd backend
DATABASE_URL="<production-pooled-url>" uv run alembic upgrade head
```

**Option B: run automatically on deploy** — add a `buildCommand` to `backend/vercel.json` that runs migrations. Not recommended yet because a failed migration would break a deploy; do this once you have staging + prod separated.

### 6.3 Custom domain (optional)

Vercel → project settings → Domains → add your domain, follow DNS instructions. Update `CORS_ORIGINS` accordingly.

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
- **`asyncpg` connection issues on Vercel** → make sure `DATABASE_URL` uses the **pooled** endpoint (Supabase pgbouncer / Neon pooler) and SQLAlchemy is configured with `poolclass=NullPool`. See `backend/app/database.py`.

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
