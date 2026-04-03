"""
database.py — Web Service PostgreSQL Models
============================================
Database layer for search cache, analytics, and history.
Uses asyncpg for async PostgreSQL access.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger("manthana.web.db")

# Optional asyncpg — graceful fallback if not installed
try:
    import asyncpg
    _ASYNCPG_AVAILABLE = True
except ImportError:
    asyncpg = None  # type: ignore
    _ASYNCPG_AVAILABLE = False


class Database:
    """Async PostgreSQL connection pool for web-service."""

    def __init__(self, url: str):
        self.url = url
        self._pool: Optional[asyncpg.Pool] = None

    async def connect(self) -> None:
        """Create connection pool."""
        if not _ASYNCPG_AVAILABLE:
            logger.warning("asyncpg not installed — database disabled")
            return
        try:
            self._pool = await asyncpg.create_pool(
                self.url,
                min_size=2,
                max_size=10,
                command_timeout=10,
            )
            await self._pool.execute("SELECT 1")
            logger.info("Web database connected")
        except Exception as e:
            logger.warning(f"Web database unavailable: {e}")
            self._pool = None

    async def close(self) -> None:
        """Close connection pool."""
        if self._pool:
            await self._pool.close()
            self._pool = None
            logger.info("Web database disconnected")

    @property
    def available(self) -> bool:
        return self._pool is not None and _ASYNCPG_AVAILABLE

    async def init_schema(self) -> None:
        """Create tables if they don't exist."""
        if not self.available:
            return
        try:
            await self._pool.execute("""
                CREATE TABLE IF NOT EXISTS search_cache (
                    id SERIAL PRIMARY KEY,
                    query_hash VARCHAR(64) UNIQUE NOT NULL,
                    query TEXT NOT NULL,
                    category VARCHAR(50) NOT NULL,
                    page INT NOT NULL DEFAULT 1,
                    results JSONB NOT NULL,
                    images JSONB DEFAULT '[]',
                    videos JSONB DEFAULT '[]',
                    related_questions JSONB DEFAULT '[]',
                    engines_used JSONB DEFAULT '[]',
                    total INT DEFAULT 0,
                    ttl TIMESTAMP NOT NULL,
                    created_at TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_search_cache_query_hash ON search_cache(query_hash);
                CREATE INDEX IF NOT EXISTS idx_search_cache_ttl ON search_cache(ttl);

                CREATE TABLE IF NOT EXISTS search_history (
                    id SERIAL PRIMARY KEY,
                    user_id VARCHAR(255),
                    query TEXT NOT NULL,
                    category VARCHAR(50) DEFAULT 'medical',
                    timestamp TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_search_history_user ON search_history(user_id);
                CREATE INDEX IF NOT EXISTS idx_search_history_timestamp ON search_history(timestamp);

                CREATE TABLE IF NOT EXISTS click_analytics (
                    id SERIAL PRIMARY KEY,
                    query TEXT NOT NULL,
                    result_url TEXT NOT NULL,
                    position INT NOT NULL,
                    clicked BOOLEAN DEFAULT TRUE,
                    user_id VARCHAR(255),
                    timestamp TIMESTAMP DEFAULT NOW()
                );
                CREATE INDEX IF NOT EXISTS idx_click_analytics_query ON click_analytics(query);
                CREATE INDEX IF NOT EXISTS idx_click_analytics_timestamp ON click_analytics(timestamp);
            """)
            logger.info("Web database schema initialized")
        except Exception as e:
            logger.warning(f"Schema init failed: {e}")

    async def get_cached_search(
        self, query_hash: str
    ) -> Optional[Dict[str, Any]]:
        """Get cached search results if not expired."""
        if not self.available:
            return None
        try:
            row = await self._pool.fetchrow(
                """
                SELECT results, images, videos, related_questions,
                       engines_used, total
                FROM search_cache
                WHERE query_hash = $1 AND ttl > NOW()
                """,
                query_hash,
            )
            if row:
                return {
                    "results": row["results"],
                    "images": row["images"] or [],
                    "videos": row["videos"] or [],
                    "related_questions": row["related_questions"] or [],
                    "engines_used": row["engines_used"] or ["SearXNG"],
                    "total": row["total"] or 0,
                }
        except Exception as e:
            logger.debug(f"Cache get error: {e}")
        return None

    async def set_cached_search(
        self,
        query_hash: str,
        query: str,
        category: str,
        page: int,
        data: Dict[str, Any],
        ttl_seconds: int = 600,
    ) -> None:
        """Cache search results."""
        if not self.available:
            return
        try:
            ttl = datetime.utcnow() + timedelta(seconds=ttl_seconds)
            await self._pool.execute(
                """
                INSERT INTO search_cache
                (query_hash, query, category, page, results, images, videos,
                 related_questions, engines_used, total, ttl)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
                ON CONFLICT (query_hash) DO UPDATE SET
                    results = EXCLUDED.results,
                    images = EXCLUDED.images,
                    videos = EXCLUDED.videos,
                    related_questions = EXCLUDED.related_questions,
                    engines_used = EXCLUDED.engines_used,
                    total = EXCLUDED.total,
                    ttl = EXCLUDED.ttl
                """,
                query_hash,
                query,
                category,
                page,
                json.dumps(data.get("results", [])),
                json.dumps(data.get("images", [])),
                json.dumps(data.get("videos", [])),
                json.dumps(data.get("related_questions", [])),
                json.dumps(data.get("engines_used", ["SearXNG"])),
                data.get("total", 0),
                ttl,
            )
        except Exception as e:
            logger.debug(f"Cache set error: {e}")

    async def record_search(
        self, user_id: Optional[str], query: str, category: str = "medical"
    ) -> None:
        """Record search for history/trending."""
        if not self.available:
            return
        try:
            await self._pool.execute(
                """
                INSERT INTO search_history (user_id, query, category)
                VALUES ($1, $2, $3)
                """,
                user_id or "",
                query[:500],
                category,
            )
        except Exception as e:
            logger.debug(f"History record error: {e}")

    async def record_click(
        self,
        query: str,
        result_url: str,
        position: int,
        user_id: Optional[str] = None,
    ) -> None:
        """Record result click for analytics."""
        if not self.available:
            return
        try:
            await self._pool.execute(
                """
                INSERT INTO click_analytics (query, result_url, position, user_id)
                VALUES ($1, $2, $3, $4)
                """,
                query[:500],
                result_url[:2000],
                position,
                user_id or "",
            )
        except Exception as e:
            logger.debug(f"Click record error: {e}")

    async def get_search_history(
        self, user_id: Optional[str] = None, limit: int = 50
    ) -> List[Dict[str, Any]]:
        """Get search history for a user (or recent global if no user)."""
        if not self.available:
            return []
        try:
            if user_id:
                rows = await self._pool.fetch(
                    """
                    SELECT query, category, timestamp
                    FROM search_history
                    WHERE user_id = $1 AND query IS NOT NULL
                    ORDER BY timestamp DESC
                    LIMIT $2
                    """,
                    user_id,
                    limit,
                )
            else:
                rows = await self._pool.fetch(
                    """
                    SELECT query, category, timestamp
                    FROM search_history
                    WHERE query IS NOT NULL AND LENGTH(TRIM(query)) >= 2
                    ORDER BY timestamp DESC
                    LIMIT $1
                    """,
                    limit,
                )
            return [
                {"query": r["query"], "category": r["category"], "timestamp": r["timestamp"].isoformat() if r["timestamp"] else None}
                for r in rows
            ]
        except Exception as e:
            logger.debug(f"History get error: {e}")
            return []

    async def get_trending(
        self, timeframe: str = "day", limit: int = 20
    ) -> List[Dict[str, Any]]:
        """Get trending search queries."""
        if not self.available:
            return []
        intervals = {"hour": "1 hour", "day": "1 day", "week": "7 days"}
        interval = intervals.get(timeframe, "1 day")
        try:
            rows = await self._pool.fetch(
                f"""
                SELECT query, COUNT(*) as count
                FROM search_history
                WHERE timestamp > NOW() - INTERVAL '{interval}'
                  AND query IS NOT NULL AND LENGTH(TRIM(query)) >= 2
                GROUP BY query
                ORDER BY count DESC
                LIMIT $1
                """,
                limit,
            )
            return [{"query": r["query"], "count": r["count"]} for r in rows]
        except Exception as e:
            logger.debug(f"Trending error: {e}")
            return []
