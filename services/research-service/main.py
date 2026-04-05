"""
main.py — Research Service
===========================
Standalone FastAPI service for deep research and plagiarism detection.

Endpoints:
  • POST /v1/deep-research  — Structured research with citations
  • POST /v1/plagiarism/check — Originality analysis
  • GET  /v1/health         — Service health check
"""

from __future__ import annotations

import logging
import sys
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Optional

# ── Path bootstrapping ────────────────────────────────────────────────
# research-service root (config, orchestrator) + repo root (services.shared)
_RS_ROOT = Path(__file__).resolve().parent
_REPO_ROOT = _RS_ROOT
for candidate in (_RS_ROOT.parents[2], _RS_ROOT.parents[1], _RS_ROOT):
    if (candidate / "services" / "shared" / "models.py").is_file():
        _REPO_ROOT = candidate
        break
for p in (_RS_ROOT, _REPO_ROOT):
    sp = str(p)
    if sp not in sys.path:
        sys.path.insert(0, sp)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

from config import ResearchSettings, configure_logging, get_research_settings
from db.session import get_engine, get_session_factory, init_db, resolve_database_url
from routers.research import create_research_router
from routers.plagiarism import create_plagiarism_router
from routers.health import create_health_router
from routers.threads import create_threads_router

# ── Optional Redis import ─────────────────────────────────────────────
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    _REDIS_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────
configure_logging()
logger = logging.getLogger("manthana.research")

# ── Lifespan context manager ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Research-specific resources."""
    settings: ResearchSettings = app.state.settings

    # Initialize Redis if configured
    if _REDIS_AVAILABLE and settings.RESEARCH_REDIS_URL:
        try:
            app.state.redis = await aioredis.from_url(
                settings.RESEARCH_REDIS_URL,
                decode_responses=True,
            )
            await app.state.redis.ping()
            logger.info("Research Redis connected")
        except Exception as e:
            logger.warning(f"Research Redis unavailable: {e}")
            app.state.redis = None
    else:
        app.state.redis = None

    app.state.db_engine = None
    app.state.db_session_factory = None
    db_url = resolve_database_url(settings.RESEARCH_DATABASE_URL)
    if db_url:
        try:
            engine = get_engine(db_url)
            await init_db(engine)
            app.state.db_engine = engine
            app.state.db_session_factory = get_session_factory(db_url)
            logger.info("Research PostgreSQL connected (threads API enabled)")
        except Exception as e:
            logger.warning("Research PostgreSQL unavailable: %s — threads API disabled", e)
    else:
        logger.info("Research DATABASE_URL not set — threads API disabled")

    logger.info(
        f"Research Service v{settings.SERVICE_VERSION} initialized | "
        f"Plagiarism: {settings.RESEARCH_ENABLE_PLAGIARISM} | "
        f"Citations: {settings.RESEARCH_ENABLE_CITATIONS} | "
        f"Legacy RAG: {settings.RESEARCH_USE_LEGACY_RAG}"
    )
    if not settings.RESEARCH_USE_LEGACY_RAG:
        try:
            from hybrid_research import check_searxng_reachable, hybrid_ready

            ok, reason = hybrid_ready(settings)
            if ok and (settings.SEARXNG_URL or "").strip():
                reachable = await check_searxng_reachable((settings.SEARXNG_URL or "").strip())
                logger.info(
                    "Hybrid deep research: ready=%s reason=%s searxng_reachable=%s",
                    ok,
                    reason,
                    reachable,
                )
            else:
                logger.warning(
                    "Hybrid deep research enabled but not ready: %s (searx=%r)",
                    reason,
                    settings.SEARXNG_URL,
                )
        except Exception as e:
            logger.warning("Hybrid deep research startup check failed: %s", e)

    yield

    # Cleanup
    if getattr(app.state, "db_engine", None):
        await app.state.db_engine.dispose()
        logger.info("Research PostgreSQL engine disposed")
    if app.state.redis:
        await app.state.redis.close()
        logger.info("Research Redis disconnected")


# ── Create FastAPI app ────────────────────────────────────────────────
def create_research_app() -> FastAPI:
    """Create and configure the Research service FastAPI application."""
    settings = get_research_settings()

    app = FastAPI(
        title="Manthana Research Service",
        description="Deep research and plagiarism detection",
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
        default_limits=[settings.RESEARCH_RATE_LIMIT],
    )
    app.state.limiter = limiter

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "service": "research",
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
        create_research_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_plagiarism_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_health_router(),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_threads_router(limiter),
        prefix=settings.API_PREFIX,
    )

    # ── Root redirect ────────────────────────────────────────────────
    @app.get("/")
    async def root():
        return {
            "service": "manthana-research",
            "version": settings.SERVICE_VERSION,
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    return app


# ── Create app instance ───────────────────────────────────────────────
app = create_research_app()


# ── Main entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    settings = get_research_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8002,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
