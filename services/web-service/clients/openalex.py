"""
openalex.py — OpenAlex Works API (no API key required for basic use)
====================================================================
https://docs.openalex.org — polite pool: add mailto in User-Agent if configured.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("manthana.web.openalex")

OPENALEX_WORKS = "https://api.openalex.org/works"


async def search_openalex_works(
    query: str,
    page: int = 1,
    per_page: int = 15,
    timeout: float = 10.0,
    mailto: Optional[str] = None,
) -> tuple[List[Dict[str, Any]], int]:
    """
    Search OpenAlex works. Returns (results, total_count_estimate).
    """
    if not query or not query.strip():
        return [], 0

    ua = "ManthanaWeb/2.0"
    if mailto:
        ua = f"ManthanaWeb/2.0 (mailto:{mailto})"

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                OPENALEX_WORKS,
                headers={"User-Agent": ua},
                params={
                    "search": query.strip(),
                    "per-page": min(per_page, 50),
                    "page": page,
                },
            )
            if resp.status_code != 200:
                logger.warning("OpenAlex HTTP %s", resp.status_code)
                return [], 0

            data = resp.json()
            meta = data.get("meta", {}) or {}
            total = int(meta.get("count", 0) or 0)
            results_raw = data.get("results", []) or []

            out: List[Dict[str, Any]] = []
            for w in results_raw:
                title = (w.get("display_name") or "").strip()
                if not title:
                    continue
                primary = w.get("primary_location") or {}
                url = (primary.get("landing_page_url") or "") if isinstance(primary, dict) else ""
                doi = w.get("doi")
                if not url and doi:
                    d = str(doi).replace("https://doi.org/", "")
                    url = f"https://doi.org/{d}"
                if not url:
                    oid = (w.get("id") or "").split("/")[-1]
                    if oid:
                        url = f"https://openalex.org/{oid}"
                if not url:
                    continue
                year = None
                py = w.get("publication_year")
                if py:
                    year = str(py)
                abstract = ""
                inv = w.get("abstract_inverted_index") or {}
                if isinstance(inv, dict) and inv:
                    # Reconstruct a short snippet from inverted index (optional)
                    abstract = title[:200]

                out.append({
                    "title": title,
                    "url": url,
                    "snippet": abstract or title[:300],
                    "content": abstract,
                    "source": "OpenAlex",
                    "engine": "OpenAlex",
                    "type": "article",
                    "isPeerReviewed": True,
                    "publishedDate": year,
                    "citationCount": w.get("cited_by_count"),
                })
            return out, total
    except Exception as e:
        logger.warning("OpenAlex fetch error: %s", e)
        return [], 0
