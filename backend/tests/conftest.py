from collections.abc import AsyncGenerator
from uuid import uuid4

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.core.auth import hash_password
from app.core.deps import get_db_session
from app.main import create_app
from app.models.user import User


def _test_database_url() -> str:
    settings = get_settings()
    if settings.TEST_DATABASE_URL:
        return settings.TEST_DATABASE_URL
    base_url = settings.DATABASE_URL
    scheme_and_host, _, db_name = base_url.rpartition("/")
    db_name, sep, query = db_name.partition("?")
    return f"{scheme_and_host}/{db_name}_test{sep}{query}"


test_engine = create_async_engine(
    _test_database_url(),
    poolclass=NullPool,
    # Supabase's Supavisor pooler runs in transaction mode, which doesn't
    # support asyncpg's server-side prepared statement cache.
    connect_args={"statement_cache_size": 0},
)


@pytest.fixture
def app() -> FastAPI:
    return create_app()


@pytest.fixture
async def client(app: FastAPI) -> AsyncGenerator[AsyncClient, None]:
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def db_session(app: FastAPI) -> AsyncGenerator[AsyncSession, None]:
    """A DB session bound to a transaction that's rolled back after the test,
    and wired into `app` so requests made via `client` share it."""
    async with test_engine.connect() as connection:
        transaction = await connection.begin()
        session_maker = async_sessionmaker(bind=connection, expire_on_commit=False)
        session = session_maker()

        async def _override_get_db_session():
            yield session

        app.dependency_overrides[get_db_session] = _override_get_db_session
        try:
            yield session
        finally:
            app.dependency_overrides.pop(get_db_session, None)
            await session.close()
            await transaction.rollback()


@pytest.fixture
def uniq() -> str:
    """A short token unique to this test.

    Tests share a database with committed demo/smoke data (see
    DEVELOPMENT_GUIDE.md section 5), so anything a test inserts under a fixed
    name risks colliding with a row that is already there. Suffix names and
    emails with this, and assert on membership rather than absolute counts.
    """
    return uuid4().hex[:10]


@pytest.fixture
def make_user(db_session: AsyncSession, uniq: str):
    """Factory fixture: creates and commits a user, returns (user, plaintext_password)."""

    async def _make_user(
        *,
        username: str | None = None,
        email: str | None = None,
        password: str = "Password123",
        role: str = "employee",
        full_name: str = "Test User",
        is_active: bool = True,
    ) -> tuple[User, str]:
        email = email or f"user-{uniq}@example.com"
        # Usernames are unique and are what login takes, so they track the
        # email's local part unless a test needs something specific.
        username = username or email.split("@")[0]
        user = User(
            full_name=full_name,
            username=username,
            email=email,
            password_hash=hash_password(password),
            role=role,
            is_active=is_active,
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user, password

    return _make_user


async def _login_headers(client: AsyncClient, username: str, password: str) -> dict[str, str]:
    resp = await client.post("/api/auth/login", json={"username": username, "password": password})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_user(make_user, uniq: str) -> tuple[User, str]:
    return await make_user(email=f"admin-{uniq}@example.com", role="admin", full_name="Test Admin")


@pytest.fixture
async def admin_headers(client: AsyncClient, admin_user: tuple[User, str]) -> dict[str, str]:
    user, password = admin_user
    return await _login_headers(client, user.username, password)


@pytest.fixture
async def employee_user(make_user, uniq: str) -> tuple[User, str]:
    return await make_user(email=f"employee-{uniq}@example.com", role="employee")


@pytest.fixture
async def employee_headers(client: AsyncClient, employee_user: tuple[User, str]) -> dict[str, str]:
    user, password = employee_user
    return await _login_headers(client, user.username, password)


@pytest.fixture
async def other_employee_headers(client: AsyncClient, make_user, uniq: str) -> dict[str, str]:
    """A second, distinct employee — for cross-ownership permission tests."""
    user, password = await make_user(
        email=f"other-employee-{uniq}@example.com", role="employee", full_name="Other Employee"
    )
    return await _login_headers(client, user.username, password)
