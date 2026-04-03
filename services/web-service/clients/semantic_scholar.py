"""
semantic_scholar.py — Semantic Scholar Academic Graph API Client
==============================================================
Fetch research papers from Semantic Scholar.
Free API, 100 req/sec unauthenticated.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.semantic_scholar")

SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search"


async def search_semantic_scholar(
    query: str,
    page: int = 1,
    per_page: int = 10,
    timeout: float = 5.0,
    api_key: str | None = None,
) -> tuple[List[Dict[str, Any]], int]:
    """
    Search Semantic Scholar Academic Graph API.
    Returns (results, total_count) or ([], 0) on error.
    """
    if not query or not query.strip():
        return [], 0

    offset = (page - 1) * per_page

    try:
        headers = {}
        if api_key and api_key.strip():
            headers["x-api-key"] = api_key.strip()

        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                SEMANTIC_SCHOLAR_API,
                headers=headers if headers else None,
                params={
                    "query": query.strip(),
                    "offset": offset,
                    "limit": per_page,
                    "fields": "title,abstract,authors,year,url,citationCount,openAccessPdf,externalIds",
                },
            )
            if resp.status_code != 200:
                logger.debug(f"Semantic Scholar error {resp.status_code}")
                return [], 0

            data = resp.json()
            total = data.get("total", 0)
            papers = data.get("data", [])

            results = []
            for p in papers:
                title = p.get("title", "")
                abstract = (p.get("abstract") or "")[:300]
                url = p.get("url", "")
                if not url and p.get("externalIds", {}).get("PubMed"):
                    url = f"https://pubmed.ncbi.nlm.nih.gov/{p['externalIds']['PubMed']}/"
                if not url:
                    continue

                authors = p.get("authors", [])
                author_str = ", ".join(a.get("name", "") for a in authors[:3]) if authors else ""
                if authors and len(authors) > 3:
                    author_str += " et al."
                year = p.get("year", "")
                citations = p.get("citationCount", 0)
                pdf_info = p.get("openAccessPdf") or {}
                pdf_url = pdf_info.get("url", "") if isinstance(pdf_info, dict) else ""

                snippet = abstract or f"{author_str}. {year}." if author_str else title[:200]

                results.append({
                    "title": title,
                    "url": url,
                    "snippet": snippet[:300],
                    "content": abstract or snippet,
                    "source": "Semantic Scholar",
                    "type": "article",
                    "isPeerReviewed": True,
                    "publishedDate": str(year) if year else None,
                    "citationCount": citations,
                    "pdfUrl": pdf_url,
                    "authors": author_str,
                    "year": year,
                })
            return results, total
    except Exception as e:
        logger.debug(f"Semantic Scholar fetch error: {e}")
        return [], 0
