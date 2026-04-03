"""
health.py — Analysis Service Health Router
===========================================
Health check endpoints for Analysis service.
"""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse


async def check_service_health(url: str, name: str) -> dict:
    """Check health of a downstream clinical service."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(f"{url}/health")
            if resp.status_code == 200:
                return {"name": name, "status": "healthy", "url": url}
    except Exception as exc:
        return {"name": name, "status": "unhealthy", "error": str(exc), "url": url}
    return {"name": name, "status": "unknown", "url": url}


def create_health_router() -> APIRouter:
    """Create health check router."""
    router = APIRouter(tags=["health"])

    @router.get("/health")
    async def health_check(request: Request):
        """Analysis service health check."""
        settings = request.app.state.settings

        # Check downstream services (async - but don't block)
        services = {
            "ecg": settings.ECG_URL,
            "eye": settings.EYE_URL,
            "cancer": settings.CANCER_URL,
            "pathology": settings.PATHOLOGY_URL,
            "brain": settings.BRAIN_URL,
        }

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "analysis",
                "version": settings.SERVICE_VERSION,
                "data": {
                    "status": "healthy",
                    "gateway": {
                        "auto_routing": settings.ANALYSIS_ENABLE_ROUTING,
                        "max_file_size_mb": settings.ANALYSIS_MAX_FILE_SIZE_MB,
                    },
                    "features": {
                        "heatmap": settings.ANALYSIS_ENABLE_HEATMAP,
                        "enrichment": settings.ANALYSIS_ENABLE_ENRICHMENT,
                    },
                    "clinical_services": {
                        name: {"url": url, "configured": bool(url)}
                        for name, url in services.items()
                    },
                },
                "error": None,
            },
        )

    return router
