"""
health.py — Research Service Health Router
===========================================
Health check endpoints for Research service.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


def create_health_router() -> APIRouter:
    """Create health check router."""
    router = APIRouter(tags=["health"])

    @router.get("/health")
    async def health_check(request: Request):
        """Research service health check."""
        settings = request.app.state.settings

        # Check Redis if configured
        redis_status = "not_configured"
        if settings.RESEARCH_REDIS_URL:
            redis = getattr(request.app.state, "redis", None)
            if redis:
                try:
                    await redis.ping()
                    redis_status = "connected"
                except Exception:
                    redis_status = "disconnected"
            else:
                redis_status = "disconnected"

        # Check Groq
        groq_configured = bool(settings.RESEARCH_GROQ_API_KEY and len(settings.RESEARCH_GROQ_API_KEY) > 20)

        db_status = "not_configured"
        if getattr(request.app.state, "db_session_factory", None):
            db_status = "connected"

        overall_status = "healthy" if groq_configured else "degraded"

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "version": settings.SERVICE_VERSION,
                "data": {
                    "status": overall_status,
                    "llm": {
                        "configured": groq_configured,
                        "model": settings.RESEARCH_GROQ_MODEL if groq_configured else None,
                    },
                    "cache": {
                        "type": "redis" if settings.RESEARCH_REDIS_URL else "none",
                        "status": redis_status,
                    },
                    "vector_store": {
                        "configured": bool(settings.RESEARCH_QDRANT_URL),
                        "url": settings.RESEARCH_QDRANT_URL,
                    },
                    "database": {
                        "threads_api": db_status,
                    },
                    "features": {
                        "plagiarism": settings.RESEARCH_ENABLE_PLAGIARISM,
                        "originality": settings.RESEARCH_ENABLE_ORIGINALITY,
                        "citations": settings.RESEARCH_ENABLE_CITATIONS,
                    },
                },
                "error": None,
            },
        )

    return router
