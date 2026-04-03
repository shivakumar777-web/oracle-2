"""
main.py — Analysis Service
===========================
Standalone FastAPI service for medical image analysis gateway.
Routes files to appropriate clinical microservices.

Endpoints:
  • POST /v1/analyze/auto    — Auto-route file to clinical service
  • POST /v1/analyze/xray/heatmap — Grad-CAM heatmap
  • POST /v1/report/enrich   — Enrich findings with ontology
  • GET  /v1/health          — Service health check
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from typing import Optional

# ── Path bootstrapping ────────────────────────────────────────────────
PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import AnalysisSettings, configure_logging, get_analysis_settings
from routers.analyze import create_analyze_router
from routers.report import create_report_router
from routers.health import create_health_router

# ── Logging ───────────────────────────────────────────────────────────
configure_logging()
logger = logging.getLogger("manthana.analysis")

# ── Lifespan context manager ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Analysis-specific resources."""
    settings: AnalysisSettings = app.state.settings

    logger.info(
        f"Analysis Service v{settings.SERVICE_VERSION} initialized | "
        f"Heatmap: {settings.ANALYSIS_ENABLE_HEATMAP} | "
        f"Enrichment: {settings.ANALYSIS_ENABLE_ENRICHMENT} | "
        f"Auto-routing: {settings.ANALYSIS_ENABLE_ROUTING}"
    )

    yield


# ── Create FastAPI app ────────────────────────────────────────────────
def create_analysis_app() -> FastAPI:
    """Create and configure the Analysis service FastAPI application."""
    settings = get_analysis_settings()

    app = FastAPI(
        title="Manthana Analysis Service",
        description="Medical image analysis gateway to clinical microservices",
        version=settings.SERVICE_VERSION,
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    # Store settings for lifespan and routers
    app.state.settings = settings

    # ── CORS ──────────────────────────────────────────────────────────
    origins = [
        settings.FRONTEND_URL,
        "http://localhost:3000",
        "http://localhost:3001",
    ]
    origins.append("http://localhost:8000")
    origins.append("http://ai-router:8000")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Rate Limiter ────────────────────────────────────────────────
    limiter = Limiter(
        key_func=get_remote_address,
        default_limits=[settings.ANALYSIS_RATE_LIMIT],
    )
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "service": "analysis",
                "error": "Rate limit exceeded. Please slow down.",
            },
        )

    # ── Request ID middleware ────────────────────────────────────────
    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        import uuid
        request_id = str(uuid.uuid4())[:8]
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    # ── Include Routers ──────────────────────────────────────────────
    app.include_router(
        create_analyze_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_report_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_health_router(),
        prefix=settings.API_PREFIX,
    )

    # ── Root redirect ────────────────────────────────────────────────
    @app.get("/")
    async def root():
        return {
            "service": "manthana-analysis",
            "version": settings.SERVICE_VERSION,
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    return app


# ── Create app instance ───────────────────────────────────────────────
app = create_analysis_app()


# ── Main entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    settings = get_analysis_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8003,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
