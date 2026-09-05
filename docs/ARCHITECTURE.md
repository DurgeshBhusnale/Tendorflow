# Architecture

## 1. Stack Decisions & Rationale

### Backend: Python 3.12 + FastAPI + SQLAlchemy 2.0 + Alembic

- **FastAPI** — modern async Python framework, first-class Pydantic integration, auto-generated OpenAPI docs at `/docs` (invaluable for a two-person team where the API contract is the coordination point).
- **SQLAlchemy 2.0 async** with the `asyncpg` driver — matches FastAPI's async model, and the 2.0 typed API is a big DX win over 1.x.
- **Alembic** — the standard for SQLAlchemy migrations. Autogenerate diff, review, commit.
- **Pydantic v2** — validation for every request body, response model for every endpoint. Also drives `pydantic-settings` for env var loading.
- **python-jose[cryptography]** — JWT encode/decode. Not `PyJWT` because `python-jose` handles the whole JOSE family and integrates cleanly with FastAPI examples in the wild.
- **passlib[bcrypt]** — bcrypt password hashing. Standard, safe, no surprises.
- **uv** — dependency manager. Fast, modern, replaces pip + pip-tools + virtualenv. Locally we use `uv sync`; for Vercel we export `requirements.txt` via `uv pip compile pyproject.toml -o requirements.txt` because Vercel's Python runtime reads `requirements.txt`.

### Frontend: React 19 + Vite + TypeScript + TanStack Query + React Router v7

