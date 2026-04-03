"""
pdfs.py — PDF Search Router
============================
Dedicated endpoint for PDF documents (papers, guidelines, drug labels).
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from config import WebSettings, get_web_settings

import sys
PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.envelopes import create_web_response
from services.shared.circuit_breaker import (
    web_pmc_circuit,
    web_europe_pmc_circuit,
    CircuitBreakerError,
)

from clients.pmc import fetch_pmc_pdfs
from clients.europe_pmc import fetch_europe_pmc
from routers.search import fetch_searxng, enrich_result, deduplicate_results, sort_by_trust
from cache import get_tab_cached, set_tab_cached

import logging
logger = logging.getLogger("manthana.web.pdfs")

PER_PAGE = 20


def _merge_pdfs(
    pmc_results: List[Dict[str, Any]],
    epmc_results: List[Dict[str, Any]],
    searxng_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge and deduplicate by URL. Force type=pdf."""
    seen = set()
    merged = []
    for r in pmc_results + epmc_results + searxng_results:
        url = r.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        r = dict(r)
        r["type"] = "pdf"
        merged.append(r)
    return merged


def create_pdfs_router(limiter) -> APIRouter:
    """Create the PDFs search router."""
    router = APIRouter(tags=["search"])

    @router.get("/search/pdfs")
    @limiter.limit("200/minute")
    async def search_pdfs(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Search for PDF documents (research papers, guidelines, drug labels)."""
        rid = getattr(request.state, "request_id", "unknown")
        start_time = time.time()
        redis_client = getattr(request.app.state, "redis", None)

        if not q or not q.strip():
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "results": [], "total": 0, "page": page, "totalPages": 0, "hasNextPage": False, "hasPrevPage": False, "elapsed": 0},
                    rid,
                ),
            )

        # Check cache
        cached = await get_tab_cached("pdfs", q, redis_client, page=page)
        if cached:
            cached["elapsed"] = int((time.time() - start_time) * 1000)
            return JSONResponse(
                status_code=200,
                content=create_web_response(cached, rid),
            )

        # Source 1: SearXNG with filetype:pdf
        pdf_query = f"{q} filetype:pdf"
        searxng_task = fetch_searxng(
            pdf_query, "general", "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )

        async def _pmc():
            try:
                return await web_pmc_circuit.call(
                    fetch_pmc_pdfs, q, page=page, limit=10,
                    api_key=getattr(settings, "NCBI_API_KEY", None),
                )
            except CircuitBreakerError:
                return []

        async def _epmc():
            try:
                return await web_europe_pmc_circuit.call(
                    fetch_europe_pmc, q, page=page, limit=10,
                )
            except CircuitBreakerError:
                return []

        try:
            searxng_data, pmc_results, epmc_results = await asyncio.gather(
                searxng_task, _pmc(), _epmc(),
            )
        except Exception as exc:
            logger.warning(f"PDFs search error: {exc}")
            searxng_data, pmc_results, epmc_results = {"results": []}, [], []

        searxng_raw = searxng_data.get("results", [])[:25] if isinstance(searxng_data, dict) else []
        searxng_enriched = [enrich_result(r) for r in searxng_raw]
        searxng_pdfs = [
            r for r in searxng_enriched
            if r.get("type") == "pdf" or ".pdf" in (r.get("url") or "").lower()
        ]
        for r in searxng_pdfs:
            r["type"] = "pdf"

        merged = _merge_pdfs(pmc_results, epmc_results, searxng_pdfs)

        # Fallback: extra SearXNG pass if still thin (Premium never-empty)
        if len(merged) < 6:
            try:
                extra = await fetch_searxng(
                    f"{q} pdf", "medical", "json", page,
                    settings.WEB_SEARXNG_URL,
                    settings.WEB_SEARXNG_TIMEOUT,
                )
                raw2 = extra.get("results", [])[:20] if isinstance(extra, dict) else []
                ex_pdfs: List[Dict[str, Any]] = []
                for raw in raw2:
                    r = enrich_result(raw)
                    if r.get("type") == "pdf" or ".pdf" in (r.get("url") or "").lower():
                        r["type"] = "pdf"
                        ex_pdfs.append(r)
                merged = _merge_pdfs(merged, [], ex_pdfs)
            except Exception as exc:
                logger.warning("PDFs fallback search failed: %s", exc)
        enriched = [enrich_result(r) for r in merged]
        enriched = deduplicate_results(enriched)
        enriched = sort_by_trust(enriched)

        total = len(enriched)
        start = (page - 1) * PER_PAGE
        page_results = enriched[start : start + PER_PAGE]

        for r in page_results:
            r.setdefault("type", "pdf")

        elapsed = int((time.time() - start_time) * 1000)
        total_pages = max(1, (total + PER_PAGE - 1) // PER_PAGE)

        payload = {
            "query": q,
            "category": "medical",
            "results": page_results,
            "total": total,
            "page": page,
            "totalPages": total_pages,
            "hasNextPage": page < total_pages,
            "hasPrevPage": page > 1,
            "elapsed": elapsed,
            "images": [],
            "videos": [],
            "relatedQuestions": [],
            "enginesUsed": ["SearXNG", "PubMed Central", "Europe PMC"],
        }

        await set_tab_cached("pdfs", q, payload, redis_client, page=page)

        return JSONResponse(
            status_code=200,
            content=create_web_response(payload, rid),
        )

    return router
