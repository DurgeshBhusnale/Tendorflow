# Tender Filling Business — Internal Ops Tool

Internal, authentication-gated web application for a tender-filling business. Handles client onboarding, portal credential storage, tender transaction tracking, and physical DSC (Digital Signature Certificate) USB key location tracking.

**Not** a public product. No SEO, no landing page, no self-signup. Every route sits behind auth.

---

## Stack

| Layer | Choice |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Pydantic v2 |
| Frontend | React 19 + TypeScript, Vite, TanStack Query, React Router v7, React Hook Form + Zod, Tailwind CSS |
| Database | PostgreSQL (Supabase or Neon — either works, both are Postgres) |
| Auth | JWT (access + refresh tokens), bcrypt password hashing — issued by the FastAPI backend |
| Hosting | Vercel (two projects, same monorepo — backend as Python serverless, frontend as static Vite build) |
| Package mgmt | `uv` (backend), `pnpm` (frontend) |

---

## Monorepo Layout

```
tender-app/
├── README.md                  # this file
├── CLAUDE.md                  # repo-wide rules for Claude Code
├── .gitignore
├── docs/
│   ├── PRD.md                 # product requirements
│   ├── ARCHITECTURE.md        # stack decisions, deployment, monorepo split plan
│   ├── API_CONTRACT.md        # REST endpoint spec
│   ├── DATABASE_SCHEMA.md     # DDL + migration approach
│   └── DEVELOPMENT_GUIDE.md   # local setup, env vars, workflows
├── backend/
│   ├── CLAUDE.md              # backend-specific rules
│   ├── pyproject.toml
│   ├── requirements.txt       # exported from uv for Vercel
│   ├── vercel.json
│   ├── .env.example
│   ├── api/
│   │   └── index.py           # Vercel serverless entry point
│   ├── app/
│   │   ├── main.py            # FastAPI app factory
│   │   ├── config.py          # settings via pydantic-settings
│   │   ├── database.py        # SQLAlchemy engine + session
│   │   ├── core/              # auth, security, deps
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── schemas/           # Pydantic request/response schemas
│   │   ├── routers/           # FastAPI routers (one per module)
│   │   ├── services/          # business logic layer
│   │   └── db/
│   │       └── migrations/    # Alembic versions
│   └── tests/
└── frontend/
    ├── CLAUDE.md              # frontend-specific rules
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── .env.example
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx
        ├── router.tsx
        ├── api/               # axios client + typed endpoint fns
        ├── auth/              # auth context, token storage, guards
        ├── components/
        │   ├── ui/            # primitive UI components
        │   └── shared/        # composed shared components (tables, drawers)
        ├── pages/             # one folder per route
        ├── hooks/
        ├── lib/               # utils, formatters
        └── types/             # shared TS types
```

**Why this shape:** `backend/` and `frontend/` are fully self-contained. Neither imports from the other, neither shares a package manager lockfile with the other. When you're ready to split into two repos, `git subtree split --prefix=frontend -b frontend-only` (and same for backend) gives you two clean repos with preserved history and zero refactoring.

---

## Quick Start

Prerequisites: Python 3.12+, Node 20+, `uv`, `pnpm`, and a Postgres database URL (get one free from Supabase or Neon).

```bash
# 1. Backend
cd backend
cp .env.example .env               # fill in DATABASE_URL, JWT_SECRET, etc.
uv sync                            # installs dependencies from pyproject.toml
uv run alembic upgrade head        # apply migrations
uv run uvicorn app.main:app --reload --port 8000
# Backend now on http://localhost:8000, docs at /docs

# 2. Frontend (new terminal)
cd frontend
cp .env.example .env               # set VITE_API_BASE_URL=http://localhost:8000
pnpm install
pnpm dev
# Frontend now on http://localhost:5173

# 3. Create the first admin user (one-off bootstrap script)
cd backend
uv run python -m app.scripts.create_admin  # prompts for email/password/name
```

See `docs/DEVELOPMENT_GUIDE.md` for full local setup, testing, migrations, and deployment steps.

---

## Where to Read Next

If you're a human reading this, or Claude Code planning work, load these in this order:

1. `CLAUDE.md` (root) — the rules of the repo
2. `docs/PRD.md` — what we're building and why
3. `docs/ARCHITECTURE.md` — how the pieces fit
4. `docs/API_CONTRACT.md` — the contract between backend and frontend
5. `docs/DATABASE_SCHEMA.md` — data model
6. `backend/CLAUDE.md` and `frontend/CLAUDE.md` — layer-specific conventions
