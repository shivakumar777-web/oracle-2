import sys
import os
import logging
from typing import Any, Dict, List, Optional

# Add project root to path for shared module access
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Add ai-tools to path
AI_TOOLS = os.path.join(PROJECT_ROOT, "ai-tools")
if AI_TOOLS not in sys.path:
    sys.path.insert(0, AI_TOOLS)

import httpx
from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id, json_log

# Optional Redis for SNOMED caching
try:
    import redis.asyncio as aioredis  # type: ignore[import]

    _REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

_redis_client: Optional["aioredis.Redis"] = None  # type: ignore[name-defined]


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BIOMEDBERT_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../ai-tools/biomedbert"))
SCIBERT_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../ai-tools/scibert"))
PUBMEDBERT_PATH = os.path.abspath(os.path.join(BASE_DIR, "../../ai-tools/pubmedbert"))

for path in (BIOMEDBERT_PATH, SCIBERT_PATH, PUBMEDBERT_PATH):
    if path not in sys.path:
        sys.path.insert(0, path)


logger = logging.getLogger("manthana-nlp")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


async def _get_redis(settings: Settings):
    """Lazy-create a Redis client for SNOMED caching."""
    global _redis_client
    if not _REDIS_AVAILABLE or aioredis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis_client.ping()
            logger.info("[REDIS] NLP service cache connected (%s)", settings.REDIS_URL)
        except Exception as exc:
            logger.warning("[REDIS] NLP service cache unavailable: %s", exc)
            _redis_client = None
    return _redis_client


class MedicalQueryRequest(BaseModel):
    question: str = Field(..., description="User medical question.")
    context: Optional[str] = Field(
        default=None, description="Optional additional context or prior results."
    )
    sources: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional structured search results."
    )


class Entity(BaseModel):
    text: str
    type: str
    start: int
    end: int


class EntityExtractionRequest(BaseModel):
    text: str


class SummarizeRequest(BaseModel):
    report_text: str


