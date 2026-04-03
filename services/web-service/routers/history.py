"""
history.py — Web Search History Router
=======================================
User search history for logged-in users.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from services.shared.envelopes import create_web_response

logger = logging.getLogger("manthana.web.history")


def create_history_router() -> APIRouter:
    """Create the history router."""
    router = APIRouter(tags=["history"])

    @router.get("/history")
    async def get_history(
        request: Request,
        limit: int = Query(default=50, ge=1, le=100),
    ):
        """Get search history. Returns recent searches (user-filtered when auth available)."""
        rid = getattr(request.state, "request_id", "unknown")
        db = getattr(request.app.state, "db", None)
        user_id = getattr(request.state, "user_id", None)

        if not db or not db.available:
            return JSONResponse(
                status_code=200,
                content=create_web_response({"history": []}, rid),
            )

        history = await db.get_search_history(user_id, limit)
        return JSONResponse(
            status_code=200,
            content=create_web_response({"history": history}, rid),
        )

    return router
