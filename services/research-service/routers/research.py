"""
research.py — Deep Research Router
===================================
Structured deep research with citations + SSE stream (Phase 2).
"""

from __future__ import annotations

import json
import logging
from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, StreamingResponse

from auth import get_protected_user, require_staff_user
from config import ResearchSettings, get_research_settings
from evolution import read_recent_lessons
from orchestrator import run_research, stream_research_events
from services.shared.domain_sources import (
    DOMAIN_AUTO_SOURCES,
    INTEGRATIVE_CROSS_DOMAIN_CORE,
    SOURCE_SITE_FRAGMENT,
)
from services.shared.domain_sources_meta import source_meta_for_api
from services.shared.models import DeepResearchRequest

logger = logging.getLogger("manthana.research.deep")


def create_research_router(limiter) -> APIRouter:
    """Create the deep research router."""
    router = APIRouter(tags=["research"])

    @router.post("/deep-research")
    @limiter.limit("60/minute")
    async def deep_research(
        request: Request,
        body: DeepResearchRequest,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
    ):
        """Structured deep research with multi-source RAG and intent-aware synthesis."""
        rid = getattr(request.state, "request_id", "unknown")
        _ = user  # optional user context for future audit

        if not settings.RESEARCH_ENABLE_CITATIONS:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "service": "research",
                    "error": "Research citations disabled",
                    "request_id": rid,
                },
            )

        data = await run_research(body, settings, rid)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "data": data,
                "error": None,
                "request_id": rid,
            },
        )

    @router.post("/deep-research/stream")
    @limiter.limit("60/minute")
    async def deep_research_stream(
        request: Request,
        body: DeepResearchRequest,
        settings: ResearchSettings = Depends(get_research_settings),
        user: Optional[dict] = Depends(get_protected_user),
    ):
        """Server-Sent Events stream: logs → sections → citations → follow-up → done."""
        rid = getattr(request.state, "request_id", "unknown")
        _ = user

        if not settings.RESEARCH_ENABLE_CITATIONS:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "service": "research",
                    "error": "Research citations disabled",
                    "request_id": rid,
                },
            )

        async def event_generator():
            async for ev in stream_research_events(body, settings, rid):
                yield f"data: {json.dumps(ev, ensure_ascii=False)}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    @router.get("/config/domain-sources")
    async def domain_sources_config():
        """Public config — canonical domain source map for Universal Search UI."""
        return {
            "domain_auto_sources": DOMAIN_AUTO_SOURCES,
            "integrative_core": INTEGRATIVE_CROSS_DOMAIN_CORE,
            "source_site_fragments": SOURCE_SITE_FRAGMENT,
            "source_meta": source_meta_for_api(),
        }

    @router.get("/research/insights")
    async def research_insights(
        user: dict = Depends(require_staff_user),
    ):
        """Last 50 research memory lessons (JSONL tail) — staff only."""
        _ = user
        return {"lessons": read_recent_lessons(50)}

    return router
