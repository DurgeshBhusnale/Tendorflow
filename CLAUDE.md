# CLAUDE.md — Repo Root

You're working in a **monorepo** for an internal tender-filling business tool. This file governs the whole repo. It intentionally stays high-level: it covers what's true across *both* backend and frontend, and how the two sides coordinate. Everything specific to Python/FastAPI lives in `backend/CLAUDE.md`. Everything specific to React/Vite lives in `frontend/CLAUDE.md`. Read the one that applies to what you're editing, in addition to this file.

---

## Orient Yourself

This is an **internal ops tool**. Not public. Not a product. No SEO, no landing page, no self-signup, no marketing surface. Two personas exist: Admin and Employee. Every access decision reduces to those two roles.

Two independently deployable applications live in the same Git repo:

```
tender-app/
├── docs/         ← source of truth: PRD, API contract, DB schema, arch decisions
├── backend/      ← Python + FastAPI, deployed as a Vercel Python project
└── frontend/     ← React + Vite, deployed as a Vercel static project
```

They talk over HTTPS via a REST API. They share nothing at the code level — no shared package, no cross-imports, no root lockfile. This is deliberate: the monorepo will split into two repos later, and the split needs to be a `git subtree` operation, not a refactor.

---

## The Docs Are the Source of Truth

Before doing any non-trivial work, load these:

1. **`docs/PRD.md`** — what we're building and why. If a request contradicts the PRD, flag it before proceeding.
2. **`docs/API_CONTRACT.md`** — the contract between backend and frontend. Every endpoint, every payload shape.
3. **`docs/DATABASE_SCHEMA.md`** — the data model.
4. **`docs/ARCHITECTURE.md`** — stack rationale, deployment specifics, hardening backlog.
5. **`docs/DEVELOPMENT_GUIDE.md`** — how to run, test, migrate, deploy.

**These files are not decoration.** They're the coordination artifact between the two sides. If you change behavior, update the relevant doc in the same commit as the code. If a doc is silent on something you need, update the doc *first*, get a nod, then implement both sides against it. The failure mode we're most avoiding: backend and frontend drifting because someone shipped code without touching the contract.

---

## Repo-Wide Invariants

Rules that apply on both sides. The layer-specific CLAUDE.md files add more, but never contradict these.

1. **The API contract is the coordination point.** Endpoints, payload shapes, error codes, response envelope — both sides derive from `API_CONTRACT.md`. If they disagree, the contract wins, and one side has a bug.
2. **Server-set audit fields, always.** `created_by` and `created_at` are set by the backend from the authenticated user's JWT. Never accepted in a request body, never trusted from a client.
3. **Validate at the edges.** Every request body has a Pydantic schema on the backend. Every form has a Zod schema on the frontend. No untyped payloads flowing through the system.
4. **One response envelope.** `{ success: true, data: ... }` or `{ success: false, error: { code, message } }`. Uniform across every endpoint. Both sides depend on this shape.
5. **Auth on every route.** Everything except `POST /api/auth/login`, `POST /api/auth/refresh`, and `GET /api/health` requires a valid session. Frontend enforces at the router level, backend enforces at the dependency level. Both, not one.
6. **Two-role permission model.** Admin vs Employee. Ownership (`created_by == current_user.id`) is the third axis. No fourth role, no group system, no per-object ACLs — if you feel you need one, stop and ask.
7. **No secrets in the repo.** `.env` is gitignored. `.env.example` holds variable names with placeholder values. If you find a real credential in a diff, stop and ask before continuing.

---

## Monorepo Rules That Preserve the Future Split

The monorepo exists for developer convenience today. It has to split cleanly into `tender-app-backend` and `tender-app-frontend` when we're ready. These rules make that a `git subtree split` command instead of a week of refactoring:

- **No cross-imports.** `backend/` never imports from `frontend/` and vice versa.
- **No shared package at the root.** No root `package.json` with workspaces, no root `pyproject.toml`, no `packages/shared` folder. Each side owns its own dependencies and its own lockfile.
- **No root `.env`.** Env files live inside `backend/` and `frontend/`.
- **`docs/` will duplicate on split.** Both new repos need it. Design docs accordingly — no assumption that only one side reads them.
- **If a type must exist on both sides, duplicate it.** Once in Pydantic, once in TypeScript. The API contract is the coordination point; sharing a type file across the boundary is the coupling we're avoiding.

If a change requires breaking any of these rules, stop and ask first. There's usually a better shape.

---

## Working Style

**Plan before you code.** For anything touching more than one or two files, state the plan first — files you'll create/edit, the shape of the change, the order — then execute. This is especially true for anything that spans backend and frontend.

**Small, reviewable commits.** One logical change per commit. Format: `<area>: <what changed>`. Examples:
- `backend/clients: add email uniqueness check`
- `frontend/tenders: wire status filter to query params`
- `docs/api: add DELETE /api/dsc/:id spec`

**Docs and code move together.** Adding an endpoint? `API_CONTRACT.md` updates in the same commit. Changing a table? `DATABASE_SCHEMA.md` reflects it. Never a "docs cleanup" commit two weeks after the fact.

**Prototype-phase testing.** Backend: pytest per endpoint at minimum (happy path + one auth failure + one validation failure). Frontend: manual smoke test via the running dev server for now. Unit tests welcome but not required until the UI stabilizes.

**UI is deprioritized right now.** Explicitly. Use Tailwind defaults and shadcn/ui primitives as-is. Don't spend a session polishing visuals — that's a separate pass with its own goals. The prototype is "done" when the workflows in `PRD.md` §7 work end to end.

---

## When You're Unsure

- **Product question** ("should Employees be able to delete other Employees' clients?") → check the PRD. If silent, ask before deciding.
- **API shape question** ("what should this endpoint return?") → check `API_CONTRACT.md`. If silent, propose an entry, get confirmation, then implement.
- **A spec contradicts itself** or a change would break another module → flag it in your response before proceeding. Don't paper over it silently.
- **You're about to break a rule in this file** (add a shared package, skip a doc update, put a secret somewhere convenient) → stop. Ask. There's almost always a better path.

Vibe-coding this doesn't mean skipping thought. It means moving fast on a solid spec. This doc set *is* the spec. Trust it, and update it when reality changes.