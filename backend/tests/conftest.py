from collections.abc import AsyncGenerator

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
def make_user(db_session: AsyncSession):
    """Factory fixture: creates and commits a user, returns (user, plaintext_password)."""

    async def _make_user(
        *,
        email: str = "user@example.com",
        password: str = "Password123",
        role: str = "employee",
        full_name: str = "Test User",
        is_active: bool = True,
    ) -> tuple[User, str]:
        user = User(
            full_name=full_name,
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


async def _login_headers(client: AsyncClient, email: str, password: str) -> dict[str, str]:
    resp = await client.post("/api/auth/login", json={"email": email, "password": password})
    token = resp.json()["data"]["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def admin_headers(client: AsyncClient, make_user) -> dict[str, str]:
    user, password = await make_user(email="admin@example.com", role="admin")
    return await _login_headers(client, user.email, password)


@pytest.fixture
async def employee_headers(client: AsyncClient, make_user) -> dict[str, str]:
    user, password = await make_user(email="employee@example.com", role="employee")
    return await _login_headers(client, user.email, password)
