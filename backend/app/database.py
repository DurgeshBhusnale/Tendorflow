from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import get_settings

settings = get_settings()

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=settings.SQLALCHEMY_ECHO,
    # A serverless instance handles one request at a time, so a single pooled
    # connection covers the common case. The overflow absorbs the brief window
    # where a slow request overlaps the next invocation. Reusing the socket
    # across warm invocations is what matters here: a cold connect costs a TCP
    # handshake, a TLS negotiation and SCRAM auth before any query runs.
    pool_size=1,
    max_overflow=2,
    # Vercel freezes idle instances and Supavisor drops idle upstreams, so a
    # thawed instance can be holding a socket the server already closed.
    # Recycle well inside that window, and check liveness on checkout.
    pool_recycle=280,
    pool_pre_ping=True,
    # Supabase's Supavisor pooler runs in transaction mode, which doesn't
    # support asyncpg's server-side prepared statement cache.
    connect_args={"statement_cache_size": 0},
)

async_session_maker = async_sessionmaker(engine, expire_on_commit=False)
