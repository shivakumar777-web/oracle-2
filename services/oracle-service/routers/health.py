"""
health.py — Oracle Service Health Router
=========================================
Health check endpoints for Oracle service with circuit breaker status.
"""

from __future__ import annotations

import os

from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

from routers.chat import INTELLIGENCE_LIB_LOADED
from routers.m5 import M5_ENGINE_LOADED
from services.shared.circuit_breaker import (
    oracle_groq_circuit,
    oracle_openrouter_circuit,
    oracle_ollama_circuit,
    get_all_circuit_stats,
)


def create_health_router() -> APIRouter:
    """Create health check router."""
    router = APIRouter(tags=["health"])

    @router.get("/health")
    async def health_check(request: Request):
        """Oracle service health check with circuit breaker status."""
        settings = request.app.state.settings

        openrouter_configured = bool(
            (settings.OPENROUTER_API_KEY or "").strip()
            or (getattr(settings, "ORACLE_OPENROUTER_API_KEY", None) or "").strip()
            or (os.environ.get("OPENROUTER_API_KEY") or "").strip()
            or (os.environ.get("ORACLE_OPENROUTER_API_KEY") or "").strip()
        )

        cloud_inference_ok = getattr(request.app.state, "cloud_inference_ok", True)
        cloud_inference_error = getattr(request.app.state, "cloud_inference_error", "") or None

        # Check Redis if configured
        redis_status = "not_configured"
        if settings.ORACLE_REDIS_URL:
            redis = getattr(request.app.state, "redis", None)
            if redis:
                try:
                    await redis.ping()
                    redis_status = "connected"
                except Exception:
                    redis_status = "disconnected"
            else:
                redis_status = "disconnected"

        # Circuit breaker status (oracle_groq is a deprecated alias for oracle_openrouter)
        circuit_stats = {
            "oracle_openrouter": oracle_openrouter_circuit.get_stats(),
            "oracle_groq": oracle_groq_circuit.get_stats(),
            "oracle_ollama": oracle_ollama_circuit.get_stats(),
        }

        # Determine overall status
        overall_status = "healthy"
        if not openrouter_configured:
            overall_status = "degraded"
        if not cloud_inference_ok:
            overall_status = "degraded"
        if oracle_openrouter_circuit.state.value == "open" and oracle_ollama_circuit.state.value == "open":
            overall_status = "unhealthy"

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "oracle",
                "version": settings.SERVICE_VERSION,
                "data": {
                    "status": overall_status,
                    "llm": {
                        "primary": "openrouter" if openrouter_configured else "not_configured",
                        "configured": openrouter_configured,
                        "cloud_inference_config_ok": cloud_inference_ok,
                        "cloud_inference_config_error": cloud_inference_error,
                        "use_free_models_router": bool(
                            getattr(settings, "ORACLE_USE_FREE_MODELS", False)
                        ),
                        "circuits": {
                            "openrouter": oracle_openrouter_circuit.state.value,
                            "llm": oracle_openrouter_circuit.state.value,
                            "ollama": oracle_ollama_circuit.state.value,
                        },
                    },
                    "cache": {
                        "type": "redis" if settings.ORACLE_REDIS_URL else "none",
                        "status": redis_status,
                    },
                    "features": {
                        "m5": settings.ORACLE_ENABLE_M5,
                        "trials": settings.ORACLE_ENABLE_TRIALS,
                        "pubmed": settings.ORACLE_ENABLE_PUBMED,
                        "domain_intelligence": settings.ORACLE_ENABLE_DOMAIN_INTELLIGENCE,
                        "use_rag": getattr(settings, "ORACLE_USE_RAG", False),
                    },
                    "circuits": circuit_stats,
                    "intelligence_modules": {
                        "domain_intelligence": INTELLIGENCE_LIB_LOADED,
                        "query_classification": INTELLIGENCE_LIB_LOADED,
                        "m5_engine": M5_ENGINE_LOADED,
                    },
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
                "service": "oracle",
                "data": {
                    "circuits": get_all_circuit_stats(),
                },
            },
        )

    return router
