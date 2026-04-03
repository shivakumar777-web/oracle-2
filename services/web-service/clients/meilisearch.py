"""
meilisearch.py — MeiliSearch Client
====================================
Search local medical index. Optional — graceful fallback if unavailable.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("manthana.web.meilisearch")


async def fetch_meilisearch(
    query: str,
    index: str,
    meilisearch_url: str,
    api_key: Optional[str] = None,
    limit: int = 20,
    offset: int = 0,
    timeout: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Search MeiliSearch index.
    Returns list of hits or empty list on error.
    """
    if not meilisearch_url or not query.strip():
        return []

    url = f"{meilisearch_url.rstrip('/')}/indexes/{index}/search"
    headers = {}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(
                url,
                json={"q": query, "limit": limit, "offset": offset},
                headers=headers or None,
            )
            if resp.status_code != 200:
                logger.debug(f"MeiliSearch error {resp.status_code}")
                return []

            data = resp.json()
            hits = data.get("hits", [])
            # Normalize to SearXNG-like format
            results = []
            for h in hits:
                results.append({
                    "title": h.get("title", h.get("name", "")),
                    "url": h.get("url", h.get("link", "")),
                    "content": h.get("content", h.get("snippet", h.get("description", ""))),
                    "snippet": h.get("snippet", h.get("content", h.get("description", ""))),
                    "source": h.get("source", "MeiliSearch"),
                    "publishedDate": h.get("publishedDate", h.get("date")),
                })
            return results
    except Exception as e:
        logger.debug(f"MeiliSearch fetch error: {e}")
        return []
