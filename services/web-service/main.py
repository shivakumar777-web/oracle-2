"""
main.py — Web Service
=====================
Standalone FastAPI service for medical web search.
Pure search aggregation - NO LLM synthesis. NO AI.

Endpoints:
  • GET  /v1/search              — Medical web search
  • GET  /v1/search/papers       — Research papers (PubMed, Semantic Scholar)
  • GET  /v1/search/guidelines   — Clinical guidelines (WHO, NICE, CDC)
  • GET  /v1/search/trials       — Clinical trials (ClinicalTrials.gov)
  • GET  /v1/search/pdfs        — PDF documents
  • GET  /v1/search/autocomplete — Search suggestions
  • GET  /v1/search/images       — Image search
  • GET  /v1/search/videos       — Video search
  • GET  /v1/knowledge/summary   — AI summary for knowledge panel (Groq, cached 24h)
  • GET  /v1/trending            — Trending queries
  • GET  /v1/history             — Search history
  • GET  /v1/health              — Service health check
  • POST /v1/feedback            — Result click feedback
"""

from __future__ import annotations

import logging
import os
import sys
from contextlib import asynccontextmanager
from typing import Optional

# ── Path bootstrapping ────────────────────────────────────────────────
PROJECT_ROOT = os.environ.get("MANTHANA_ROOT", "/opt/manthana")
for root in (PROJECT_ROOT, "/app"):
    if root not in sys.path:
        sys.path.insert(0, root)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import WebSettings, configure_logging, get_web_settings
from database import Database
from routers.search import create_search_router
from routers.papers import create_papers_router
from routers.guidelines_search import create_guidelines_router
from routers.trials import create_trials_router
from routers.pdfs import create_pdfs_router
from routers.autocomplete import create_autocomplete_router
from routers.health import create_health_router
from routers.feedback import create_feedback_router
from routers.trending import create_trending_router
from routers.history import create_history_router
from routers.knowledge import create_knowledge_router

# ── Optional Redis import ─────────────────────────────────────────────
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    _REDIS_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────
configure_logging()
logger = logging.getLogger("manthana.web")

# ── Lifespan context manager ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Web-specific resources."""
    settings: WebSettings = app.state.settings

    # Initialize Redis if configured
    if _REDIS_AVAILABLE and settings.WEB_REDIS_URL:
        try:
            app.state.redis = await aioredis.from_url(
                settings.WEB_REDIS_URL,
                decode_responses=True,
            )
            await app.state.redis.ping()
            logger.info("Web Redis connected")
        except Exception as e:
            logger.warning(f"Web Redis unavailable: {e}")
            app.state.redis = None
    else:
        app.state.redis = None

    # Initialize PostgreSQL if configured
    app.state.db = None
    if settings.DATABASE_URL:
        db = Database(settings.DATABASE_URL)
        await db.connect()
        if db.available:
            await db.init_schema()
            app.state.db = db
            logger.info("Web database connected")
        else:
            await db.close()

    logger.info(
        f"Web Service v{settings.SERVICE_VERSION} initialized | "
        f"SearXNG: {settings.WEB_SEARXNG_URL} | "
        f"MeiliSearch: {settings.WEB_MEILISEARCH_URL or 'disabled'} | "
        f"Images: {settings.WEB_ENABLE_IMAGES} | "
        f"Videos: {settings.WEB_ENABLE_VIDEOS}"
    )

    yield

    # Cleanup
    if app.state.redis:
        await app.state.redis.close()
        logger.info("Web Redis disconnected")
    if app.state.db:
        await app.state.db.close()


# ── Create FastAPI app ────────────────────────────────────────────────
def create_web_app() -> FastAPI:
    """Create and configure the Web service FastAPI application."""
    settings = get_web_settings()

    app = FastAPI(
        title="Manthana Web — Medical Search",
        description="Pure medical search engine. No AI synthesis.",
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
        default_limits=[settings.WEB_RATE_LIMIT],
    )
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "service": "web",
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
        create_search_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_papers_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_guidelines_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_trials_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_pdfs_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_autocomplete_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_health_router(),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_feedback_router(),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_trending_router(),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_history_router(),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_knowledge_router(),
        prefix=settings.API_PREFIX,
    )

    # ── Root redirect ────────────────────────────────────────────────
    @app.get("/")
    async def root():
        return {
            "service": "manthana-web",
            "version": settings.SERVICE_VERSION,
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    return app


# ── Create app instance ───────────────────────────────────────────────
app = create_web_app()


# ── Main entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    settings = get_web_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8001,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
