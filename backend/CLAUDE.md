# CLAUDE.md — Backend

Extends the root `CLAUDE.md`. Read that first, then this. This file governs everything under `backend/`.

---

## Stack

- Python **3.12**
- **FastAPI** (async)
- **SQLAlchemy 2.0** async with `asyncpg` driver
- **Alembic** for migrations
- **Pydantic v2** for schemas + settings
- **python-jose[cryptography]** for JWT
- **passlib[bcrypt]** for password hashing
- **uv** for dependency management
- **pytest** + **pytest-asyncio** + **httpx** for tests
- **ruff** for lint + format

---

## Folder Layout & Responsibilities

```
backend/
├── api/
│   └── index.py         # Vercel serverless entry — just imports the FastAPI app
├── app/
│   ├── main.py          # FastAPI app factory: routers, middleware, exception handlers
│   ├── config.py        # pydantic-settings — reads env vars once
│   ├── database.py      # SQLAlchemy engine + async_sessionmaker + get_db_session dep
│   ├── core/
│   │   ├── auth.py      # JWT encode/decode, password hashing
│   │   ├── deps.py      # FastAPI dependencies: get_current_user, require_admin, get_db_session
│   │   ├── exceptions.py# Custom exception classes + FastAPI handlers
│   │   └── logging.py   # Logger config
│   ├── models/          # SQLAlchemy ORM models — one file per aggregate
│   │   ├── user.py
│   │   ├── client.py
│   │   ├── portal.py
│   │   ├── credential.py
│   │   ├── tender.py
│   │   └── dsc_key.py
│   ├── schemas/         # Pydantic request/response schemas — one file per resource
│   │   ├── auth.py
│   │   ├── user.py
│   │   ├── client.py
│   │   └── ...
│   ├── routers/         # FastAPI APIRouter modules — one per resource, HTTP-only
│   │   ├── auth.py
│   │   ├── users.py
│   │   ├── clients.py
│   │   └── ...
│   ├── services/        # Business logic — pure functions taking session + user + payload
│   │   ├── client_service.py
│   │   ├── tender_service.py
│   │   └── ...
│   ├── db/
│   │   └── migrations/  # Alembic
│   └── scripts/
│       └── create_admin.py  # bootstrap CLI
└── tests/
    ├── conftest.py      # fixtures: test client, test DB session, auth headers
    ├── test_auth.py
    ├── test_clients.py
    └── ...
```

### Layer responsibilities (strict)

| Layer | Responsibility | Never contains |
|---|---|---|
| `routers/` | HTTP concerns only: parse request, call service, return response. | Business logic, direct DB queries beyond simple .get. |
| `services/` | Business rules, permission checks, orchestrating repo calls. | HTTP status codes, `Request`/`Response` objects, framework details. |
| `models/` | SQLAlchemy ORM class definitions. | Business logic, computed properties beyond trivial column derivations. |
| `schemas/` | Pydantic classes for request bodies, response models, and internal DTOs. | Business logic, DB calls. |
| `core/` | Cross-cutting infrastructure: auth, deps, exceptions, logging. | Feature-specific logic. |

If you're about to put a query in a router or an HTTP concern in a service — stop, move it.

---

## Patterns

### The FastAPI Route Pattern

```python
# app/routers/clients.py
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db_session, get_current_user
from app.models.user import User
from app.schemas.client import ClientCreate, ClientRead
from app.schemas.common import ok
from app.services import client_service

router = APIRouter(prefix="/api/clients", tags=["clients"])

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_client(
    payload: ClientCreate,
    session: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    client = await client_service.create_client(session, current_user, payload)
    return ok(ClientRead.model_validate(client))
```

The router does exactly four things: declare the route, declare its dependencies, call the service, wrap the result. Nothing else.

### The Service Pattern

```python
# app/services/client_service.py
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.client import Client
from app.models.user import User
from app.schemas.client import ClientCreate, ClientUpdate
from app.core.exceptions import ConflictError, NotFoundError, ForbiddenError

async def create_client(
    session: AsyncSession,
    current_user: User,
    payload: ClientCreate,
) -> Client:
    existing = await session.scalar(select(Client).where(Client.email == payload.email))
    if existing is not None:
        raise ConflictError(code="EMAIL_EXISTS", message="This email is already onboarded to another client.")

    client = Client(**payload.model_dump(), created_by=current_user.id)
    session.add(client)
    await session.commit()
    await session.refresh(client)
    return client

async def update_client(
    session: AsyncSession,
    current_user: User,
    client_id: UUID,
    payload: ClientUpdate,
) -> Client:
    client = await session.get(Client, client_id)
    if client is None:
        raise NotFoundError(code="NOT_FOUND", message="Client not found")
    if client.created_by != current_user.id and current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="You can only edit clients you created")
    # ... apply updates
```

Services take `session`, `current_user`, and a validated payload. They raise domain exceptions, never `HTTPException`. The exception handler in `app/main.py` maps domain exceptions to HTTP responses.

### The Response Envelope

Define once, reuse everywhere:

```python
# app/schemas/common.py
from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")

class Envelope(BaseModel, Generic[T]):
    success: bool
    data: T | None = None
    error: dict | None = None

def ok(data):
    return {"success": True, "data": data}

def paginated(items, total_count: int, page: int, page_size: int):
    return {"success": True, "data": {
        "items": items, "total_count": total_count, "page": page, "page_size": page_size
    }}
```

