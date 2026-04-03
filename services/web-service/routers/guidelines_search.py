"""
guidelines_search.py — Clinical Guidelines Search Router
=========================================================
Dedicated endpoint for clinical guidelines (WHO, NICE, CDC, etc.).
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

from clients.guidelines import fetch_guidelines
from routers.search import fetch_searxng, enrich_result, deduplicate_results, sort_by_trust
from cache import get_tab_cached, set_tab_cached

import logging
logger = logging.getLogger("manthana.web.guidelines_search")

GUIDELINE_SITES = [
    "who.int",
    "nice.org.uk",
    "cdc.gov",
    "heart.org",
    "diabetes.org",
    "icmr.gov.in",
    "sign.ac.uk",
    "guidelinecentral.com",
    "guidelines.gov",
    "ayush.gov.in",
]

PER_PAGE = 20


def _merge_guidelines(
    guidelines_a: List[Dict[str, Any]],
    guidelines_b: List[Dict[str, Any]],
    searxng_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge and deduplicate by URL. Force type=guideline."""
    seen = set()
    merged = []
    for r in guidelines_a + guidelines_b + searxng_results:
        url = r.get("url", "")
        if not url or url in seen:
            continue
        seen.add(url)
        r = dict(r)
        r["type"] = "guideline"
        merged.append(r)
    return merged


def create_guidelines_router(limiter) -> APIRouter:
    """Create the guidelines search router."""
    router = APIRouter(tags=["search"])

    @router.get("/search/guidelines")
    @limiter.limit("200/minute")
    async def search_guidelines(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        org: str = Query(default=None, description="Filter: who|nice|cdc|aha|all"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Search clinical guidelines from WHO, NICE, CDC, AHA, ICMR, etc."""
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

        # Check cache
        cached = await get_tab_cached("guidelines", q, redis_client, page=page, org=org)
        if cached:
            cached["elapsed"] = int((time.time() - start_time) * 1000)
            return JSONResponse(
                status_code=200,
                content=create_web_response(cached, rid),
            )

        # Strategy 1: SearXNG with site: operators
        site_query = " OR ".join(f"site:{s}" for s in GUIDELINE_SITES[:6])
        site_full = f"{q} ({site_query})"

        # Strategy 2: MeiliSearch guidelines index
        guidelines_task = None
        if (
            getattr(settings, "WEB_ENABLE_GUIDELINES", True)
            and settings.WEB_MEILISEARCH_URL
        ):
            guidelines_task = fetch_guidelines(
                q,
                getattr(settings, "WEB_MEILISEARCH_GUIDELINES_INDEX", "guidelines"),
                settings.WEB_MEILISEARCH_URL,
                settings.WEB_MEILISEARCH_KEY,
                limit=15,
            )

        # Strategy 3: SearXNG with "clinical guideline" appended
        guideline_query = f"{q} clinical guideline recommendation protocol"

        searxng_site_task = fetch_searxng(
            site_full, "general", "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )
        searxng_guideline_task = fetch_searxng(
            guideline_query, "medical", "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )

        tasks = [searxng_site_task, searxng_guideline_task]
        if guidelines_task is not None:
            tasks.append(guidelines_task)

        try:
            gathered = await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as exc:
            logger.warning(f"Guidelines search error: {exc}")
            gathered = [{"results": []}, {"results": []}, []]

        searxng_site = gathered[0] if not isinstance(gathered[0], Exception) else {"results": []}
        searxng_guideline = gathered[1] if not isinstance(gathered[1], Exception) else {"results": []}
        meili_guidelines = gathered[2] if len(gathered) > 2 and not isinstance(gathered[2], Exception) else []

        searxng_raw = list(searxng_site.get("results", [])) + list(searxng_guideline.get("results", []))
        searxng_enriched = [enrich_result(r) for r in searxng_raw]
        # Filter to guideline-like results
        searxng_guidelines = [
            r for r in searxng_enriched
            if r.get("type") == "guideline"
            or "guideline" in (r.get("url") or "").lower()
            or "who.int" in (r.get("url") or "").lower()
            or "nice.org" in (r.get("url") or "").lower()
            or "cdc.gov" in (r.get("url") or "").lower()
        ]
        for r in searxng_guidelines:
            r["type"] = "guideline"

        merged = _merge_guidelines(meili_guidelines, [], searxng_guidelines)
        enriched = [enrich_result(r) for r in merged]
        enriched = deduplicate_results(enriched)
        enriched = sort_by_trust(enriched)

        guideline_fallback_used = False
        if len(enriched) < 8:
            try:
                fb = await fetch_searxng(
                    f'{q} (guideline OR "clinical practice" OR recommendation OR protocol)',
                    "general",
                    "json",
                    page,
                    settings.WEB_SEARXNG_URL,
                    settings.WEB_SEARXNG_TIMEOUT,
                )
                raw = list(fb.get("results", []))[:35] if isinstance(fb, dict) else []
                fb_enriched = [enrich_result(r) for r in raw]
                for r in fb_enriched:
                    r["type"] = "guideline"
                    r["guidelineFallback"] = True
                merged_fb = _merge_guidelines(enriched, [], fb_enriched)
                enriched = [enrich_result(r) for r in merged_fb]
                enriched = deduplicate_results(enriched)
                enriched = sort_by_trust(enriched)
                guideline_fallback_used = True
            except Exception as exc:
                logger.warning("Guidelines fallback SearXNG failed: %s", exc)

        total = len(enriched)
        start = (page - 1) * PER_PAGE
        page_results = enriched[start : start + PER_PAGE]

        for r in page_results:
            r.setdefault("type", "guideline")

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
            "enginesUsed": ["SearXNG", "Guidelines"],
            "guidelineFallback": guideline_fallback_used,
        }

        await set_tab_cached("guidelines", q, payload, redis_client, page=page, org=org)

        return JSONResponse(
            status_code=200,
            content=create_web_response(payload, rid),
        )

    return router
