"""
health.py — Web Service Health Router
======================================
Health check endpoints for Web service with circuit breaker status.
"""

from __future__ import annotations

import sys

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse
import httpx

# Import circuit breakers
PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.circuit_breaker import web_searxng_circuit, web_meilisearch_circuit, get_all_circuit_stats


async def check_searxng_health(url: str) -> dict:
    """Check SearXNG health."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/healthz")
            if resp.status_code == 200:
                return {"status": "healthy", "url": url}
    except Exception as exc:
        return {"status": "unhealthy", "error": str(exc), "url": url}
    return {"status": "unknown", "url": url}


def create_health_router() -> APIRouter:
    """Create health check router."""
    router = APIRouter(tags=["health"])

    @router.get("/health")
    async def health_check(request: Request):
        """Web service health check with circuit breaker status."""
        settings = request.app.state.settings

        # Check Redis if configured
        redis_status = "not_configured"
        if settings.WEB_REDIS_URL:
            redis = getattr(request.app.state, "redis", None)
            if redis:
                try:
                    await redis.ping()
                    redis_status = "connected"
                except Exception:
                    redis_status = "disconnected"
            else:
                redis_status = "disconnected"

        # Check SearXNG
        searxng_health = await check_searxng_health(settings.WEB_SEARXNG_URL)

        # Circuit breaker status
        circuit_stats = {
            "web_searxng": web_searxng_circuit.get_stats(),
            "web_meilisearch": web_meilisearch_circuit.get_stats(),
        }

        # Determine overall status
        overall_status = "healthy"
        if searxng_health["status"] != "healthy":
            overall_status = "degraded"
        if web_searxng_circuit.state.value == "open":
            overall_status = "degraded"

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "web",
                "version": settings.SERVICE_VERSION,
                "data": {
                    "status": overall_status,
                    "cache": {
                        "type": "redis" if settings.WEB_REDIS_URL else "none",
                        "status": redis_status,
                    },
                    "search_backends": {
                        "searxng": {
                            **searxng_health,
                            "circuit_state": web_searxng_circuit.state.value,
                        },
                        "meilisearch": {
                            "enabled": settings.WEB_ENABLE_LOCAL_INDEX,
                            "configured": bool(settings.WEB_MEILISEARCH_URL),
                            "circuit_state": web_meilisearch_circuit.state.value,
                        },
                    },
                    "features": {
                        "images": settings.WEB_ENABLE_IMAGES,
                        "videos": settings.WEB_ENABLE_VIDEOS,
                        "local_index": settings.WEB_ENABLE_LOCAL_INDEX,
                        "related_questions": settings.WEB_ENABLE_RELATED_QUESTIONS,
                    },
                    "circuits": circuit_stats,
                },
                "error": None,
            },
        )

    @router.get("/health/circuits")
    async def circuit_status(request: Request):
        """Circuit breaker detailed status."""
        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "web",
                "data": {
                    "circuits": get_all_circuit_stats(),
                },
            },
        )

    return router
