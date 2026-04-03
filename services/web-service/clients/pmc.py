"""
pmc.py — PubMed Central Open Access PDF Client
==============================================
Fetch open-access PDFs from PubMed Central.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.pmc")

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"


async def fetch_pmc_pdfs(
    query: str,
    page: int = 1,
    limit: int = 10,
    api_key: str | None = None,
    timeout: float = 5.0,
) -> List[Dict[str, Any]]:
    """
    Search PubMed Central for open-access full-text articles.
    Returns results with PDF URLs: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{id}/pdf/
    """
    if not query or not query.strip():
        return []

    retstart = (page - 1) * limit

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            params = {
                "db": "pmc",
                "term": f"{query.strip()} AND free full text[filter]",
                "retstart": retstart,
                "retmax": limit,
                "retmode": "json",
            }
            if api_key:
                params["api_key"] = api_key

            resp = await client.get(ESEARCH_URL, params=params)
            if resp.status_code != 200:
                logger.debug(f"PMC ESearch error {resp.status_code}")
                return []

            data = resp.json()
            id_list = data.get("esearchresult", {}).get("idlist", [])
            # PMC IDs are like PMC1234567
            results = []
            for pmc_id in id_list:
                if not pmc_id.startswith("PMC"):
                    pmc_id = f"PMC{pmc_id}"
                url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/"
                pdf_url = f"https://www.ncbi.nlm.nih.gov/pmc/articles/{pmc_id}/pdf/"
                results.append({
                    "title": f"PMC Article {pmc_id}",
                    "url": pdf_url,
                    "snippet": f"Open access article from PubMed Central",
                    "content": "",
                    "source": "PubMed Central",
                    "type": "pdf",
                    "publishedDate": None,
                    "pdfUrl": pdf_url,
                })
            return results
    except Exception as e:
        logger.debug(f"PMC fetch error: {e}")
        return []
