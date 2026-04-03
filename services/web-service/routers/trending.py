"""
trending.py — Web Trending Router
==================================
Trending search queries.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from services.shared.envelopes import create_web_response

logger = logging.getLogger("manthana.web.trending")


def create_trending_router() -> APIRouter:
    """Create the trending router."""
    router = APIRouter(tags=["trending"])

    @router.get("/trending")
    async def trending(
        request: Request,
        timeframe: str = Query(default="day", description="hour, day, week"),
        limit: int = Query(default=20, ge=1, le=50),
    ):
        """Get trending medical search queries."""
        rid = getattr(request.state, "request_id", "unknown")
        db = getattr(request.app.state, "db", None)

        if not db or not db.available:
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"timeframe": timeframe, "queries": []},
                    rid,
                ),
            )

        queries = await db.get_trending(timeframe, limit)
        return JSONResponse(
            status_code=200,
            content=create_web_response(
                {"timeframe": timeframe, "queries": queries},
                rid,
            ),
        )

    return router
