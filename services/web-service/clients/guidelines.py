"""
guidelines.py — Medical Guidelines Client
==========================================
Search medical guidelines from MeiliSearch index (WHO, CDC, NIH, etc.).
Optional — graceful fallback if index unavailable.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.guidelines")


async def fetch_guidelines(
    query: str,
    index: str,
    meilisearch_url: str,
    api_key: str | None = None,
    limit: int = 10,
    timeout: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Search guidelines MeiliSearch index.
    Returns list of guideline results or empty list on error.
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
                json={"q": query, "limit": limit},
                headers=headers or None,
            )
            if resp.status_code != 200:
                logger.debug(f"Guidelines index error {resp.status_code}")
                return []

            data = resp.json()
            hits = data.get("hits", [])
            results = []
            for h in hits:
                results.append({
                    "title": h.get("title", h.get("name", "")),
                    "url": h.get("url", h.get("link", "")),
                    "content": h.get("content", h.get("snippet", "")),
                    "snippet": h.get("snippet", h.get("content", ""))[:300],
                    "source": h.get("organization", h.get("source", "Guidelines")),
                    "type": "guideline",
                    "publishedDate": h.get("publishedDate", h.get("date")),
                })
            return results
    except Exception as e:
        logger.debug(f"Guidelines fetch error: {e}")
        return []