class ICDClassifyRequest(BaseModel):
    description: str


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana NLP Service",
        description="Medical NLP service using Ollama and biomedical transformers.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            os.getenv("FRONTEND_URL", "http://localhost:3001"),
            "http://localhost:3000",
            "http://localhost:3001",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    client = httpx.AsyncClient(timeout=60.0)

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.middleware("http")
    async def enforce_max_upload_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if content_length and int(content_length) > max_bytes:
            request_id = getattr(request.state, "request_id", generate_request_id())
            error = ErrorDetail(
                code=413,
                message="Payload too large.",
                details={"max_mb": settings.MAX_UPLOAD_MB},
            )
            payload = format_response(
                status="error",
                service="nlp",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=413, content=payload)
        return await call_next(request)

    async def call_ollama(
        model: str,
        prompt: str,
        system_prompt: Optional[str],
        request_id: str,
    ) -> str:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        try:
            resp = await client.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/chat",
                json={"model": model, "messages": messages, "stream": False},
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception as exc:
            json_log(
                "manthana-nlp",
                "error",
                event="ollama_call_failed",
                error=str(exc),
                request_id=request_id,
            )
            raise HTTPException(
                status_code=502, detail="Failed to call language model backend."
            ) from exc

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the NLP service.",
    )
    async def health(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        return HealthResponse(
            status="healthy",
            service="nlp",
            details=None,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="NLP service information.",
    )
    async def info(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        data = {
            "service": "nlp",
            "ollama_url": settings.OLLAMA_URL,
            "meditron_model": settings.MEDITRON_MODEL,
            "summary_model": settings.SUMMARY_MODEL,
        }
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/query/medical",
        response_model=BaseResponse,
        tags=["qa"],
        description="Answer a medical question using the meditron model.",
    )
    async def query_medical(
        request: Request,
        body: MedicalQueryRequest,
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        system_prompt = (
            "You are a medical AI assistant. "
            "Answer based on evidence-based medicine only. "
            "Always recommend consulting a doctor."
        )
        context = body.context or ""
        if body.sources:
            context += f"\n\nSources: {body.sources}"
        prompt = f"Context:\n{context}\n\nQuestion:\n{body.question}\n\nAnswer:"
        answer = await call_ollama(
            model=settings.MEDITRON_MODEL,
            prompt=prompt,
            system_prompt=system_prompt,
            request_id=request_id,
        )
        data = {
            "question": body.question,
            "answer": answer,
            "sources": body.sources,
            "disclaimer": DISCLAIMER,
        }
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/extract/entities",
        response_model=BaseResponse,
        tags=["ner"],
        description="Extract medical entities such as diseases, drugs, and procedures.",
    )
    async def extract_entities(
        request: Request,
        body: EntityExtractionRequest,
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        # Lightweight rule-based fallback for environments without heavy models
        text = body.text
        entities: List[Entity] = []
        keywords = {
            "disease": ["pneumonia", "diabetes", "hypertension"],
            "drug": ["paracetamol", "ibuprofen", "metformin"],
            "symptom": ["fever", "cough", "pain"],
        }
        lower = text.lower()
        for etype, words in keywords.items():
            for w in words:
                idx = lower.find(w)
                if idx != -1:
                    entities.append(
                        Entity(
                            text=text[idx : idx + len(w)],
                            type=etype,
                            start=idx,
                            end=idx + len(w),
                        )
                    )

        data = {"entities": [e.dict() for e in entities]}
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/summarize/report",
        response_model=BaseResponse,
        tags=["summary"],
        description="Summarize a medical report into key findings and recommendations.",
    )
    async def summarize_report(
        request: Request,
        body: SummarizeRequest,
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        system_prompt = (
            "You are a medical summarization assistant. "
            "Summarize the report into key findings, impressions, and recommendations."
        )
        prompt = body.report_text
        answer = await call_ollama(
            model=settings.SUMMARY_MODEL,
            prompt=prompt,
            system_prompt=system_prompt,
            request_id=request_id,
        )
        data = {
            "summary": answer,
        }
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/classify/icd",
        response_model=BaseResponse,
        tags=["icd"],
        description="Suggest ICD-10 codes for a clinical description.",
    )
    async def classify_icd(
        request: Request,
        body: ICDClassifyRequest,
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        system_prompt = (
            "You are an assistant that maps clinical descriptions to ICD-10 "
            "codes. Respond with a JSON list of objects containing code, "
            "description, and confidence between 0 and 1."
        )
        answer = await call_ollama(
            model=settings.MEDITRON_MODEL,
            prompt=body.description,
            system_prompt=system_prompt,
            request_id=request_id,
        )
        data = {
            "description": body.description,
            "suggestions_raw": answer,
        }
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/snomed/lookup",
        response_model=BaseResponse,
        tags=["snomed"],
        description="Lookup SNOMED CT concepts for a free-text term (Snowstorm public API, cached in Redis).",
    )
    async def snomed_lookup(
        request: Request,
        term: str,
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        q = (term or "").strip()
        if len(q) < 2:
            error = ErrorDetail(
                code=400,
                message="Query term too short.",
                details=None,
            )
            payload = format_response(
                status="error",
                service="nlp",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=400, content=payload)

        redis_client = await _get_redis(settings)
        cache_key = f"snomed:lookup:{q.lower()}"
        results: List[Dict[str, Any]] = []

        try:
            if redis_client is not None:
                cached = await redis_client.get(cache_key)
                if cached:
                    results = json.loads(cached)
            if not results:
                url = (
                    "https://browser.ihtsdotools.org/snowstorm/snomed-ct/browser/MAIN/concepts"
                    f"?term={httpx.QueryParams({'term': q, 'limit': 5})['term']}&limit=5"
                )
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                items = data.get("items", [])
                for item in items[:5]:
                    cid = item.get("conceptId")
                    preferred = item.get("pt", {}).get("term") or item.get("fsn", {}).get(
                        "term"
                    )
                    if cid and preferred:
                        results.append(
                            {
                                "concept_id": cid,
                                "term": preferred,
                            }
                        )
                if redis_client is not None:
                    try:
                        await redis_client.setex(cache_key, 86400, json.dumps(results))
                    except Exception as exc:
                        logger.warning("SNOMED cache write failed: %s", exc)
        except Exception as exc:
            json_log(
                "manthana-nlp",
                "warning",
                event="snomed_lookup_failed",
                error=str(exc),
                request_id=request_id,
            )

        data = {
            "term": q,
            "concepts": results,
        }
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/models",
        response_model=BaseResponse,
        tags=["core"],
        description="List available Ollama models.",
    )
    async def models(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        try:
            resp = await client.get(f"{settings.OLLAMA_URL.rstrip('/')}/api/tags")
            resp.raise_for_status()
            models = resp.json().get("models", [])
        except Exception as exc:
            error = ErrorDetail(
                code=502,
                message="Failed to fetch models from Ollama.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="nlp",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=502, content=payload)

        data = {"models": models}
        payload = format_response(
            status="success",
            service="nlp",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