Every route returns via `ok(...)` or `paginated(...)`. Errors are raised as exceptions and formatted by the central handler.

### Auth Dependencies

```python
# app/core/deps.py
async def get_current_user(
    authorization: str = Header(...),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    # parse "Bearer <token>", decode JWT, load User, return
    ...

async def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != "admin":
        raise ForbiddenError(code="FORBIDDEN", message="Admin access required")
    return current_user
```

Every non-public route depends on `get_current_user`. Admin-only routes swap it for `require_admin`.

### Database Session Dependency

```python
# app/core/deps.py
async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session
```

Session is per-request. Never share sessions across requests. Never store a session on a global.

The engine keeps a small pool so a warm serverless instance reuses its connection
instead of re-running the TCP + TLS + SCRAM handshake on every request:

```python
# app/database.py
engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQLALCHEMY_ECHO,
    pool_size=1,          # one in-flight request per instance
    max_overflow=2,
    pool_recycle=280,     # inside Supavisor's idle timeout
    pool_pre_ping=True,   # instances get frozen; check liveness on checkout
    connect_args={"statement_cache_size": 0},
)
```

This reversed an earlier `poolclass=NullPool` setting — see `docs/ARCHITECTURE.md` §2 for the
measurements, and for the event-loop caveat that would send it back to `NullPool`. Alembic's
`env.py` and `tests/conftest.py` still use `NullPool`, correctly: both are one-shot processes.

---

## Do's

- **Use `select(...)` with SQLAlchemy 2.0 style**, not the legacy `session.query(...)`.
- **Use `Mapped[...]` and `mapped_column()`** for model definitions (2.0 typed API).
- **Use `Decimal` for money**, never `float`. Import from `decimal`.
- **Use `uuid.UUID` throughout**, never string IDs at the type level (Pydantic + SQLAlchemy handle serialization).
- **Use `Annotated[...]` for FastAPI dependencies** if you find yourself repeating the same `Depends(...)` chain.
- **Return the ORM object from services**, let the router serialize via `Model.model_validate(orm_obj)` with `model_config = ConfigDict(from_attributes=True)` on the Pydantic schema.
- **Log at INFO for state changes**, DEBUG for tracing, WARNING for recoverable oddities, ERROR for unhandled cases.
- **Type every function signature.** Pydantic v2 + modern Python types — no `Optional[X]`, use `X | None`.

---

## Don'ts

- **Don't put raw SQL in services** unless there's no ORM equivalent (rare). If you must, use `text()` and bind parameters — never string-format user input into SQL.
- **Don't create sessions inside services.** Sessions are dependencies passed in from the router.
- **Don't `await session.commit()` inside a service that might be composed with other services.** Prefer having the router / a "unit of work" wrapper own commit boundaries. For now (prototype), each service owns its commit; note this as a refactor point if we grow.
- **Don't return SQLAlchemy models directly from a router.** Always wrap in a Pydantic response model — otherwise lazy-load errors and accidental field exposure will bite you.
- **Don't accept `created_by` in a request body.** Ever. It comes from `current_user.id` in the service.
- **Don't skip Alembic** for a schema change, even a "quick tweak."
- **Don't add a background task, worker, or cache.** Prototype scope. If you feel you need one, flag it — we'll discuss.
- **Don't use `print()`.** Use the logger.

---

## Adding a New Endpoint — Checklist

Copy this into your commit as a mental checklist:

1. [ ] Entry exists in `docs/API_CONTRACT.md`.
2. [ ] SQLAlchemy model updated (if data shape changed).
3. [ ] Alembic migration generated, reviewed, applied.
4. [ ] Pydantic request schema added in `app/schemas/`.
5. [ ] Pydantic response schema added in `app/schemas/`.
6. [ ] Service function added in `app/services/`.
7. [ ] Router added / updated in `app/routers/`.
8. [ ] Router registered in `app/main.py` if new.
9. [ ] Auth dependency correct (`get_current_user` or `require_admin`).
10. [ ] Tests: happy path + auth failure + validation failure.

---

## Testing Patterns

```python
# tests/conftest.py
@pytest.fixture
async def client(app):
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac

@pytest.fixture
async def admin_headers(client, db_session):
    # create an admin, log in, return { "Authorization": "Bearer ..." }
    ...

# tests/test_clients.py
async def test_create_client_happy_path(client, admin_headers):
    resp = await client.post("/api/clients", json={
        "contact_person_name": "Rohan",
        "company_name": "Mehta Constructions",
        "contact_number": "+919876543210",
        "email": "rohan@mehta.com",
    }, headers=admin_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["success"] is True
    assert body["data"]["email"] == "rohan@mehta.com"

async def test_create_client_requires_auth(client):
    resp = await client.post("/api/clients", json={...})
    assert resp.status_code == 401
    assert resp.json()["error"]["code"] == "UNAUTHENTICATED"
```

Every router file has a corresponding `test_<router>.py`. Every endpoint gets at least three tests: happy, unauth, invalid payload.

---

## Formatting & Linting

```bash
uv run ruff check .        # lint
uv run ruff check --fix .  # auto-fix
uv run ruff format .       # format
```

CI (once added) runs `ruff check` in strict mode. Passing locally is a prerequisite for pushing.