- **React 19** — current stable. Server Components are irrelevant here because we're a pure SPA hitting a separate API.
- **Vite** — fast dev server, tiny build config, deploys to Vercel as static assets.
- **TypeScript strict mode** — non-negotiable. `any` is a code smell.
- **TanStack Query (React Query)** — the only sensible way to manage server state in React. Every API call goes through it. Local state stays in `useState`; server state stays in Query.
- **React Router v7** — routing + protected route composition.
- **React Hook Form + Zod** — forms and their validation. Zod schemas mirror Pydantic schemas on the backend (kept in sync manually — that's the documented cost of an API-first split).
- **Tailwind CSS + shadcn/ui** — utility CSS + a set of unstyled-but-accessible component primitives. For prototype phase we use them as-is; visual design comes later.
- **axios** — HTTP client with interceptors (attach JWT, handle 401 → refresh flow).

### Database: PostgreSQL (Supabase)

- Settled on Supabase (project "Tendorflow") for this client engagement. `DATABASE_URL`/`TEST_DATABASE_URL` use the **Transaction pooler** connection string (Supavisor, port 6543) from Project Settings → Database, not the direct connection — matches the serverless pooling requirement below.
- We use Postgres purely as a database — no Supabase Auth, no Supabase SDK (auth is handled at the application layer in FastAPI, see below). This is intentional: it keeps the backend framework-agnostic and portable to any Postgres host, even though we're hosting on Supabase specifically today.
- **RLS is enabled (no policies) on every table anyway** — not for app authorization (that stays in the FastAPI service layer, per `DATABASE_SCHEMA.md` §3), but because Supabase auto-exposes every `public` table via PostgREST to the `anon`/`authenticated` roles. Our backend connects as the `postgres` role (table owner, exempt from its own RLS), so this only blocks the PostgREST surface we don't use — it has no effect on the app.
- **asyncpg + Supavisor gotcha:** the transaction-mode pooler doesn't support asyncpg's server-side prepared statement cache (`DuplicatePreparedStatementError` otherwise). Every engine construction (`app/database.py`, Alembic's `env.py`, `tests/conftest.py`) passes `connect_args={"statement_cache_size": 0}` to work around it.
- **Dev and test currently share the same Supabase project/database** (no separate branch) — tests are transaction-scoped and rolled back per test, so this is safe pre-launch, but revisit before this holds real client data. See `DEVELOPMENT_GUIDE.md` §5.

### Auth: JWT issued by FastAPI

- Short-lived access token (30 min), long-lived refresh token (7 days).
- Access token in memory (React state via auth context). Refresh token in `localStorage`.
- Trade-off: `localStorage` is vulnerable to XSS. Acceptable for an internal tool with a small trusted user base. Note in `ARCHITECTURE.md` follow-up items for future hardening.
- Not using HttpOnly cookies because the frontend and backend deploy to different Vercel subdomains, and cross-origin cookie handling with `SameSite=None; Secure` adds complexity for marginal benefit at this scale.

### Hosting: Vercel (two projects, same monorepo)

- **Backend project:** points at `backend/` as the root, deploys as Python serverless functions.
- **Frontend project:** points at `frontend/` as the root, deploys as a static Vite build.
- Both live under the same Git repo. Vercel supports monorepo deploys natively — you configure the root directory per project.

---

## 2. Vercel Deployment Specifics

### Backend on Vercel Python

Vercel's Python runtime executes serverless functions on invocation. FastAPI runs via a small adapter file:

```python
# backend/api/index.py
from app.main import app

# Vercel discovers 'app' as the ASGI handler
```

Configuration (`backend/vercel.json`):

```json
{
  "version": 2,
  "regions": ["sin1"],
  "builds": [
    { "src": "api/index.py", "use": "@vercel/python" }
  ],
  "routes": [
    { "src": "/(.*)", "dest": "api/index.py" }
  ]
}
```

**The function must run in the same region as the database.** `"regions": ["sin1"]` (Singapore)
pins it next to the Supabase project, which lives in `ap-southeast-1`. Vercel's default is `iad1`
(Washington DC), and that default is expensive here: Virginia↔Singapore is a ~230ms round trip, a
fresh Postgres connection costs roughly ten of them (TCP, TLS, SCRAM auth) before a single query
runs, and the request pays it again for every query it issues.

Measured against production on 2026-09-05, before the region was pinned:

| Request | TTFB |
|---|---|
| `/api/health`, warm, touches no database | 0.29–0.51s |
| `GET /api/clients` rejected at the auth header, before any database access | 0.27–0.44s |
| `POST /api/auth/login`, warm, opens a connection | 3.80–4.00s |
| `POST /api/auth/login`, cold | 5.97s |

The ~3.5s gap between "touches the database" and "doesn't" was entirely geography. If a region pin
is ever rejected by the plan tier, the alternative is moving the Supabase project to `us-east-1` —
the two must not be split across continents.

**Known limitations on Vercel Python:**
- Cold starts on first request after inactivity (~2–3s measured, not the ~500ms once assumed here).
- 10-second execution timeout on the Hobby tier, 60 seconds on Pro. Fine for our workload.
- Use Supabase's **Transaction pooler** (Supavisor) endpoint. Set `DATABASE_URL` to the *pooled* endpoint (port 6543) in Vercel env vars, not the direct connection.
- Supavisor's transaction mode doesn't support asyncpg's prepared statement cache — `connect_args={"statement_cache_size": 0}` is required wherever an async engine is created. See §1 above.

**Connection pooling — reversal of an earlier decision.** This document previously asserted that
"every function invocation is a fresh Python process, so do not rely on SQLAlchemy connection
pooling across requests", and configured `poolclass=NullPool` on that basis. The premise is wrong:
warm invocations demonstrably reuse the process (2.88s cold vs 0.29s warm on `/api/health`), so a
pooled connection does survive into the next request. `app/database.py` now uses the default async
queue pool with `pool_size=1, max_overflow=2, pool_recycle=280, pool_pre_ping=True` — sized for one
in-flight request per instance, recycled well inside Supavisor's idle timeout, and liveness-checked
on checkout because Vercel freezes idle instances.

**This carries a real risk, and it is unverified in production.** Process reuse is necessary but not
sufficient: a pooled asyncpg connection is bound to the asyncio event loop that created it. If the
runtime starts a fresh event loop per invocation, a reused connection will fail on the next request
rather than merely being slow. Watch the function logs after deploying — loop-affinity failures
surface as `InterfaceError` or "attached to a different loop". The change is isolated to one commit
so reverting to `NullPool` is a clean revert. Note that with the region pinned, the handshake this
saves is worth tens of milliseconds, not seconds; the region fix is what mattered.

**If Vercel Python becomes painful** (cold starts unbearable, cost surprises, tooling frustration), the backend is trivially portable to Railway, Render, or Fly.io — none of the code changes, only the deploy config. `docs/DEVELOPMENT_GUIDE.md` covers this.

### Frontend on Vercel

Standard static Vite build. Vercel autodetects Vite. Set `VITE_API_BASE_URL` in Vercel env vars to the backend's deployed URL (e.g. `https://tender-app-backend.vercel.app`).

CORS: the FastAPI backend must allow the frontend origin. Configured via `CORS_ORIGINS` env var, comma-separated list of allowed origins. In production this is the frontend Vercel URL; in local dev it's `http://localhost:5173`.

---

## 3. Monorepo & the Future Split

The repo is a monorepo today for developer convenience — one clone, one branch, atomic commits that touch both sides. It is **structured to split cleanly into two repos** without refactoring.

### Rules that preserve splittability

1. **No cross-imports.** `backend/` never imports from `frontend/` and vice versa. Enforce this by convention (there's no build tool linking them anyway).
2. **No shared package at the root.** No `packages/shared`, no root `package.json` with workspaces, no root `pyproject.toml`. Each side has its own dependency file and its own lockfile.
3. **Contract lives in `docs/`.** The API contract, DB schema, and PRD live in `/docs` — a folder that will be *duplicated* into both repos on split, since both sides need it.
4. **Env files are local to each side.** `backend/.env`, `frontend/.env`. No root `.env`.

### The split, when the time comes

```bash
# From the monorepo root, create two new orphan repos with just the relevant folder:
git subtree split --prefix=backend  -b backend-only
git subtree split --prefix=frontend -b frontend-only

# Push each branch to a new empty repo:
git push git@github.com:you/tender-app-backend.git  backend-only:main
git push git@github.com:you/tender-app-frontend.git frontend-only:main

# Copy /docs into both new repos manually (they'll diverge over time).
```

No code changes required. History for each folder is preserved in its new repo.

---

## 4. Data Flow (Happy Path Example)

Employee creates a new tender:

1. User fills out the form on `/tenders` in the React app. React Hook Form + Zod validate client-side.
2. On submit, `useMutation` (React Query) fires `POST /api/tenders` via the axios client. Axios interceptor attaches `Authorization: Bearer <access_token>`.
3. Vercel routes the request to the backend serverless function.
4. FastAPI enters the `create_tender` route. Dependencies resolve: `get_db_session()` opens a fresh Postgres connection; `get_current_user()` parses the JWT, verifies the signature, loads the user row.
5. The router validates the request body against `TenderCreate` (Pydantic).
6. The router delegates to `tender_service.create_tender(session, current_user, payload)`.
7. The service inserts a new row into `tenders`. Postgres computes `total_amount` via the generated column.
8. The service returns the ORM row; the router serializes it via `TenderRead` (Pydantic response model), wrapped in the success envelope.
9. Axios receives the response; React Query updates the cache; TanStack Query invalidates the `["tenders", "list"]` cache key so the table refetches.
10. The table re-renders with the new row visible.

---

## 5. Error Handling

**Backend:**
- Custom exception classes in `app.core.exceptions`: `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError`.
- A single FastAPI exception handler in `app.main` maps each to the correct HTTP status and the standard error envelope:
  ```json
  { "success": false, "error": { "code": "NOT_FOUND", "message": "Client not found" } }
  ```
- Pydantic validation errors auto-map to 422 with `code: "VALIDATION_ERROR"`.
- Unhandled exceptions map to 500 with `code: "INTERNAL_ERROR"` and the traceback goes to logs (never to the response body).

**Frontend:**
- Axios response interceptor reads the error envelope, throws a typed `ApiError` with `code` and `message`.
- React Query's `onError` on mutations shows a toast (once toasts are wired up — for prototype, `console.error` is fine).
- On 401, the axios interceptor attempts a refresh-token exchange; if that also fails, it clears auth state and redirects to `/`.

---

## 6. Testing Strategy (Prototype Level)

**Backend:** pytest, one test file per router (`tests/test_clients.py`, etc.). Minimum coverage per endpoint:
- Happy path (valid request → correct response).
- Auth failure (no token → 401; wrong role for admin-only → 403).
- Validation failure (bad payload → 422).

Database: a separate test Postgres schema, wiped between test runs. Use `pytest-asyncio` and `httpx.AsyncClient` for calling the FastAPI app in-process.

**Frontend:** manual verification via the dev server for now. Unit tests welcome but not required at prototype stage; add Vitest + React Testing Library once the UI stabilizes.

---

## 7. Hardening Items (Post-Prototype)

Flagged now so they don't get forgotten:

1. **Portal credential encryption at rest** — `password` column in `credentials` is plaintext per spec. Encrypt with `pgcrypto` symmetric encryption or app-layer `cryptography.fernet` before this handles real production credentials.
2. **Refresh token rotation + blacklisting** — currently refresh tokens are stateless. Add a `refresh_tokens` table with jti + revoked flag if long-term compromise is a concern.
3. **Rate limiting** — no rate limit on `/api/auth/login` today. Add `slowapi` or fronting middleware once accounts exist that matter.
4. **2FA on login** — TOTP via `pyotp`. Straightforward add.
5. **Audit log table** — capture who changed what. Currently we only have `created_by` on each table; no update trail.
6. **Structured logging** — swap `logging` for `structlog` with JSON output for better Vercel log filtering.
7. **CORS lockdown review** — currently a comma-separated allowlist. Confirm no wildcards leak into production env vars.
8. **Move off Vercel Python** if cold starts hurt UX — Railway or Fly.io with a persistent container solves this.
9. **Split dev/test off the shared Supabase project** — before this holds real client data, give tests their own Supabase branch (or a local DB) instead of sharing the Tendorflow project's database.
