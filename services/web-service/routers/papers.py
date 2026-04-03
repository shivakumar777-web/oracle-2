"""
papers.py — Research Papers Search Router (Premium: multi-source + never-empty)
================================================================================
Sources: PubMed, Semantic Scholar, Europe PMC, OpenAlex, Crossref, DOAJ, CORE, SearXNG science+medical,
         Wikidata supplement, fallback SearXNG general (academic hints).
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Tuple

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from config import WebSettings, get_web_settings

import sys

PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.envelopes import create_web_response
from services.shared.circuit_breaker import (
    web_pubmed_circuit,
    web_semantic_scholar_circuit,
    web_europe_pmc_circuit,
    web_openalex_circuit,
    web_crossref_circuit,
    web_doaj_circuit,
    web_core_circuit,
    web_wikidata_circuit,
    CircuitBreakerError,
)

from cache import get_tab_cached, set_tab_cached
from clients.pubmed import search_pubmed
from clients.semantic_scholar import search_semantic_scholar
from clients.europe_pmc import search_europe_pmc_articles
from clients.openalex import search_openalex_works
from clients.crossref import search_crossref_works
from clients.doaj import search_doaj_articles
from clients.core import search_core_works
from clients.wikidata import search_wikidata_entities
from routers.search import fetch_searxng, enrich_result, deduplicate_results, sort_by_trust
from routers.paper_sources import is_paper_candidate, tag_fallback_papers

import logging

logger = logging.getLogger("manthana.web.papers")

PER_PAGE = 20


def _merge_and_dedupe(*lists: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen_urls = set()
    merged: List[Dict[str, Any]] = []
    for lst in lists:
        for r in lst:
            url = r.get("url", "")
            if not url or url in seen_urls:
                continue
            seen_urls.add(url)
            merged.append(r)
    return merged


def create_papers_router(limiter) -> APIRouter:
    """Create the papers search router."""
    router = APIRouter(tags=["search"])

    @router.get("/search/papers")
    @limiter.limit("200/minute")
    async def search_papers(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        sort: str = Query(default="relevance", description="relevance|date|citations"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Search peer-reviewed and academic papers from many free sources."""
        rid = getattr(request.state, "request_id", "unknown")
        start_time = time.time()
        redis_client = getattr(request.app.state, "redis", None)

        if not q or not q.strip():
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {
                        "query": q,
                        "results": [],
                        "total": 0,
                        "page": page,
                        "totalPages": 0,
                        "hasNextPage": False,
                        "hasPrevPage": False,
                        "elapsed": 0,
                    },
                    rid,
                ),
            )

        cached = await get_tab_cached("papers", q, redis_client, page=page, sort=sort)
        if cached:
            cached["elapsed"] = int((time.time() - start_time) * 1000)
            return JSONResponse(
                status_code=200,
                content=create_web_response(cached, rid),
            )

        ncbi_key = getattr(settings, "NCBI_API_KEY", None)
        ss_key = getattr(settings, "SEMANTIC_SCHOLAR_API_KEY", None)
        core_key = getattr(settings, "CORE_API_KEY", None)
        mailto = getattr(settings, "OPENALEX_MAILTO", None) or getattr(settings, "CROSSREF_MAILTO", None)

        async def _pubmed() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_pubmed_circuit.call(
                    search_pubmed, q, page=page, per_page=10, api_key=ncbi_key
                )
            except CircuitBreakerError:
                return [], 0

        async def _ss() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_semantic_scholar_circuit.call(
                    search_semantic_scholar, q, page=page, per_page=10, api_key=ss_key
                )
            except CircuitBreakerError:
                return [], 0

        async def _epmc() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_europe_pmc_circuit.call(
                    search_europe_pmc_articles, q, page=page, limit=15
                )
            except CircuitBreakerError:
                return [], 0

        async def _oalex() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_openalex_circuit.call(
                    search_openalex_works, q, page=page, per_page=12, mailto=mailto
                )
            except CircuitBreakerError:
                return [], 0

        async def _xref() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_crossref_circuit.call(
                    search_crossref_works, q, page=page, rows=12, mailto=mailto
                )
            except CircuitBreakerError:
                return [], 0

        async def _doaj() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_doaj_circuit.call(
                    search_doaj_articles, q, page=page, per_page=15
                )
            except CircuitBreakerError:
                return [], 0

        async def _core() -> Tuple[List[Dict[str, Any]], int]:
            try:
                return await web_core_circuit.call(
                    search_core_works, q, page=page, per_page=12, api_key=core_key
                )
            except CircuitBreakerError:
                return [], 0

        searxng_science = fetch_searxng(
            q, "science", "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )
        searxng_medical = fetch_searxng(
            q, "medical", "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )

        try:
            results_tuple = await asyncio.gather(
                _pubmed(),
                _ss(),
                _epmc(),
                _oalex(),
                _xref(),
                _doaj(),
                _core(),
                searxng_science,
                searxng_medical,
                return_exceptions=True,
            )
        except Exception as exc:
            logger.warning("Papers search gather error: %s", exc)
            results_tuple = (
                ([], 0), ([], 0), ([], 0), ([], 0), ([], 0),
                ([], 0), ([], 0),
                {"results": []}, {"results": []},
            )

        def _safe_tuple(i: int) -> Tuple[List[Dict[str, Any]], int]:
            r = results_tuple[i]
            if isinstance(r, Exception):
                return [], 0
            if isinstance(r, tuple) and len(r) == 2:
                return r[0], int(r[1] or 0)
            return [], 0

        pubmed_results, pubmed_total = _safe_tuple(0)
        ss_results, ss_total = _safe_tuple(1)
        epmc_results, epmc_total = _safe_tuple(2)
        oalex_results, oalex_total = _safe_tuple(3)
        xref_results, xref_total = _safe_tuple(4)
        doaj_results, doaj_total = _safe_tuple(5)
        core_results, core_total = _safe_tuple(6)

        s_data = results_tuple[7] if not isinstance(results_tuple[7], Exception) else {"results": []}
        m_data = results_tuple[8] if not isinstance(results_tuple[8], Exception) else {"results": []}

        searxng_raw: List[Dict[str, Any]] = []
        if isinstance(s_data, dict):
            searxng_raw.extend(s_data.get("results", [])[:20])
        if isinstance(m_data, dict):
            searxng_raw.extend(m_data.get("results", [])[:20])

        searxng_enriched = [enrich_result(r) for r in searxng_raw]
        searxng_papers = [r for r in searxng_enriched if is_paper_candidate(r)]

        for r in pubmed_results:
            r["engine"] = r.get("engine") or "PubMed"
        for r in ss_results:
            r["engine"] = r.get("engine") or "Semantic Scholar"
        for r in epmc_results:
            r["engine"] = "Europe PMC"
            r.setdefault("isPeerReviewed", True)
            r.setdefault("type", "article")
        for r in oalex_results:
            r.setdefault("isPeerReviewed", True)
            r.setdefault("type", "article")
        for r in xref_results:
            r.setdefault("isPeerReviewed", True)
            r.setdefault("type", "article")
        for r in doaj_results:
            r.setdefault("isPeerReviewed", True)
            r.setdefault("type", "article")
        for r in core_results:
            r.setdefault("isPeerReviewed", True)
            r.setdefault("type", "article")

        merged = _merge_and_dedupe(
            pubmed_results,
            ss_results,
            epmc_results,
            oalex_results,
            xref_results,
            doaj_results,
            core_results,
            searxng_papers,
        )

        # Supplement with Wikidata entities when the merged set is still thin
        if len(merged) < 8:
            try:
                wd = await web_wikidata_circuit.call(search_wikidata_entities, q, limit=4)
                merged = _merge_and_dedupe(merged, wd)
            except CircuitBreakerError:
                pass
            except Exception as exc:
                logger.warning("Papers Wikidata supplement failed: %s", exc)

        used_general_fallback = False
        # Never-empty: if still thin, pull general SearXNG and keep academic-looking rows
        if len(merged) < 8:
            try:
                gen = await fetch_searxng(
                    q, "general", "json", page,
                    settings.WEB_SEARXNG_URL,
                    settings.WEB_SEARXNG_TIMEOUT,
                )
                gen_raw = gen.get("results", [])[:25] if isinstance(gen, dict) else []
                gen_enriched = [enrich_result(r) for r in gen_raw]
                academic_pick = [r for r in gen_enriched if is_paper_candidate(r)]
                if len(academic_pick) < 10:
                    rest = [r for r in gen_enriched if r not in academic_pick][:15]
                    tag_fallback_papers(rest)
                    academic_pick.extend(rest)
                merged = _merge_and_dedupe(merged, academic_pick)
                used_general_fallback = True
            except Exception as exc:
                logger.warning("Papers fallback SearXNG general failed: %s", exc)

        enriched = [enrich_result(r) for r in merged]
        enriched = deduplicate_results(enriched)
        enriched = sort_by_trust(enriched)

        est_total = max(
            pubmed_total,
            ss_total,
            epmc_total or 0,
            oalex_total or 0,
            xref_total or 0,
            doaj_total or 0,
            core_total or 0,
            len(enriched),
        )
        start = (page - 1) * PER_PAGE
        page_results = enriched[start: start + PER_PAGE]

        for r in page_results:
            r.setdefault("trustScore", r.get("trustScore") or 72)
            r.setdefault("isPeerReviewed", r.get("isPeerReviewed", True))
            r.setdefault("type", "article")

        elapsed = int((time.time() - start_time) * 1000)
        total_pages = max(1, (est_total + PER_PAGE - 1) // PER_PAGE)

        engines_used = [
            "PubMed",
            "Semantic Scholar",
            "Europe PMC",
            "OpenAlex",
            "Crossref",
            "DOAJ",
            "CORE",
            "SearXNG",
        ]
        if any(r.get("sourceBadge") == "Wikidata" for r in page_results):
            engines_used.append("Wikidata")

        payload = {
            "query": q,
            "category": "medical",
            "results": page_results,
            "total": est_total,
            "page": page,
            "totalPages": total_pages,
            "hasNextPage": page < total_pages,
            "hasPrevPage": page > 1,
            "elapsed": elapsed,
            "images": [],
            "videos": [],
            "relatedQuestions": [],
            "enginesUsed": engines_used,
            "paperFallback": used_general_fallback,
        }

        await set_tab_cached("papers", q, payload, redis_client, page=page, sort=sort)

        return JSONResponse(
            status_code=200,
            content=create_web_response(payload, rid),
        )

    return router
