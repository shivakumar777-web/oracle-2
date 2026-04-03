"""
crossref.py — Crossref REST API (free, no key; polite User-Agent with mailto recommended)
=========================================================================================
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("manthana.web.crossref")

CROSSREF_WORKS = "https://api.crossref.org/works"


async def search_crossref_works(
    query: str,
    page: int = 1,
    rows: int = 15,
    timeout: float = 8.0,
    mailto: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], int]:
    """
    Search Crossref for works. Returns (results, total_results).
    """
    if not query or not query.strip():
        return [], 0

    offset = (page - 1) * rows
    ua = "ManthanaWeb/2.0 (https://github.com/manthana; mailto:dev@example.com)"
    if mailto:
        ua = f"ManthanaWeb/2.0 (mailto:{mailto})"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                CROSSREF_WORKS,
                headers={"User-Agent": ua},
                params={
                    "query": query.strip(),
                    "rows": min(rows, 20),
                    "offset": offset,
                },
            )
            if resp.status_code != 200:
                logger.warning("Crossref HTTP %s", resp.status_code)
                return [], 0

            data = resp.json()
            msg = data.get("message", {}) or {}
            items = msg.get("items", []) or []
            total = int(msg.get("total-results", len(items)) or 0)

            out: List[Dict[str, Any]] = []
            for it in items:
                title_list = it.get("title") or []
                title = title_list[0] if title_list else ""
                if not title:
                    continue
                url = ""
                for l in it.get("link", []) or []:
                    if isinstance(l, dict) and l.get("URL"):
                        url = l["URL"]
                        break
                if not url:
                    dois = it.get("DOI")
                    if dois:
                        url = f"https://doi.org/{dois}"
                if not url:
                    continue
                year = None
                issued = it.get("issued", {}).get("date-parts", [[]])
                if issued and issued[0]:
                    year = str(issued[0][0]) if issued[0] else None

                out.append({
                    "title": title,
                    "url": url,
                    "snippet": (it.get("abstract", "") or title)[:300],
                    "content": (it.get("abstract", "") or "")[:500],
                    "source": "Crossref",
                    "engine": "Crossref",
                    "type": "article",
                    "isPeerReviewed": True,
                    "publishedDate": year,
                    "doi": it.get("DOI"),
                })
            return out, total
    except Exception as e:
        logger.warning("Crossref fetch error: %s", e)
        return [], 0
