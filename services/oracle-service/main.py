"""
main.py — Oracle Service
=========================
Standalone FastAPI service for Oracle chat, M5 five-domain mode,
and query intelligence. No search fallback — Oracle handles failures
internally via fallback LLM (Ollama).

Endpoints:
  • POST /v1/chat       — Streaming chat with domain intelligence
  • POST /v1/chat/m5    — M5 five-domain parallel answers
  • GET  /v1/health     — Service health check
"""

from __future__ import annotations

# ── Path bootstrapping (must run before services.shared / ai-router imports) ──
import paths_bootstrap

paths_bootstrap.ensure_oracle_sys_path()

import json as _json
import logging
from contextlib import asynccontextmanager
from typing import Optional


def json_log(logger_name: str, level: str, **fields) -> None:
    """Emit structured JSON log without heavy dependencies."""
    log_obj = logging.getLogger(logger_name)
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    if not log_obj.isEnabledFor(numeric_level):
        return
    try:
        record = _json.dumps(fields, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        record = str(fields)
    log_obj.log(numeric_level, record)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from config import OracleSettings, configure_logging, get_oracle_settings
from routers.chat import create_chat_router
from routers.m5 import create_m5_router
from routers.health import create_health_router

# ── Optional Redis import ─────────────────────────────────────────────
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None
    _REDIS_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────
configure_logging()
logger = logging.getLogger("manthana.oracle")

# ── Lifespan context manager ─────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize Oracle-specific resources."""
    settings: OracleSettings = app.state.settings

    # Shared httpx client for RAG (MeiliSearch, Qdrant, etc.)
    import httpx
    app.state.client = httpx.AsyncClient(
        timeout=httpx.Timeout(20.0, connect=5.0),
        limits=httpx.Limits(max_connections=50, max_keepalive_connections=10),
    )

    # Initialize Redis if configured
    if _REDIS_AVAILABLE and settings.ORACLE_REDIS_URL:
        try:
            app.state.redis = await aioredis.from_url(
                settings.ORACLE_REDIS_URL,
                decode_responses=True,
            )
            await app.state.redis.ping()
            json_log("manthana.oracle", "info", event="redis_connected")
        except Exception as e:
            json_log("manthana.oracle", "warning", event="redis_unavailable", error=str(e))
            app.state.redis = None
    else:
        app.state.redis = None

    # Store settings for access in routers
    app.state.settings = settings

    # Warm OpenRouter / cloud_inference.yaml so chat can fail gracefully (SSE) instead of HTTP 500
    try:
        from services.shared.openrouter_helpers import get_inference_config

        get_inference_config()
        app.state.cloud_inference_ok = True
        app.state.cloud_inference_error = ""
        json_log("manthana.oracle", "info", event="cloud_inference_config_loaded")
    except Exception as e:
        app.state.cloud_inference_ok = False
        app.state.cloud_inference_error = str(e)
        json_log(
            "manthana.oracle",
            "error",
            event="cloud_inference_config_failed",
            error=str(e),
            hint="Set CLOUD_INFERENCE_CONFIG_PATH to cloud_inference.yaml (see Dockerfile) or mount the file.",
        )

    json_log(
        "manthana.oracle", "info",
        event="oracle_initialized",
        version=settings.SERVICE_VERSION,
        m5_enabled=settings.ORACLE_ENABLE_M5,
        trials_enabled=settings.ORACLE_ENABLE_TRIALS,
        pubmed_enabled=settings.ORACLE_ENABLE_PUBMED,
    )

    yield

    # Cleanup
    if getattr(app.state, "client", None):
        await app.state.client.aclose()
    if app.state.redis:
        await app.state.redis.close()
        json_log("manthana.oracle", "info", event="redis_disconnected")


# ── Create FastAPI app ────────────────────────────────────────────────
def create_oracle_app() -> FastAPI:
    """Create and configure the Oracle service FastAPI application."""
    settings = get_oracle_settings()

    app = FastAPI(
        title="Manthana Oracle Service",
        description="Chat and M5 five-domain medical intelligence",
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
    # Support ai-router for gradual migration
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
        default_limits=[settings.ORACLE_RATE_LIMIT],
    )
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        return JSONResponse(
            status_code=429,
            content={
                "status": "error",
                "service": "oracle",
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
        create_chat_router(limiter),
        prefix=settings.API_PREFIX,
    )
    app.include_router(
        create_m5_router(limiter),
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
            "service": "manthana-oracle",
            "version": settings.SERVICE_VERSION,
            "docs": "/docs",
            "health": f"{settings.API_PREFIX}/health",
        }

    # Legacy gateway shape — frontend getHealth() calls {API_ORIGIN}/health (no /v1 prefix).
    @app.get("/health")
    async def legacy_gateway_health():
        return {
            "status": "success",
            "data": {
                "router": "online",
                "services": {
                    "oracle": "online",
                    "nlp": "online",
                },
            },
            "error": None,
        }

    return app


# ── Create app instance ───────────────────────────────────────────────
app = create_oracle_app()


# ── Main entry point ────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    settings = get_oracle_settings()
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level=settings.LOG_LEVEL.lower(),
    )
