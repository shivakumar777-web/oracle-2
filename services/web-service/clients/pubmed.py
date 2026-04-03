"""
pubmed.py — PubMed E-Utilities API Client
=========================================
Fetch peer-reviewed research papers from PubMed.
Free, no API key required. Rate limit: 3 req/sec (10/sec with NCBI API key).
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.pubmed")

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"


async def search_pubmed(
    query: str,
    page: int = 1,
    per_page: int = 10,
    api_key: str | None = None,
    timeout: float = 5.0,
) -> tuple[List[Dict[str, Any]], int]:
    """
    Search PubMed via E-Utilities.
    Returns (results, total_count) or ([], 0) on error.
    """
    if not query or not query.strip():
        return [], 0

    retstart = (page - 1) * per_page

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            # Step 1: ESearch — get PMIDs
            params = {
                "db": "pubmed",
                "term": query.strip(),
                "retstart": retstart,
                "retmax": per_page,
                "retmode": "json",
                "sort": "relevance",
            }
            if api_key:
                params["api_key"] = api_key

            resp = await client.get(ESEARCH_URL, params=params)
            if resp.status_code != 200:
                logger.debug(f"PubMed ESearch error {resp.status_code}")
                return [], 0

            data = resp.json()
            id_list = data.get("esearchresult", {}).get("idlist", [])
            total = int(data.get("esearchresult", {}).get("count", 0))

            if not id_list:
                return [], total

            # Step 2: ESummary — get details for each PMID
            summary_params = {
                "db": "pubmed",
                "id": ",".join(id_list),
                "retmode": "json",
            }
            if api_key:
                summary_params["api_key"] = api_key

            summary_resp = await client.get(ESUMMARY_URL, params=summary_params)
            if summary_resp.status_code != 200:
                logger.debug(f"PubMed ESummary error {summary_resp.status_code}")
                return [], total

            summary_data = summary_resp.json()
            result_uids = summary_data.get("result", {})

            results = []
            for pmid in id_list:
                if pmid not in result_uids or pmid == "invalid":
                    continue
                item = result_uids[pmid]
                if isinstance(item, dict) and item.get("error"):
                    continue

                title = item.get("title", "")
                authors = item.get("authors", [])
                author_str = ", ".join(a.get("name", "") for a in authors[:3]) if authors else ""
                if authors and len(authors) > 3:
                    author_str += " et al."
                journal = item.get("fulljournalname", item.get("source", ""))
                pubdate = item.get("pubdate", "")
                doi = ""
                for aid in item.get("articleids", []) or []:
                    if aid.get("idtype") == "doi":
                        doi = aid.get("value", "")
                        break

                url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                snippet = f"{author_str}. {journal}. {pubdate}." if author_str or journal else title[:200]

                results.append({
                    "title": title,
                    "url": url,
                    "snippet": snippet[:300],
                    "content": snippet,
                    "source": "PubMed",
                    "type": "article",
                    "isPeerReviewed": True,
                    "publishedDate": pubdate,
                    "doi": doi,
                    "pmid": pmid,
                    "journal": journal,
                    "authors": author_str,
                })
            return results, total
    except Exception as e:
        logger.debug(f"PubMed fetch error: {e}")
        return [], 0
