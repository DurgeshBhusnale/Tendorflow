# Build Plan — Tender Filling Business Internal Tool

**Status:** Draft for review. Nothing in `backend/app/` or `frontend/src/` exists yet — this plan sequences everything from Phase 0 onward.

This plan turns the modules in `PRD.md` §4 into a dependency-ordered build sequence. Auth (Module 0) is foundational because every route except login/refresh/health requires a valid JWT. Clients (Module 1) is the entry point because Credentials, Tenders, and DSC Keys all FK into it. Portals and Tender Names are small admin-managed master lists that gate Credentials and Tenders respectively, so they're pulled forward into their own phase rather than bundled into the modules that consume them.

Each phase ends with a working, demoable slice — not just passing tests. "Definition of done" is written as an end-to-end user action, per root `CLAUDE.md`'s testing philosophy.

---

## Phase 0 — Foundation

**Scope:**

Backend:
- `backend/pyproject.toml` (deps: fastapi, uvicorn, sqlalchemy[asyncio], asyncpg, alembic, pydantic v2, pydantic-settings, python-jose[cryptography], passlib[bcrypt], pytest, pytest-asyncio, httpx, ruff)
- `backend/app/config.py` — pydantic-settings reading `.env`
- `backend/app/database.py` — async engine (`NullPool`), `async_session_maker`
- `backend/app/main.py` — FastAPI app factory, CORS middleware, empty router registration, central exception handler wired to `app/core/exceptions.py`
- `backend/app/core/exceptions.py` — `NotFoundError`, `ForbiddenError`, `ValidationError`, `ConflictError` + handler mapping to the envelope
- `backend/app/schemas/common.py` — `Envelope`, `ok()`, `paginated()`
- `backend/app/models/__init__.py`, `base.py` (declarative base)
- `backend/app/db/migrations/` — `alembic init -t async`, `env.py` wired to the models metadata and `DATABASE_URL`
- Initial Alembic migration: extensions (`uuid-ossp`, `pgcrypto`) + the three enum types (`user_role`, `tender_status`, `dsc_key_status`) — no tables yet, tables land with their owning phase
- `backend/api/index.py` — Vercel entry point
- `backend/vercel.json`
- `GET /api/health` route (public) — first real endpoint, proves the app factory + routing works
- `backend/tests/conftest.py` — test client fixture, test DB session fixture (separate schema, transactional rollback)
- `backend/tests/test_health.py`
- `backend/.gitignore` additions if needed (`.venv`, `__pycache__`, `.env`)

Frontend:
- `frontend/package.json` (deps: react 19, react-dom, typescript, vite, @tanstack/react-query, react-router, react-hook-form, zod, @hookform/resolvers, axios, tailwindcss, shadcn/ui deps, clsx/tailwind-merge)
- `frontend/vite.config.ts` — `@` → `src/` alias
- `frontend/tsconfig.json` — strict mode
- `frontend/tailwind.config.ts` + base Tailwind setup (shadcn/ui init)
- `frontend/index.html`, `frontend/src/main.tsx`
- `frontend/src/App.tsx` — QueryClientProvider + RouterProvider shell (AuthProvider added in Phase 1)
- `frontend/src/router.tsx` — empty/minimal router (real routes/guards land in Phase 1)
- `frontend/src/lib/utils.ts` — `cn()` helper
- `frontend/src/types/api.ts` — `Envelope<T>`, `PaginatedResponse<T>`, `ApiError` shape
- `frontend/src/api/client.ts` — axios instance skeleton (interceptors filled in properly in Phase 1 once token storage exists)
- A placeholder page proving the dev server renders (e.g. a temporary route) — removed once real pages land in Phase 1

**Dependencies:** none. This is the starting point.

**Rough size:** M

**Definition of done:**
- `uv run uvicorn app.main:app --reload` starts cleanly; `curl http://localhost:8000/api/health` returns `{"success": true, "data": {"status": "ok", "timestamp": "..."}}`.
- `uv run alembic upgrade head` runs against a local Postgres URL with no errors.
- `uv run pytest` passes (health test).
- `pnpm dev` starts cleanly; browser shows a blank shell with no console errors.
- `pnpm typecheck` and `pnpm lint` (backend: `ruff check .`) both pass with zero files of real feature code yet.

---

## Phase 1 — Module 0: Authentication & User Management

**Scope:**

