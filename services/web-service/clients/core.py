"""
core.py — CORE REST API v3 (works search)
==========================================
https://api.core.ac.uk/docs/v3 — optional API key for higher limits.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

logger = logging.getLogger("manthana.web.core")

CORE_SEARCH = "https://api.core.ac.uk/v3/search/works"


async def search_core_works(
    query: str,
    page: int = 1,
    per_page: int = 12,
    timeout: float = 12.0,
    api_key: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Search CORE aggregated works. Returns (results, total_hits).
    """
    if not query or not query.strip():
        return [], 0

    limit = min(max(1, per_page), 100)
    offset = max(0, (page - 1) * limit)
    body = {"q": query.strip(), "limit": limit, "offset": offset}
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(CORE_SEARCH, json=body, headers=headers)
            if resp.status_code != 200:
                logger.warning("CORE HTTP %s", resp.status_code)
                return [], 0
            data = resp.json()
    except Exception as e:
        logger.warning("CORE fetch error: %s", e)
        return [], 0

    total = int(data.get("totalHits") or data.get("total") or 0)
    raw = data.get("results") or []
    out: List[Dict[str, Any]] = []

    for w in raw:
        title = (w.get("title") or "").strip()
        if not title:
            continue
        doi = w.get("doi")
        url = ""
        if doi:
            d = str(doi).replace("https://doi.org/", "").strip()
            url = f"https://doi.org/{d}"
        if not url:
            url = (w.get("downloadUrl") or "").strip()
        if not url:
            sf = w.get("sourceFulltextUrls") or []
            if isinstance(sf, list) and sf:
                url = str(sf[0])
        wid = w.get("id")
        if not url and wid is not None:
            url = f"https://core.ac.uk/works/{wid}"
        if not url:
            continue
        abstract = (w.get("abstract") or "")[:600]
        pub = w.get("publishedDate") or w.get("depositedDate")
        published = None
        if isinstance(pub, str) and len(pub) >= 4:
            published = pub[:4]

        out.append({
            "title": title,
            "url": url,
            "snippet": abstract or title[:300],
            "content": abstract,
            "source": "CORE",
            "engine": "CORE",
            "type": "article",
            "isPeerReviewed": True,
            "isOpenAccess": True,
            "publishedDate": published,
            "citationCount": w.get("citationCount"),
            "sourceBadge": "CORE",
        })

    return out, total
