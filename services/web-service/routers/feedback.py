"""
feedback.py — Web Feedback Router
==================================
Result click tracking for ranking improvement.
"""

from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from services.shared.envelopes import create_web_response

logger = logging.getLogger("manthana.web.feedback")


class FeedbackRequest(BaseModel):
    """Click feedback payload."""
    query: str = Field(..., min_length=1)
    result_url: str = Field(..., min_length=1)
    position: int = Field(..., ge=0)


def create_feedback_router() -> APIRouter:
    """Create the feedback router."""
    router = APIRouter(tags=["feedback"])

    @router.post("/feedback")
    async def feedback(
        request: Request,
        body: FeedbackRequest,
    ):
        """Record result click for analytics."""
        rid = getattr(request.state, "request_id", "unknown")
        db = getattr(request.app.state, "db", None)

        if db and db.available:
            user_id = getattr(request.state, "user_id", None)
            try:
                await db.record_click(
                    body.query,
                    body.result_url,
                    body.position,
                    user_id,
                )
            except Exception as e:
                logger.debug(f"Feedback record error: {e}")

        return JSONResponse(
            status_code=200,
            content=create_web_response({"status": "recorded"}, rid),
        )

    return router
