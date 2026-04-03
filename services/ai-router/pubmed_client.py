"""
pubmed_client.py — PubMed E-utilities Client for Oracle Chat
============================================================
Async client for NCBI PubMed E-utilities (esearch + esummary).
No API key required. Used by Phase 1+ hybrid RAG for peer-reviewed context.

Rate limits: 3 requests/second without API key. Include tool + email.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("manthana.pubmed")

_BASE_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
_TIMEOUT = 6.0
_TOOL = "manthana-medical-ai"
_EMAIL = "support@manthana.ai"


async def search_pubmed(
    query: str,
    max_results: int = 5,
    sort: str = "relevance",
) -> List[Dict[str, Any]]:
    """Search PubMed and return article summaries (title, authors, pubdate).

    Uses esearch + esummary. Returns list of dicts with:
      - title: str
      - authors: str (formatted)
      - pubdate: str
      - pmid: str
      - url: str (link to abstract)
    """
    if not query or not query.strip():
        return []

    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            # 1. ESearch — get PMIDs
            esearch_params = {
                "db": "pubmed",
                "term": query.strip(),
                "retmax": max_results,
                "retmode": "json",
                "sort": sort,
                "tool": _TOOL,
                "email": _EMAIL,
            }
            esearch_resp = await client.get(
                f"{_BASE_URL}/esearch.fcgi",
                params=esearch_params,
            )
            esearch_resp.raise_for_status()
            esearch_data = esearch_resp.json()
            id_list = esearch_data.get("esearchresult", {}).get("idlist", [])

            if not id_list:
                return []

            # 2. ESummary — get titles, authors, pubdate
            ids = ",".join(id_list)
            esummary_params = {
                "db": "pubmed",
                "id": ids,
                "retmode": "json",
                "tool": _TOOL,
                "email": _EMAIL,
            }
            esummary_resp = await client.get(
                f"{_BASE_URL}/esummary.fcgi",
                params=esummary_params,
            )
            esummary_resp.raise_for_status()
            esummary_data = esummary_resp.json()
            result = esummary_data.get("result", {})

            articles: List[Dict[str, Any]] = []
            for pmid in id_list:
                if pmid == "ERROR":
                    continue
                entry = result.get(pmid, {})
                if isinstance(entry, dict) and entry.get("title"):
                    authors = _format_authors(entry.get("authors", []))
                    pubdate = entry.get("pubdate", "")
                    articles.append({
                        "title": entry.get("title", ""),
                        "authors": authors,
                        "pubdate": pubdate,
                        "pmid": pmid,
                        "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/",
                    })
            return articles

    except httpx.TimeoutException as exc:
        logger.warning("PubMed search timeout: %s", exc)
        return []
    except Exception as exc:
        logger.warning("PubMed search failed: %s", exc)
        return []


def _format_authors(authors: Any) -> str:
    """Format authors list from esummary into a short string."""
    if not authors:
        return ""
    if isinstance(authors, list):
        names = [a.get("name", "") if isinstance(a, dict) else str(a) for a in authors[:5]]
        return "; ".join(n for n in names if n)
    if isinstance(authors, str):
        return authors
    return ""
