"""Async SQLAlchemy engine and session factory."""

from __future__ import annotations

import logging
import os
from typing import Any, Optional

from sqlalchemy.ext.asyncio import AsyncEngine, async_sessionmaker, create_async_engine
from db.base import Base

logger = logging.getLogger("manthana.research.db")


def normalize_asyncpg_url(url: str) -> str:
    """Convert postgresql:// to postgresql+asyncpg:// for SQLAlchemy async."""
    if "+asyncpg" in url or "+psycopg" in url:
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


def resolve_database_url(explicit: Optional[str] = None) -> Optional[str]:
    """Prefer explicit setting, then DATABASE_URL / RESEARCH_DATABASE_URL from env."""
    url = (
        (explicit or "").strip()
        or os.environ.get("DATABASE_URL", "").strip()
        or os.environ.get("RESEARCH_DATABASE_URL", "").strip()
    )
    return url or None


_engine: Optional[AsyncEngine] = None
_session_factory: Optional[async_sessionmaker[Any]] = None


def get_engine(database_url: str) -> AsyncEngine:
    global _engine
    if _engine is None:
        _engine = create_async_engine(
            normalize_asyncpg_url(database_url),
            pool_pre_ping=True,
            pool_size=5,
            max_overflow=10,
        )
    return _engine


def get_session_factory(database_url: str) -> async_sessionmaker[Any]:
    global _session_factory
    if _session_factory is None:
        engine = get_engine(database_url)
        _session_factory = async_sessionmaker(engine, expire_on_commit=False)
    return _session_factory


async def init_db(engine: AsyncEngine) -> None:
    """Create tables if they do not exist."""
    from db.models import ResearchThread  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("research_db tables ready")
