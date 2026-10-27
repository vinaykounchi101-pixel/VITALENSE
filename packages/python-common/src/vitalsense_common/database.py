"""Database Connection and Session Lifecycle Management.

Implements DATA-004, DATA-007, and ARCH-004:
- Central PostgreSQL as single authoritative server-side store
- Transaction boundaries with automatic rollback on error
- Safe health check probing without leaking internal credentials or stack traces
"""

from __future__ import annotations

import logging
from typing import AsyncGenerator, Optional

from sqlalchemy import text
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from vitalsense_common.config import settings
from vitalsense_common.logging import logger

_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[AsyncSession]] = None


def get_engine() -> AsyncEngine:
    """Retrieve or initialize the SQLAlchemy async database engine."""
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            settings.DATABASE_URL,
            echo=settings.DEBUG and settings.ENVIRONMENT == "development",
            pool_size=settings.POSTGRES_POOL_SIZE,
            max_overflow=settings.POSTGRES_MAX_OVERFLOW,
            pool_pre_ping=True,
        )
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Retrieve or initialize the async sessionmaker."""
    global _session_factory
    if _session_factory is None:
        engine = get_engine()
        _session_factory = async_sessionmaker(
            bind=engine,
            class_=AsyncSession,
            expire_on_commit=False,
            autocommit=False,
            autoflush=False,
        )
    return _session_factory


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency yielding an async database session within a transaction boundary.

    Implements DATA-007: Safe atomic transactions with automatic rollback on error.
    """
    session_factory = get_session_factory()
    async with session_factory() as session:
        try:
            yield session
            await session.commit()
        except Exception as exc:
            await session.rollback()
            logger.error("Database transaction rolled back due to error", exc_info=exc)
            raise


async def check_database_health() -> bool:
    """Execute a lightweight probe to verify database connectivity.

    Returns True if healthy, False if unreachable or disconnected.
    Never exposes credentials or internal errors (DEP-010).
    """
    try:
        engine = get_engine()
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            return result.scalar() == 1
    except Exception as exc:
        logger.warning("Database readiness probe failed", exc_info=exc)
        return False


async def close_database_connections() -> None:
    """Dispose of the database engine and close connection pools during application shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
        _engine = None
        _session_factory = None
        logger.info("Database connection pools cleanly closed.")