Backend:
- `models/user.py` — `User` ORM model (`role` enum, `is_active`, timestamps)
- Migration: create `users` table + indexes + `updated_at` trigger
- `core/auth.py` — bcrypt hash/verify, JWT encode/decode (access + refresh, distinct TTLs from settings)
- `core/deps.py` — `get_db_session`, `get_current_user` (parses header, verifies JWT, loads user, checks `is_active`), `require_admin`
- `schemas/auth.py` — `LoginRequest`, `LoginResponse`, `RefreshRequest`, `RefreshResponse`, `MeResponse`
- `schemas/user.py` — `UserCreate` (with password policy validator: ≥8 chars, ≥1 letter, ≥1 digit), `UserUpdate`, `UserRead`
- `services/auth_service.py` — login (verify password, check `is_active`, issue tokens), refresh (verify refresh token, issue new access token)
- `services/user_service.py` — list (paginated, search, role filter), create (email uniqueness → `409 EMAIL_EXISTS`), update (partial: name/role/is_active/password)
- `routers/auth.py` — `POST /api/auth/login`, `POST /api/auth/refresh`, `POST /api/auth/logout` (no-op), `GET /api/auth/me`
- `routers/users.py` — `GET /api/admin/users`, `POST /api/admin/users`, `PATCH /api/admin/users/:id`, all behind `require_admin`
- `app/scripts/create_admin.py` — interactive bootstrap CLI (prompts email/password/name, inserts directly with `role=admin`)
- Wire both routers into `app/main.py`
- Tests: `test_auth.py` (login happy/invalid-credentials/inactive-account, refresh happy/invalid, me), `test_users.py` (create happy/non-admin-403/duplicate-email/weak-password, list, patch)

