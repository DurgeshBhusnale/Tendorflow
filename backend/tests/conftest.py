from collections.abc import AsyncGenerator

import pytest
from fastapi import FastAPI
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.database import get_db_session
from app.main import create_app


def _test_database_url() -> str:
    settings = get_settings()
    if settings.TEST_DATABASE_URL:
        return settings.TEST_DATABASE_URL
    base_url = settings.DATABASE_URL
    scheme_and_host, _, db_name = base_url.rpartition("/")
    db_name, sep, query = db_name.partition("?")
    return f"{scheme_and_host}/{db_name}_test{sep}{query}"


test_engine = create_async_engine(_test_database_url(), poolclass=NullPool)


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
