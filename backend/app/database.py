from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    poolclass=NullPool,
    echo=settings.SQLALCHEMY_ECHO,
    # Supabase's Supavisor pooler runs in transaction mode, which doesn't
    # support asyncpg's server-side prepared statement cache.
    connect_args={"statement_cache_size": 0},
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
