"""
wikidata.py — Wikidata entity search (supplemental discovery)
=============================================================
Uses wbsearchentities — useful for entity context links, not full-text papers.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("manthana.web.wikidata")

WIKIDATA_API = "https://www.wikidata.org/w/api.php"


async def search_wikidata_entities(
    query: str,
    limit: int = 4,
    timeout: float = 8.0,
) -> List[Dict[str, Any]]:
    """
    Search Wikidata entities; map to lightweight article-shaped rows for UI merge.
    """
    if not query or not query.strip():
        return []

    params = {
        "action": "wbsearchentities",
        "search": query.strip(),
        "language": "en",
        "format": "json",
        "limit": min(max(1, limit), 10),
    }
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(WIKIDATA_API, params=params)
            if resp.status_code != 200:
                return []
            data = resp.json()
    except Exception as e:
        logger.warning("Wikidata fetch error: %s", e)
        return []

    out: List[Dict[str, Any]] = []
    for item in data.get("search") or []:
        label = (item.get("label") or item.get("title") or "").strip()
        if not label:
            continue
        url_raw = item.get("url") or ""
        if url_raw.startswith("//"):
            url = "https:" + url_raw
        elif url_raw.startswith("http"):
            url = url_raw
        else:
            qid = item.get("id") or ""
            url = f"https://www.wikidata.org/wiki/{qid}" if qid else ""
        if not url:
            continue
        desc = ""
        disp = item.get("display") or {}
        if isinstance(disp, dict):
            d = disp.get("description") or {}
            if isinstance(d, dict):
                desc = (d.get("value") or "").strip()
        snippet = desc or f"Wikidata entity: {label}"
        domain = ""
        try:
            domain = urlparse(url).hostname or ""
        except Exception:
            pass

        out.append({
            "title": label,
            "url": url,
            "snippet": snippet[:500],
            "content": snippet,
            "source": "Wikidata",
            "engine": "Wikidata",
            "domain": domain,
            "type": "article",
            "isPeerReviewed": False,
            "trustScore": 42,
            "sourceBadge": "Wikidata",
        })

    return out
