"""
cache.py — Web Service Caching Layer
=====================================
Two-tier cache: Redis (fast) + PostgreSQL (persistent).
Per-tab cache keys for search endpoints.
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, Optional

logger = logging.getLogger("manthana.web.cache")

# Per-tab TTLs (seconds) — premium plan: slower-changing tabs get longer TTLs
TAB_TTL = {
    "all": 600,
    "papers": 1800,
    "guidelines": 3600,
    "trials": 600,
    "images": 300,
    "videos": 300,
    "pdfs": 3600,
    "articles": 300,
}


def _query_hash(query: str, category: str, page: int) -> str:
    """Generate cache key hash."""
    key = f"{query}:{category}:{page}"
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def _tab_cache_key(tab: str, query: str, **params) -> str:
    """Generate per-tab cache key hash."""
    parts = [tab, query.strip().lower()]
    for k, v in sorted(params.items()):
        if v is not None:
            parts.append(f"{k}={v}")
    key = ":".join(str(p) for p in parts)
    return hashlib.sha256(key.encode()).hexdigest()[:32]


def tab_cache_key(tab: str, query: str, page: int = 1, **extra) -> str:
    """Full Redis key for per-tab cache."""
    h = _tab_cache_key(tab, query, page=page, **extra)
    return f"web:search:{tab}:{h}"


async def get_tab_cached(
    tab: str,
    query: str,
    redis_client: Optional[Any],
    page: int = 1,
    **extra,
) -> Optional[Dict[str, Any]]:
    """
    Get cached results for a specific tab.
    Uses Redis only (fast, per-tab).
    """
    if not redis_client:
        return None
    key = tab_cache_key(tab, query, page=page, **extra)
    try:
        raw = await redis_client.get(key)
        if raw:
            return json.loads(raw)
    except Exception as e:
        logger.debug(f"Redis tab cache get error: {e}")
    return None


async def set_tab_cached(
    tab: str,
    query: str,
    data: Dict[str, Any],
    redis_client: Optional[Any],
    page: int = 1,
    **extra,
) -> None:
    """Cache results for a specific tab."""
    if not redis_client:
        return
    ttl = TAB_TTL.get(tab, 300)
    key = tab_cache_key(tab, query, page=page, **extra)
    try:
        await redis_client.setex(key, ttl, json.dumps(data))
    except Exception as e:
        logger.debug(f"Redis tab cache set error: {e}")


async def get_cached(
    query: str,
    category: str,
    page: int,
    redis_client: Optional[Any],
    db: Optional[Any],
) -> Optional[Dict[str, Any]]:
    """
    Get cached search results.
    Tries Redis first, then PostgreSQL.
    """
    qhash = _query_hash(query, category, page)

    # Try Redis first
    if redis_client:
        try:
            key = f"web:cache:{qhash}"
            raw = await redis_client.get(key)
            if raw:
                return json.loads(raw)
        except Exception as e:
            logger.debug(f"Redis cache get error: {e}")

    # Try PostgreSQL
    if db and db.available:
        result = await db.get_cached_search(qhash)
        if result and redis_client:
            # Backfill Redis
            try:
                key = f"web:cache:{qhash}"
                await redis_client.setex(
                    key, 300, json.dumps(result)
                )
            except Exception:
                pass
        return result

    return None


async def set_cached(
    query: str,
    category: str,
    page: int,
    data: Dict[str, Any],
    redis_client: Optional[Any],
    db: Optional[Any],
    ttl_seconds: int = 600,
) -> None:
    """
    Cache search results in Redis and PostgreSQL.
    """
    qhash = _query_hash(query, category, page)

    # Redis
    if redis_client:
        try:
            key = f"web:cache:{qhash}"
            await redis_client.setex(
                key, min(ttl_seconds, 300), json.dumps(data)
            )
        except Exception as e:
            logger.debug(f"Redis cache set error: {e}")

    # PostgreSQL
    if db and db.available:
        await db.set_cached_search(
            qhash, query, category, page, data, ttl_seconds
        )