Frontend:
- `src/types/user.ts` — `User`, `UserCreate`, `UserUpdate`
- `src/api/auth.ts` — `login`, `refresh`, `logout`, `me`
- `src/api/users.ts` — `list`, `create`, `update`
- `src/auth/tokenStore.ts` — access token in module-level state, refresh token in `localStorage`
- `src/api/client.ts` — finish the interceptors (attach bearer, `TOKEN_EXPIRED` → refresh-and-retry, hard failure → clear auth + redirect to `/`)
- `src/auth/AuthContext.tsx` — `useAuth()`: `user`, `isAuthenticated`, `isAdmin`, `login()`, `logout()`; on mount, attempt refresh → `/api/auth/me` hydration, full-page loading state until resolved
- `src/auth/ProtectedRoute.tsx`, `src/auth/AdminRoute.tsx`
- `src/pages/LoginPage.tsx` — email/password form (RHF + Zod), inline error on `401 INVALID_CREDENTIALS`, helper text per PRD
- `src/hooks/useAuth` wiring (or exposed directly from context — no separate React Query hook needed for auth itself)
- `src/hooks/useUsers.ts` — `useUsers`, `useCreateUser`, `useUpdateUser`
- `src/pages/admin/UsersPage.tsx` — table (Name, Email, Role, Date Added) + "Onboard User" form + active/inactive toggle
- `src/router.tsx` — real routes: `/` (login), `/admin/users` under `<AdminRoute>`, both wrapped correctly
- Nav shell entry for Admin → Users (minimal `AppShell`/`Sidebar` scaffolding needed here since it's the first authenticated page — kept intentionally bare, no polish)

**Dependencies:** Phase 0.

**Rough size:** L

**Definition of done:**
- Run `create_admin.py`, log in at `/` with those credentials, land on an authenticated shell.
- As Admin, visit `/admin/users`, onboard an Employee account (name/email/temp password/role).
- Log out, log back in as the Employee — succeeds, and `/admin/users` is inaccessible (redirect or 403) for that Employee both in the UI and via a direct `curl` to `POST /api/admin/users` with the Employee's token (expect `403 FORBIDDEN`).
- Access token expiry → refresh flow works without forcing a re-login (can verify by shortening `JWT_ACCESS_TTL_MINUTES` temporarily).
- `pytest` and `pnpm typecheck && pnpm lint` pass.

---

## Phase 2 — Module 1: Clients

**Scope:**

Backend:
- `models/client.py` — `Client` ORM model + indexes
- Migration: create `clients` table
- `schemas/client.py` — `ClientCreate`, `ClientUpdate`, `ClientRead` (nested `created_by: {id, full_name}`)
- `services/client_service.py` — list (paginated, search across contact_person_name/company_name/email), create (email uniqueness → `409 EMAIL_EXISTS`), get by id, update (ownership check: owner or admin), delete (ownership check; cascades handled by DB FK)
- `routers/clients.py` — `GET /api/clients`, `POST /api/clients`, `GET /api/clients/:id`, `PATCH /api/clients/:id`, `DELETE /api/clients/:id`
- Tests: happy/unauth/validation for each endpoint, plus one ownership-403 test (Employee B can't edit Employee A's client) and one duplicate-email 409 test

Frontend:
- `src/types/client.ts`
- `src/api/clients.ts`
- `src/hooks/useClients.ts` — `useClients` (list w/ params), `useClient` (detail), `useCreateClient`, `useUpdateClient`, `useDeleteClient`
- `src/components/shared/DataTable.tsx`, `EmptyState.tsx`, `MetricCard.tsx` — first use of these shared primitives, built here since Clients is the first full CRUD page
- `src/pages/clients/ClientsPage.tsx` — "Total Active Clients: N" badge, table, search box, "+ Add Client" drawer/modal
- `src/pages/clients/ClientForm.tsx` — RHF + Zod (4 fields), inline `409 EMAIL_EXISTS` → "This email is already onboarded to another client."
- `src/pages/clients/ClientsTable.tsx`
- Route `/clients` under `<ProtectedRoute>`, sidebar nav entry
- Basic `AppShell`/`Sidebar`/`Topbar` fleshed out enough to navigate between Dashboard (placeholder for now)/Clients/Admin — bare, no polish

**Dependencies:** Phase 1 (needs auth context, `created_by` attribution, ownership pattern).

**Rough size:** M

**Definition of done:**
- As Employee, add a Client via the form; it appears in the table with correct "Onboarded By"/"Date Added".
- Attempt a duplicate email → inline error shown, no row created.
- Search box filters the table server-side (verify via network tab that `search` query param round-trips).
- As a second Employee account, attempt to edit/delete the first Employee's client → forbidden in UI and via direct API call (`403 FORBIDDEN`). Same action as Admin → succeeds.
- Pagination controls work past 25 rows (can seed via repeated creates or a quick test script).

---

## Phase 3 — Master Lists: Portals & Tender Names

**Scope:**

Backend:
- `models/portal.py`, `models/tender_name.py`
- Migration: create `portals` and `tender_names` tables; seed `tender_names` with `PMC`, `Civil-Works`, `Govt-Supply` in the migration itself (per `DATABASE_SCHEMA.md` §6 — seeding lives in Alembic, not a script)
- `schemas/portal.py`, `schemas/tender_name.py` — `*Create` (`name` only), `*Update` (`name?`, `is_active?`), `*Read`
- `services/portal_service.py`, `services/tender_name_service.py` — list (`active_only` filter), create (admin-only, unique name → `409 PORTAL_EXISTS` / equivalent), update (admin-only)
- `routers/portals.py`, `routers/tender_names.py` — `GET` open to any authenticated role, `POST`/`PATCH` behind `require_admin`
- Tests for both resources: happy/non-admin-403/duplicate-name-409

Frontend:
- `src/types/portal.ts`, `src/types/tender-name.ts`
- `src/api/portals.ts`, `src/api/tender-names.ts`
- `src/hooks/usePortals.ts`, `src/hooks/useTenderNames.ts`
- `src/pages/admin/PortalsPage.tsx`, `src/pages/admin/TenderNamesPage.tsx` — simple table + add form + active/inactive toggle, same shape as Users
- Routes under `<AdminRoute>`: `/admin/portals`, `/admin/tender-names`; nav entries

**Dependencies:** Phase 1 (admin gating pattern). Independent of Phase 2 (no client FK), but sequenced here — right before Phase 4/5 which consume these lists — rather than in Phase 1, to keep that phase scoped to auth itself.

**Rough size:** S

**Definition of done:**
- As Admin, create a Portal and a Tender Name; both appear immediately in their admin tables.
- As Employee, `GET /api/portals` and `GET /api/tender-names` succeed (read-only); `POST` to either as Employee → `403 FORBIDDEN`.
- Deactivating a Portal (`is_active=false`) removes it from `?active_only=true` results but it still resolves by id.
- Seed data confirms present after a fresh `alembic upgrade head` on an empty DB (the 3 seeded tender names).

---

## Phase 4 — Module 2: Credentials Vault

**Scope:**

Backend:
- `models/credential.py` — FK to `clients` (cascade) and `portals` (restrict)
- Migration: create `credentials` table
- `schemas/credential.py` — `CredentialCreate`, `CredentialUpdate`, `CredentialRead` (nested `client`, `portal`, `created_by`; `password` masked unless `reveal=true`)
- `services/credential_service.py` — list (filters: `client_id`, `portal_id`, search on client company_name/portal name; masks password unless `reveal=true`), create (validates client + portal exist → `404 CLIENT_NOT_FOUND`/`404 PORTAL_NOT_FOUND`), update (ownership), delete (ownership)
- `routers/credentials.py` — full CRUD per contract
- Tests: happy/unauth/validation, plus a reveal=true vs default-masked assertion, plus FK-not-found 404 tests

Frontend:
- `src/types/credential.ts`
- `src/api/credentials.ts`
- `src/hooks/useCredentials.ts`
- `src/pages/credentials/CredentialsPage.tsx` — table (Client, Portal, Login Identifier, masked Password w/ click-to-reveal, Added By, Date), search/filter by client or portal
- `src/pages/credentials/CredentialForm.tsx` — searchable Client select, Portal select (active only), login identifier, password
- Route `/credentials`, nav entry

**Dependencies:** Phase 2 (Clients), Phase 3 (Portals).

**Rough size:** M

**Open item this phase must resolve before backend work starts:** the contract only specifies list-level `reveal` (`GET /api/credentials?reveal=true`), which would return every row's password unmasked at once. Confirm with the user whether click-to-reveal should hit a per-row endpoint (`GET /api/credentials/:id?reveal=true`) instead — see Open Questions below. Don't guess; this changes the router surface.

**Definition of done:**
- As Employee, save a portal credential for an existing Client against an active Portal.
- Table shows the password masked by default; click-to-reveal shows the real value (mechanism per the resolved open item above).
- Creating a credential against a nonexistent `client_id`/`portal_id` → `404`.
- Deactivated Portals don't appear in the create-form dropdown but existing credential rows referencing them still render correctly.

---

## Phase 5 — Module 3: Tender Tracking & Financial

**Scope:**

Backend:
- `models/tender.py` — FKs to `clients` (cascade), `tender_names` (restrict); `total_amount` as `Computed("quantity * price", persisted=True)`
- Migration: create `tenders` table **hand-edited** to include the generated column (autogenerate won't produce this — see `DATABASE_SCHEMA.md` §5) plus the `tender_status` enum usage and check constraints (`quantity > 0`, `price >= 0`)
- `schemas/tender.py` — `TenderCreate` (no `total_amount`), `TenderUpdate`, `TenderRead` (`price`/`total_amount` serialized as strings)
- `services/tender_service.py` — list (filters: `client_id`, `status`, search), create (validates client + tender_name exist), update (ownership; recompute is automatic via DB), delete (ownership)
- `routers/tenders.py` — full CRUD; quick-action status flip is just `PATCH {status: "Paid"}`, no separate endpoint
- Tests: happy/unauth/validation (`quantity<=0`, `price<0` → 422), FK-not-found 404s, and one test asserting `total_amount` is DB-computed (POST without it, assert it comes back correct)

Frontend:
- `src/types/tender.ts` — `price`/`total_amount` typed as `string`, parsed to number only at render time
- `src/api/tenders.ts`
- `src/hooks/useTenders.ts`
- `src/lib/format.ts` — `formatCurrency` (`Intl.NumberFormat('en-IN', {style:'currency', currency:'INR'})`), `formatDate` (Asia/Kolkata) — first real use, built here
- `src/pages/tenders/TendersPage.tsx` — summary strip (Total Pending / Total Paid), filter bar (Client dropdown, Status segmented control), table with right-aligned currency columns, colored status pill, row-level Pending→Paid quick action
- `src/pages/tenders/TenderForm.tsx` — Client select, Tender Name select, Quantity, Price, read-only auto-computed Total Amount (client-side mirror for UX only — never sent to the API)
- Route `/tenders`, nav entry

**Dependencies:** Phase 2 (Clients), Phase 3 (Tender Names).

**Rough size:** M

**Definition of done:**
- As Employee, log a tender for a Client with a Tender Name, quantity, and price; `total_amount` appears correctly computed and matches `quantity × price` without ever being sent by the client.
- Status defaults to Pending; the quick action flips it to Paid and the summary strip's Paid/Pending totals update.
- Filtering by Client and by Status narrows the table correctly (verify via network tab).
- Submitting `quantity=0` or negative `price` is rejected client-side (Zod) and server-side (422) if bypassed.

---

## Phase 6 — Module 4: DSC Key Management

**Scope:**

Backend:
- `models/dsc_key.py` — FK to `clients` (cascade); note the schema's `created_by uuid not null ... on delete set null` needs a decision before this migration is written (see Open Questions)
- Migration: create `dsc_keys` table
- `schemas/dsc_key.py` — `DscKeyCreate`, `DscKeyUpdate`, `DscKeyRead`
- `services/dsc_key_service.py` — list (filters: `client_id`, `status`, search), create, update (ownership), delete (ownership)
- `routers/dsc.py` — full CRUD
- Tests: happy/unauth/validation

Frontend:
- `src/types/dsc.ts`
- `src/api/dsc.ts`
- `src/hooks/useDsc.ts`
- `src/pages/dsc/DscPage.tsx` — subtitle per PRD, table (Client, Key Status pill, Storage Location Notes prominent, Created By, Created At), filter by client + status, "+ Log Key" drawer
- `src/pages/dsc/DscForm.tsx`
- Route `/dsc`, nav entry

**Dependencies:** Phase 2 (Clients).

**Rough size:** S

**Definition of done:**
- As Employee, log a DSC key for a Client with a status and storage location note.
- A second Employee can view (but not edit/delete) that entry; the storage location note is clearly visible in the table.
- Filtering by client and by key status works.
- Status transitions through all four lifecycle values via edit.

---

## Phase 7 — Dashboard

**Scope:**

Backend:
- `schemas/dashboard.py` — `DashboardSummary`
- `services/dashboard_service.py` — aggregation queries: total client count, pending tender count, sum of `total_amount` where `status='Paid'`, DSC key count where status in (`Key Created`, `Key Returned`), last 5 tenders, last 5 clients (reuse `TenderRead`/`ClientRead` shapes)
- `routers/dashboard.py` — `GET /api/dashboard/summary`
- Tests: happy path with seeded data asserting each metric, unauth 401

Frontend:
- `src/types/dashboard.ts`
- `src/api/dashboard.ts`
- `src/hooks/useDashboard.ts`
- `src/pages/DashboardPage.tsx` — 4 `MetricCard`s, two side-by-side panels (Recent Tenders, Recent Client Onboarding)
- Route `/dashboard` as the default landing route after login (redirect `/` → `/dashboard` once authenticated — see Open Questions)

**Dependencies:** Phase 2 (Clients), Phase 5 (Tenders), Phase 6 (DSC Keys). Built last among features because it aggregates all three.

**Rough size:** S

**Definition of done:**
- Log in; land on `/dashboard` showing correct counts/sums matching what's in the DB (spot-check against the individual module pages).
- Recent Tenders and Recent Clients panels show the last 5 by `created_at` descending.
- Numbers update after creating a new client/tender/DSC key and revisiting the dashboard (cache invalidation or refetch-on-navigation — no live push needed).

---

## Phase 8 — Deployment

**Scope:**

Backend: `requirements.txt` export (`uv pip compile pyproject.toml -o requirements.txt`), Vercel backend project setup, prod env vars, pooled `DATABASE_URL` confirmed, manual `alembic upgrade head` against prod per `DEVELOPMENT_GUIDE.md` §6.2 Option A.

Frontend: Vercel frontend project setup, `VITE_API_BASE_URL` pointed at deployed backend, then loop back to backend `CORS_ORIGINS` with the deployed frontend URL and redeploy.

**Dependencies:** All feature phases (this validates the whole thing works end-to-end in production, per PRD §7 success criterion 6).

**Rough size:** S/M (mostly config, but first real exposure to Vercel Python cold starts / pooled connection behavior)

**Definition of done:**
- Both Vercel projects deployed and live.
- Full login → onboard → client → credential → tender → DSC key flow works against the deployed frontend hitting the deployed backend over HTTPS.
- No CORS errors in the browser console.

---

## Open Questions

Raised here per root `CLAUDE.md`'s "flag it before proceeding" rule — none of these block Phase 0, but several block the phase noted.

1. **`dsc_keys.created_by` is `NOT NULL` with `ON DELETE SET NULL`** (`DATABASE_SCHEMA.md` line ~133) — contradictory: if a referenced user were ever hard-deleted, Postgres would try to set the column null and violate the `NOT NULL` constraint. In practice this likely never fires because there's no user-delete endpoint (soft-disable only), but the DDL as written would explode if it ever did. Blocks Phase 6. **Proposal:** drop `NOT NULL` on `dsc_keys.created_by` to match every other table's `created_by` pattern, unless there's a reason DSC keys specifically must always have an attributed creator — confirm before writing that migration.

2. ~~**Dashboard's "Total Active Clients" metric — clients have no `is_active` column.**~~ **RESOLVED (Phase 2):** implemented as a plain count of all client rows (the paginated `total_count`). There is no soft-delete on `clients` — deletion is a hard cascade — so "active" and "exists" are the same set. Phase 7's dashboard metric must use the same definition.

3. ~~**Frontend pagination param naming mismatch.**~~ **RESOLVED (Phase 1, applied in Phase 2):** the convention is snake_case `page_size` in the params type itself, passed straight through to axios — no camelCase→snake_case mapping layer. See `frontend/src/api/users.ts` and `clients.ts`. `frontend/CLAUDE.md`'s example still shows `pageSize`; treat that example as outdated, the working code is the reference.

4. **Credentials click-to-reveal mechanism is underspecified.** `API_CONTRACT.md` only defines `reveal` as a list-level query param (`GET /api/credentials?reveal=true`), which would unmask every row in the response at once. The PRD UI spec says "Password (masked, click-to-reveal)" per-row. Need to decide: (a) list-level reveal is fine and the frontend just re-fetches the whole filtered list with `reveal=true` when any row is clicked (simplest, matches the contract as written, but slightly wasteful and briefly unmasks other rows too), or (b) add a per-item `GET /api/credentials/:id?reveal=true` endpoint to `API_CONTRACT.md` before Phase 4. Blocks Phase 4 — needs a decision (and a contract update if (b)) before backend work starts.

5. ~~**No redirect from `/` to `/dashboard` after successful login.**~~ **RESOLVED (Phase 1):** `<LoginPage>` redirects itself — it renders `<Navigate to="/dashboard" replace />` when `isAuthenticated`. `<ProtectedRoute>` has no special case for `/`.

6. **Any-employee password reveal is a real exposure, not just a wording nit.** The PRD's "shared read access" model plus the `reveal=true` contract means any Employee can view any other client's stored portal password, with no additional restriction beyond being logged in. This is presumably intentional (matches "any employee can log in to file their tenders" in the Module 2 purpose statement) but is worth one explicit confirmation before Phase 4, since it's the one place the shared-read-access model has real security teeth beyond "everyone sees the same tender list."

7. ~~**JWT claim contents unspecified.**~~ **RESOLVED (Phase 1):** implemented as proposed — `sub` (user id as string UUID), `iat`, `exp`, and `type` (`access` / `refresh`). `get_current_user` rejects a token whose `type` isn't `access`; `/refresh` rejects one whose `type` isn't `refresh`. The user row is still reloaded from the DB on every request, so no claim beyond `sub` is trusted for authorization.

**Still open:** items 1, 4, and 6 — all of which should be resolved before their respective phases (6, 4, and 4) start. Items 2, 3, 5, and 7 were resolved during Phases 1–2 as noted above.

### Decisions made after this plan was written

- **Database is Supabase** ("Tendorflow" project), using the Transaction pooler endpoint. Dev and test currently share one database; see `ARCHITECTURE.md` §7 item 9.
- **RLS is enabled with no policies on every table** as Supabase-specific hardening (blocks the auto-generated PostgREST API). Every new table's migration must include `alter table <name> enable row level security`. This is *not* app authorization — that stays in the service layer.
- **Auth stays custom FastAPI JWT**, explicitly reconfirmed against a proposal to switch to Supabase Auth.
- **Alembic remains the only migration mechanism** — the Supabase MCP connector is used for inspection only, never `apply_migration`, so schema history stays in git and portable.
- **Smoke-test data is intentionally left in the database** between phases so it can be inspected in the Supabase dashboard. One cleanup pass happens after all phases are done.
