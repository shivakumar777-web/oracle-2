"""
trials.py — Clinical Trials Search Router
==========================================
Dedicated endpoint for clinical trials with pagination.
"""

from __future__ import annotations

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
from services.shared.circuit_breaker import web_clinical_trials_circuit, CircuitBreakerError

from cache import get_tab_cached, set_tab_cached
from clients.clinical_trials import fetch_clinical_trials
from routers.search import fetch_searxng, enrich_result

import logging
logger = logging.getLogger("manthana.web.trials")

PER_PAGE = 20


def create_trials_router(limiter) -> APIRouter:
    """Create the trials search router."""
    router = APIRouter(tags=["search"])

    @router.get("/search/trials")
    @limiter.limit("200/minute")
    async def search_trials(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        page_token: str | None = Query(default=None, description="Next page token from previous response"),
        status: str | None = Query(default=None, description="RECRUITING|COMPLETED|ALL"),
        phase: str | None = Query(default=None, description="PHASE1|PHASE2|PHASE3|PHASE4"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Search clinical trials with pagination (ClinicalTrials.gov)."""
        rid = getattr(request.state, "request_id", "unknown")
        start_time = time.time()
        redis_client = getattr(request.app.state, "redis", None)

        if not getattr(settings, "WEB_ENABLE_TRIALS", True):
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "results": [], "total": 0, "page": page, "totalPages": 0, "hasNextPage": False, "hasPrevPage": False, "elapsed": 0},
                    rid,
                ),
            )

        if not q or not q.strip():
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "results": [], "total": 0, "page": page, "totalPages": 0, "hasNextPage": False, "hasPrevPage": False, "elapsed": 0},
                    rid,
                ),
            )

        # Check cache
        cached = await get_tab_cached(
            "trials", q, redis_client, page=page, page_token=page_token or ""
        )
        if cached:
            cached["elapsed"] = int((time.time() - start_time) * 1000)
            return JSONResponse(
                status_code=200,
                content=create_web_response(cached, rid),
            )

        # For page > 1 we need page_token from previous response
        token = page_token if page > 1 else None

        try:
            results, next_token, total_count = await web_clinical_trials_circuit.call(
                fetch_clinical_trials, q, limit=PER_PAGE, page_token=token
            )
        except CircuitBreakerError:
            logger.warning("Clinical trials circuit open")
            results, next_token, total_count = [], None, 0
        except Exception as exc:
            logger.warning(f"Trials search error: {exc}")
            results, next_token, total_count = [], None, 0

        trials_fallback_used = False
        if len(results) < 5:
            try:
                fb = await fetch_searxng(
                    f"{q} clinical trial recruiting OR interventional",
                    "medical",
                    "json",
                    page,
                    settings.WEB_SEARXNG_URL,
                    settings.WEB_SEARXNG_TIMEOUT,
                )
                raw = list(fb.get("results", []))[:25] if isinstance(fb, dict) else []
                seen_urls = {r.get("url") for r in results if r.get("url")}
                for row in raw:
                    e = enrich_result(row)
                    u = (e.get("url") or "").lower()
                    title_l = (e.get("title") or "").lower()
                    if (
                        "clinicaltrials.gov" in u
                        or "ctri.nic.in" in u
                        or "clinical trial" in title_l
                        or "nct" in title_l
                    ):
                        e.setdefault("type", "trial")
                        e.setdefault("trustScore", 78)
                        e["trialsFallback"] = True
                        url = e.get("url")
                        if url and url not in seen_urls:
                            seen_urls.add(url)
                            results.append(e)
                            trials_fallback_used = True
            except Exception as exc:
                logger.warning("Trials SearXNG fallback failed: %s", exc)

        results = results[:PER_PAGE]

        # Ensure each result has type and trustScore
        for r in results:
            r.setdefault("type", "trial")
            r.setdefault("trustScore", 90)
            r.setdefault("isPeerReviewed", False)

        elapsed = int((time.time() - start_time) * 1000)
        total = max(total_count or 0, len(results))
        total_pages = max(1, (total + PER_PAGE - 1) // PER_PAGE) if total else 1

        payload = {
            "query": q,
            "category": "medical",
            "results": results,
            "total": total,
            "page": page,
            "totalPages": total_pages,
            "hasNextPage": bool(next_token),
            "hasPrevPage": page > 1,
            "nextPageToken": next_token,
            "elapsed": elapsed,
            "images": [],
            "videos": [],
            "relatedQuestions": [],
            "enginesUsed": ["ClinicalTrials.gov", "SearXNG"] if trials_fallback_used else ["ClinicalTrials.gov"],
            "trialsFallback": trials_fallback_used,
        }

        await set_tab_cached(
            "trials", q, payload, redis_client, page=page, page_token=page_token or ""
        )

        return JSONResponse(
            status_code=200,
            content=create_web_response(payload, rid),
        )

    return router
