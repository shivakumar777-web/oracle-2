"""
health.py — Research Service Health Router
===========================================
Health check endpoints for Research service.
"""

from __future__ import annotations

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from hybrid_research import (
    check_searxng_reachable,
    hybrid_dependencies_available,
    hybrid_ready,
    get_hybrid_metrics,
    _select_retriever,
)


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

        import os

        or_key = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
        openrouter_configured = bool(or_key and len(or_key) >= 8)

        db_status = "not_configured"
        if getattr(request.app.state, "db_session_factory", None):
            db_status = "connected"

        overall_status = "healthy" if openrouter_configured else "degraded"

        hr_ok, hr_reason = hybrid_ready(settings)
        searx_reachable = False
        if (settings.SEARXNG_URL or "").strip():
            try:
                searx_reachable = await check_searxng_reachable((settings.SEARXNG_URL or "").strip())
            except Exception:
                searx_reachable = False

        # Determine active retriever
        active_retriever = _select_retriever(settings)
        tavily_available = bool(settings.TAVILY_API_KEY and settings.TAVILY_ENABLED)

        # Get runtime metrics
        metrics = get_hybrid_metrics()

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "research",
                "version": settings.SERVICE_VERSION,
                "data": {
                    "status": overall_status,
                    "llm": {
                        "configured": openrouter_configured,
                        "provider": "openrouter" if openrouter_configured else None,
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
                    "hybrid_deep_research": {
                        "use_legacy_rag": settings.RESEARCH_USE_LEGACY_RAG,
                        "hybrid_ready": hr_ok,
                        "hybrid_reason": hr_reason,
                        "gpt_researcher_import_ok": hybrid_dependencies_available(),
                        "retrievers": {
                            "primary": "searxng",
                            "fallback": "tavily" if tavily_available else None,
                            "emergency": "duckduckgo",
                            "active": active_retriever,
                            "searxng": {
                                "configured": bool(settings.SEARXNG_URL),
                                "reachable": searx_reachable,
                                "url": settings.SEARXNG_URL,
                            },
                            "tavily": {
                                "configured": tavily_available,
                                "enabled": settings.TAVILY_ENABLED,
                            },
                        },
                        "metrics": metrics,
                    },
                },
                "error": None,
            },
        )

    return router
