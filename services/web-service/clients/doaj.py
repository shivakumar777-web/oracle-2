"""
doaj.py — Directory of Open Access Journals (DOAJ) article search
=================================================================
https://doaj.org/api/docs — no API key required.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Tuple
from urllib.parse import quote

import httpx

logger = logging.getLogger("manthana.web.doaj")

DOAJ_BASE = "https://doaj.org/api/search/articles"


async def search_doaj_articles(
    query: str,
    page: int = 1,
    per_page: int = 15,
    timeout: float = 12.0,
) -> Tuple[List[Dict[str, Any]], int]:
    """
    Search DOAJ articles. Returns (results, total_hits).
    """
    if not query or not query.strip():
        return [], 0

    # Path segment is the Lucene query; paginate via query string.
    qpath = quote(query.strip(), safe="")
    url = f"{DOAJ_BASE}/{qpath}"
    params = {"page": max(1, page), "pageSize": min(max(1, per_page), 100)}

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(url, params=params)
            if resp.status_code != 200:
                logger.warning("DOAJ HTTP %s", resp.status_code)
                return [], 0
            data = resp.json()
    except Exception as e:
        logger.warning("DOAJ fetch error: %s", e)
        return [], 0

    total = int(data.get("total") or 0)
    raw = data.get("results") or []
    out: List[Dict[str, Any]] = []

    for row in raw:
        bib = row.get("bibjson") or {}
        title = (bib.get("title") or "").strip()
        if not title:
            continue
        url_out = ""
        for link in bib.get("link") or []:
            if isinstance(link, dict) and link.get("url"):
                url_out = str(link["url"])
                break
        if not url_out:
            continue
        abstract = (bib.get("abstract") or "")[:600]
        year = bib.get("year")
        published = str(year) if year else None
        out.append({
            "title": title,
            "url": url_out,
            "snippet": abstract or title[:300],
            "content": abstract,
            "source": "DOAJ",
            "engine": "DOAJ",
            "type": "article",
            "isPeerReviewed": True,
            "isOpenAccess": True,
            "publishedDate": published,
            "sourceBadge": "DOAJ",
        })

    return out, total
