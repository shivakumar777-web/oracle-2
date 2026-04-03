"""
europe_pmc.py — Europe PMC REST API Client
==========================================
Fetch full-text PDFs from Europe PMC.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.europe_pmc")

EPMC_SEARCH = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"


async def search_europe_pmc_articles(
    query: str,
    page: int = 1,
    limit: int = 15,
    timeout: float = 8.0,
) -> tuple[List[Dict[str, Any]], int]:
    """
    General Europe PMC article search (no HAS_PDF filter).
    Same corpus as PubMed; free, no API key; generous rate limits.
    Returns (results, approximate_total).
    """
    if not query or not query.strip():
        return [], 0

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                EPMC_SEARCH,
                params={
                    "query": query.strip(),
                    "format": "json",
                    "pageSize": limit,
                    "page": page,
                    "resultType": "lite",
                },
            )
            if resp.status_code != 200:
                logger.warning("Europe PMC articles HTTP %s", resp.status_code)
                return [], 0

            data = resp.json()
            hits = data.get("resultList", {}).get("result", [])
            if not isinstance(hits, list):
                hits = []
            total = int(data.get("hitCount", len(hits)) or len(hits))

            results: List[Dict[str, Any]] = []
            for h in hits:
                pmid = h.get("pmid", "")
                pmcid = h.get("pmcid", "")
                src = h.get("source", "MED")
                ext_id = h.get("id", pmid or pmcid or "")
                if pmcid:
                    url = f"https://europepmc.org/article/PMC/{pmcid.replace('PMC', '')}"
                elif pmid:
                    url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
                else:
                    url = h.get("url", "") or f"https://europepmc.org/article/{src}/{ext_id}"

                title = h.get("title", "") or ""
                abstract = (h.get("abstractText") or "")[:400]
                results.append({
                    "title": title,
                    "url": url,
                    "snippet": abstract[:300],
                    "content": abstract,
                    "source": "Europe PMC",
                    "engine": "Europe PMC",
                    "type": "article",
                    "isPeerReviewed": True,
                    "publishedDate": h.get("firstPublicationDate") or str(h.get("pubYear", "")),
                    "doi": h.get("doi"),
                })
            return results, total
    except Exception as e:
        logger.warning("Europe PMC articles fetch error: %s", e)
        return [], 0


async def fetch_europe_pmc(
    query: str,
    page: int = 1,
    limit: int = 10,
    timeout: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Search Europe PMC for articles with available PDFs.
    Filter: HAS_PDF:Y
    """
    if not query or not query.strip():
        return []

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(
                EPMC_SEARCH,
                params={
                    "query": f"{query.strip()} HAS_PDF:Y",
                    "format": "json",
                    "pageSize": limit,
                    "page": page,
                },
            )
            if resp.status_code != 200:
                logger.debug(f"Europe PMC error {resp.status_code}")
                return []

            data = resp.json()
            hits = data.get("resultList", {}).get("result", [])
            if not isinstance(hits, list):
                hits = []

            results = []
            for h in hits:
                title = h.get("title", "")
                pmcid = h.get("pmcid", "")
                doi = h.get("doi", "")
                pdf_url = h.get("pdfUrl", "")
                if not pdf_url:
                    ft_list = h.get("fullTextUrlList", {}) or {}
                    ft_urls = ft_list.get("fullTextUrl", []) if isinstance(ft_list, dict) else []
                    if isinstance(ft_urls, list):
                        for u in ft_urls:
                            if isinstance(u, dict) and u.get("documentStyle") == "pdf":
                                pdf_url = u.get("url", "")
                                break
                            elif isinstance(u, dict) and u.get("url"):
                                pdf_url = u.get("url", "")
                    elif isinstance(ft_urls, str):
                        pdf_url = ft_urls
                if not pdf_url and pmcid:
                    pdf_url = f"https://europepmc.org/backend/ptpmcrender.fcgi?accid={pmcid}&blobtype=pdf"
                if not pdf_url:
                    pdf_url = h.get("url", "") or f"https://europepmc.org/article/MED/{h.get('pmid', '')}"

                results.append({
                    "title": title,
                    "url": pdf_url,
                    "snippet": (h.get("abstractText") or "")[:300],
                    "content": h.get("abstractText", ""),
                    "source": "Europe PMC",
                    "type": "pdf",
                    "publishedDate": h.get("pubYear"),
                    "pdfUrl": pdf_url,
                })
            return results
    except Exception as e:
        logger.debug(f"Europe PMC fetch error: {e}")
        return []
