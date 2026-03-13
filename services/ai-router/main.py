import sys
import os
import asyncio
import logging
import time
import datetime
import json
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
from fastapi import (
    Body,
    Depends,
    FastAPI,
    File,
    HTTPException,
    Request,
    Response,
    UploadFile,
)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse, StreamingResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, FileAnalysisRequest
from services.shared.utils import (
    DISCLAIMER,
    DetectedFileType,
    detect_file_type,
    format_response,
    generate_request_id,
    json_log,
)
from plagiarism_service import check_originality
from search_utils import (
    enrich_result,
    deduplicate_results,
    sort_by_trust,
    generate_related_questions,
    fetch_searxng,
    search_own_index_async,
)
try:
    import redis.asyncio as aioredis
    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None  # type: ignore
    _REDIS_AVAILABLE = False

# Global Redis client (set at startup)
_redis_client = None


logger = logging.getLogger("manthana-ai-router")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


def _get_limiter() -> Limiter:
    return Limiter(key_func=get_remote_address, default_limits=["100/minute"])


limiter = _get_limiter()


SERVICE_NAMES = [
    "radiology",
    "ecg",
    "eye",
    "cancer",
    "pathology",
    "brain",
    "segmentation",
    "nlp",
    "drug",
    "ayurveda",
    "imaging",
    "indexer",
]


class CircuitBreaker:
    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 60) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self.failures: Dict[str, int] = {}
        self.open_until: Dict[str, float] = {}

    def can_call(self, service: str) -> bool:
        now = time.time()
        if service in self.open_until and self.open_until[service] > now:
            return False
        if service in self.open_until and self.open_until[service] <= now:
            # auto recover
            self.open_until.pop(service, None)
            self.failures.pop(service, None)
        return True

    def on_success(self, service: str) -> None:
        self.failures.pop(service, None)
        self.open_until.pop(service, None)

    def on_failure(self, service: str) -> None:
        current = self.failures.get(service, 0) + 1
        self.failures[service] = current
        if current >= self.failure_threshold:
            self.open_until[service] = time.time() + self.reset_timeout

    def state(self, service: str) -> str:
        if not self.can_call(service):
            return "open"
        if self.failures.get(service, 0) > 0:
            return "half-open"
        return "closed"


circuit_breaker = CircuitBreaker()


async def generate_embedding(
    text: str,
    settings: "Settings",
) -> list[float]:
    """
    Generate a 768-dim embedding via Ollama nomic-embed-text.
    Falls back to zero vector (with warning) if Ollama is unreachable.
    """
    try:
        async with httpx.AsyncClient(timeout=15.0) as embed_client:
            res = await embed_client.post(
                f"{settings.EMBED_URL.rstrip('/')}/api/embeddings",
                json={"model": "nomic-embed-text", "prompt": text[:2000]},
                headers={"Content-Type": "application/json"},
            )
            res.raise_for_status()
            embedding = res.json().get("embedding", [])
            if embedding:
                return embedding
            json_log("manthana-ai-router", "warning",
                     event="empty_embedding", model="nomic-embed-text")
    except Exception as exc:
        json_log("manthana-ai-router", "warning",
                 event="embedding_fallback",
                 error=str(exc),
                 note="Using zero vector — Qdrant results will be unranked")
    return [0.0] * 768


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana AI Router",
        description="Central routing and orchestration for Manthana medical services.",
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

    # ── Redis startup ─────────────────────────────────────────
    @app.on_event("startup")
    async def _startup_redis() -> None:
        global _redis_client
        if not _REDIS_AVAILABLE or aioredis is None:
            logger.warning("[REDIS] redis.asyncio not installed — running without cache")
            return
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis_client.ping()
            logger.info("[REDIS] Search cache connected")
        except Exception as exc:
            logger.warning(f"[REDIS] Unavailable ({exc}) — search will run without cache")
            _redis_client = None

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        start_time = time.time()
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            duration = time.time() - start_time
            json_log(
                "manthana-ai-router",
                "error",
                event="unhandled_exception",
                path=request.url.path,
                method=request.method,
                request_id=request_id,
                duration_ms=int(duration * 1000),
                error=str(exc),
            )
            raise
        duration = time.time() - start_time
        response.headers["X-Request-ID"] = request_id
        json_log(
            "manthana-ai-router",
            "info",
            event="request",
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            request_id=request_id,
            duration_ms=int(duration * 1000),
        )
        return response

    @app.middleware("http")
    async def enforce_max_upload_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if content_length and int(content_length) > max_bytes:
            request_id = getattr(request.state, "request_id", generate_request_id())
            error = ErrorDetail(
                code=413,
                message="Uploaded file too large.",
                details={"max_mb": settings.MAX_UPLOAD_MB},
            )
            payload = format_response(
                status="error",
                service="ai-router",
                data=None,
                error=error.dict(),
                request_id=request_id,
            )
            return JSONResponse(status_code=413, content=payload)
        return await call_next(request)

    @app.exception_handler(RateLimitExceeded)
    async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
        request_id = getattr(request.state, "request_id", generate_request_id())
        error = ErrorDetail(
            code=429,
            message="Rate limit exceeded.",
            details={"detail": str(exc.detail)},
        )
        payload = format_response(
            status="error",
            service="ai-router",
            data=None,
            error=error.dict(),
            request_id=request_id,
        )
        return JSONResponse(status_code=429, content=payload)

    client = httpx.AsyncClient(timeout=20.0)

    async def call_service_health(name: str, url: str, request_id: str) -> str:
        if not circuit_breaker.can_call(name):
            return "degraded"
        try:
            resp = await client.get(f"{url.rstrip('/')}/health")
            if resp.status_code == 200:
                circuit_breaker.on_success(name)
                return "online"
            circuit_breaker.on_failure(name)
            return "offline"
        except Exception as exc:
            circuit_breaker.on_failure(name)
            json_log(
                "manthana-ai-router",
                "warning",
                event="health_check_failed",
                service=name,
                error=str(exc),
                request_id=request_id,
            )
            return "offline"

    def service_urls(settings: Settings) -> Dict[str, str]:
        return {
            "radiology": settings.RADIOLOGY_URL,
            "ecg": settings.ECG_URL,
            "eye": settings.EYE_URL,
            "cancer": settings.CANCER_URL,
            "pathology": settings.PATHOLOGY_URL,
            "brain": settings.BRAIN_URL,
            "segmentation": settings.SEGMENTATION_URL,
            "nlp": settings.NLP_URL,
            "drug": settings.DRUG_URL,
            "ayurveda": settings.AYURVEDA_URL,
            "imaging": settings.IMAGING_URL,
            "indexer": settings.INDEXER_URL,
        }

    @app.get(
        "/health",
        response_model=BaseResponse,
        tags=["core"],
        description="Check health of AI router and all downstream services.",
    )
    @limiter.limit("100/minute")
    async def health(request: Request, settings: Settings = Depends(get_settings)):
        request_id = getattr(request.state, "request_id", generate_request_id())
        urls = service_urls(settings)
        tasks = [
            call_service_health(name, url, request_id)
            for name, url in urls.items()
        ]
        results = await asyncio.gather(*tasks)
        services_status: Dict[str, str] = {
            name: status for name, status in zip(urls.keys(), results)
        }
        healthy = sum(1 for s in services_status.values() if s == "online")
        data = {
            "router": "online",
            "services": services_status,
            "healthy_count": healthy,
            "total_count": len(services_status),
        }
        payload = format_response(
            status="success",
            service="ai-router",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    def detect_route_for_file(
        filename: Optional[str],
        content_type: Optional[str],
        type_hint: Optional[str],
    ) -> str:
        if type_hint:
            hint = type_hint.lower()
            if "radiology" in hint or "xray" in hint or "chest" in hint:
                return "radiology"
            if "ecg" in hint or "ekg" in hint:
                return "ecg"
            if any(k in hint for k in ("fundus", "retina", "eye")):
                return "eye"
            if any(k in hint for k in ("skin", "derm", "lesion")):
                return "cancer"
            if any(k in hint for k in ("mri", "fmri", "brain")):
                return "brain"
            if "eeg" in hint:
                return "brain"

        detected = detect_file_type(filename, content_type)
        if detected in (DetectedFileType.DICOM, DetectedFileType.XRAY):
            return "radiology"
        if detected in (DetectedFileType.ECG_CSV, DetectedFileType.ECG_IMAGE):
            return "ecg"
        if detected == DetectedFileType.FUNDUS:
            return "eye"
        if detected in (DetectedFileType.SKIN, DetectedFileType.ORAL):
            return "cancer"
        if detected == DetectedFileType.MRI:
            return "brain"
        if detected == DetectedFileType.EEG:
            return "brain"
        return "radiology"

    async def forward_file_request(
        request: Request,
        target_service: str,
        endpoint: str,
        file: UploadFile,
        meta: FileAnalysisRequest,
        settings: Settings,
    ) -> JSONResponse:
        urls = service_urls(settings)
        base_url = urls[target_service]
        if not circuit_breaker.can_call(target_service):
            raise HTTPException(
                status_code=503,
                detail=f"{target_service} service temporarily unavailable",
            )

        form_data = httpx.MultipartWriter()
        async with form_data:
            file_content = await file.read()
            part = form_data.add_part(
                file_content,
                headers={
                    "Content-Disposition": f'form-data; name="file"; filename="{file.filename}"',
                    "Content-Type": file.content_type or "application/octet-stream",
                },
            )
            _ = part
            form_data.add_part(
                meta.json(),
                headers={
                    "Content-Disposition": 'form-data; name="meta"',
                    "Content-Type": "application/json",
                },
            )

        try:
            resp = await client.post(
                f"{base_url.rstrip('/')}{endpoint}",
                headers={"X-Request-ID": getattr(request.state, "request_id", "")},
                content=form_data,
            )
            circuit_breaker.on_success(target_service)
        except Exception as exc:
            circuit_breaker.on_failure(target_service)
            raise HTTPException(
                status_code=502,
                detail=f"Failed to reach {target_service}: {exc}",
            ) from exc

        return JSONResponse(
            status_code=resp.status_code,
            content=resp.json(),
        )

    @app.post(
        "/analyze/auto",
        response_model=BaseResponse,
        tags=["routing"],
        description=(
            "Automatically route uploaded medical data to the appropriate "
            "downstream analysis service."
        ),
    )
    @limiter.limit("100/minute")
    async def analyze_auto(
        request: Request,
        file: UploadFile = File(...),
        type_hint: Optional[str] = Body(default=None),
        patient_id: Optional[str] = Body(default=None),
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        route = detect_route_for_file(file.filename, file.content_type, type_hint)
        meta = FileAnalysisRequest(type_hint=type_hint, patient_id=patient_id)
        downstream_endpoint = "/analyze/xray"
        if route == "radiology" and file.filename and file.filename.lower().endswith(
            ".dcm"
        ):
            downstream_endpoint = "/analyze/dicom"
        if route == "ecg":
            downstream_endpoint = "/analyze/ecg"
        if route == "eye":
            downstream_endpoint = "/analyze/fundus"
        if route == "cancer":
            downstream_endpoint = "/analyze/skin"
        if route == "brain":
            if file.filename and file.filename.lower().endswith((".nii", ".nii.gz")):
                downstream_endpoint = "/analyze/mri"
            else:
                downstream_endpoint = "/analyze/eeg"

        urls = service_urls(settings)
        base_url = urls[route]
        if not circuit_breaker.can_call(route):
            error = ErrorDetail(
                code=503,
                message=f"{route} service temporarily unavailable",
                details={"service": route},
            )
            payload = format_response(
                status="error",
                service="ai-router",
                data=None,
                error=error.dict(),
                request_id=request_id,
            )
            raise HTTPException(status_code=503, detail=payload["error"]["message"])

        # Simple forward using standard form-data
        form = httpx.MultipartWriter()
        async with form:
            content = await file.read()
            form.add_part(
                content,
                headers={
                    "Content-Disposition": f'form-data; name="file"; filename="{file.filename}"',
                    "Content-Type": file.content_type or "application/octet-stream",
                },
            )
            form.add_part(
                meta.json(),
                headers={
                    "Content-Disposition": 'form-data; name="meta"',
                    "Content-Type": "application/json",
                },
            )
        try:
            resp = await client.post(
                f"{base_url.rstrip('/')}{downstream_endpoint}",
                content=form,
                headers={
                    "X-Request-ID": request_id,
                },
            )
            circuit_breaker.on_success(route)
        except Exception as exc:
            circuit_breaker.on_failure(route)
            error = ErrorDetail(
                code=502,
                message=f"Failed to call {route} service.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="ai-router",
                data=None,
                error=error.dict(),
                request_id=request_id,
            )
            return JSONResponse(status_code=502, content=payload)

        data = {
            "service_used": route,
            "endpoint": downstream_endpoint,
            "downstream_status": resp.status_code,
            "result": resp.json(),
        }
        payload = format_response(
            status="success",
            service="ai-router",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(status_code=200, content=payload)

    async def query_meilisearch(
        query: str, settings: Settings, request_id: str
    ) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        try:
            meili_resp = await client.post(
                f"{settings.MEILISEARCH_URL.rstrip('/')}/indexes/medical_search/search",
                json={"q": query, "limit": 5},
                headers={
                    "X-Meili-API-Key": settings.MEILISEARCH_KEY,
                    "Content-Type": "application/json",
                },
            )
            if meili_resp.status_code == 200:
                body = meili_resp.json()
                docs = body.get("hits", [])
        except Exception as exc:
            json_log(
                "manthana-ai-router",
                "warning",
                event="meilisearch_error",
                error=str(exc),
                request_id=request_id,
            )
        return docs

    async def query_qdrant(
        query: str, settings: Settings, request_id: str
    ) -> List[Dict[str, Any]]:
        docs: List[Dict[str, Any]] = []
        try:
            embedding = await generate_embedding(query, settings)
            qdrant_resp = await client.post(
                f"{settings.QDRANT_URL.rstrip('/')}/collections/medical_documents/points/search",
                json={
                    "vector": embedding,
                    "limit": 5,
                    "with_payload": True,
                },
                headers={"Content-Type": "application/json"},
            )
            if qdrant_resp.status_code == 200:
                body = qdrant_resp.json()
                docs = [p.get("payload", {}) for p in body.get("result", [])]
        except Exception as exc:
            json_log(
                "manthana-ai-router",
                "warning",
                event="qdrant_error",
                error=str(exc),
                request_id=request_id,
            )
        return docs

    async def query_perplexica(query: str, settings: Settings) -> List[Dict[str, Any]]:
        """Query Perplexica internal search engine"""
        try:
            async with httpx.AsyncClient(timeout=15.0) as local_client:
                response = await local_client.post(
                    f"{settings.PERPLEXICA_URL}/api/search",
                    json={
                        "query": query,
                        "focusMode": "webSearch",
                        "optimizationMode": "speed",
                    },
                )
                data = response.json()
                return data.get("sources", [])
        except Exception:
            return []  # graceful fallback if perplexica down

    def merge_and_deduplicate(
        lists: List[List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        seen: set[str] = set()
        merged: List[Dict[str, Any]] = []
        for source_list in lists:
            for item in source_list:
                key = str(item.get("id") or item.get("url") or item.get("title") or id(item))
                if key in seen:
                    continue
                seen.add(key)
                merged.append(item)
        return merged

    async def call_ollama_chat(
        settings: Settings, prompt: str, system_prompt: Optional[str], request_id: str
    ) -> str:
        messages: List[Dict[str, str]] = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        try:
            resp = await client.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/chat",
                json={
                    "model": settings.MEDITRON_MODEL,
                    "messages": messages,
                    "stream": False,
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception as exc:
            json_log(
                "manthana-ai-router",
                "error",
                event="ollama_error",
                error=str(exc),
                request_id=request_id,
            )
            raise HTTPException(
                status_code=502,
                detail="Failed to call language model backend.",
            ) from exc

    @app.post(
        "/query",
        response_model=BaseResponse,
        tags=["nlp"],
        description="RAG-style query that enriches with Meilisearch and Qdrant before delegating to NLP service.",
    )
    @limiter.limit("100/minute")
    async def query(
        request: Request,
        body: Dict[str, Any] = Body(...),
        settings: Settings = Depends(get_settings),
    ):
        """
        Backwards-compatible simple query endpoint used by existing clients.
        Returns a plain {question, answer, sources} payload in BaseResponse.data.
        """
        request_id = getattr(request.state, "request_id", generate_request_id())
        question = body.get("query") or body.get("question")
        if not question:
            raise HTTPException(status_code=400, detail="Missing query text.")

        results_meilisearch, results_qdrant, results_perplexica = await asyncio.gather(
            query_meilisearch(question, settings, request_id),
            query_qdrant(question, settings, request_id),
            query_perplexica(question, settings),
        )
        all_results = merge_and_deduplicate(
            [results_meilisearch, results_qdrant, results_perplexica]
        )[:8]
        context_snippets: List[str] = []
        for doc in all_results:
            title = doc.get("title", "") or doc.get("name", "")
            snippet = (
                doc.get("content")
                or doc.get("snippet")
                or doc.get("text")
                or ""
            )
            context_snippets.append(f"{title}: {snippet[:400]}")
        context_text = "\n\n".join(context_snippets)

        enriched_prompt = (
            f"Context:\n{context_text}\n\n"
            f"Question:\n{question}\n\n"
            "Answer as a concise, evidence-based medical explanation."
        )

        answer = await call_ollama_chat(
            settings=settings,
            prompt=enriched_prompt,
            system_prompt=(
                "You are a medical AI assistant. "
                "Answer based on evidence-based medicine only. "
                "Always recommend consulting a doctor."
            ),
            request_id=request_id,
        )

        data = {
            "question": question,
            "answer": answer,
            "sources": {
                "meilisearch": results_meilisearch,
                "qdrant": results_qdrant,
                "perplexica": results_perplexica,
                "combined": all_results,
            },
        }
        payload = format_response(
            status="success",
            service="ai-router",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/deep-research",
        response_model=BaseResponse,
        tags=["nlp"],
        description=(
            "Deep research endpoint for the Manthana frontend. "
            "Accepts domains / subdomains / intent / depth and returns a "
            "structured DeepResearchResult payload."
        ),
    )
    @limiter.limit("60/minute")
    async def deep_research(
        request: Request,
        body: Dict[str, Any] = Body(...),
        settings: Settings = Depends(get_settings),
    ):
        start_time = time.time()
        request_id = getattr(request.state, "request_id", generate_request_id())
        question = body.get("query") or body.get("question")
        if not question:
            raise HTTPException(status_code=400, detail="Missing query text.")

        domains: List[str] = body.get("domains") or []
        subdomains: List[str] = body.get("subdomains") or []
        intent: str = body.get("intent") or "clinical"
        depth: str = body.get("depth") or "comprehensive"
        sources_filter: List[str] = body.get("sources") or []

        # Reuse existing RAG helpers
        results_meilisearch, results_qdrant, results_perplexica = await asyncio.gather(
            query_meilisearch(question, settings, request_id),
            query_qdrant(question, settings, request_id),
            query_perplexica(question, settings),
        )
        all_results = merge_and_deduplicate(
            [results_meilisearch, results_qdrant, results_perplexica]
        )

        # Build numbered source list to help the LLM reference citations with [n]
        numbered_sources: List[str] = []
        for idx, doc in enumerate(all_results[:12], start=1):
            title = doc.get("title", "") or doc.get("name", "") or "Untitled"
            source = doc.get("source") or doc.get("domain") or ""
            url = doc.get("url") or ""
            year = doc.get("year") or ""
            numbered_sources.append(
                f"{idx}. {title} ({source}, {year}) {url}".strip()
            )
        sources_block = "\n".join(numbered_sources)

        # Build context text (similar to /query but slightly longer snippets)
        context_snippets: List[str] = []
        for doc in all_results[:8]:
            title = doc.get("title", "") or doc.get("name", "")
            snippet = (
                doc.get("content")
                or doc.get("snippet")
                or doc.get("text")
                or ""
            )
            context_snippets.append(f"{title}: {snippet[:800]}")
        context_text = "\n\n".join(context_snippets)

        enriched_prompt = (
            "You are a medical AI research assistant. "
            "You will receive:\n"
            "- A clinical or research question\n"
            "- Retrieved source snippets\n"
            "- A numbered list of sources to cite\n\n"
            f"Question:\n{question}\n\n"
            f"Selected domains: {', '.join(domains) or 'none'}\n"
            f"Subdomains: {', '.join(subdomains) or 'none'}\n"
            f"Intent: {intent}\n"
            f"Depth: {depth}\n\n"
            "Context (snippets from search):\n"
            f"{context_text}\n\n"
            "Sources for citation indices [n]:\n"
            f"{sources_block}\n\n"
            "Based on this, produce a JSON object with the following structure ONLY (no extra text):\n"
            "{\n"
            '  "sections": [\n'
            '    { "id": "summary", "title": "Research Summary", "content": "..." },\n'
            '    { "id": "findings", "title": "Key Findings", "content": "..." },\n'
            '    { "id": "clinical", "title": "Clinical Evidence", "content": "..." },\n"
            '    { "id": "traditional", "title": "Traditional Correlation", "content": "..." },\n'
            '    { "id": "integrative", "title": "Integrative Synthesis", "content": "..." },\n'
            '    { "id": "gaps", "title": "Research Gaps", "content": "..." }\n'
            "  ]\n"
            "}\n\n"
            "Rules:\n"
            "- Use markdown inside each content string where helpful.\n"
            "- Use numeric citation markers like [1], [2] that correspond to the numbered sources above.\n"
            "- If a section is not applicable, still include it with a brief explanation.\n"
            "- Respond with VALID JSON only."
        )

        answer = await call_ollama_chat(
            settings=settings,
            prompt=enriched_prompt,
            system_prompt=(
                "You are a medical AI research assistant. "
                "Return ONLY valid JSON as specified, no commentary."
            ),
            request_id=request_id,
        )

        sections: List[Dict[str, Any]]
        try:
            parsed = json.loads(answer)
            raw_sections = parsed.get("sections") or []
            # Normalise to expected shape
            sections = []
            for s in raw_sections:
                title = s.get("title") or ""
                content = s.get("content") or ""
                if not content:
                    continue
                sections.append(
                    {
                        "id": s.get("id") or title.lower().replace(" ", "-") or "section",
                        "title": title or "Section",
                        "content": content,
                    }
                )
            if not sections:
                raise ValueError("No sections in parsed JSON")
        except Exception:
            # Fallback: single summary section with raw answer
            sections = [
                {
                    "id": "summary",
                    "title": "Research Summary",
                    "content": answer,
                }
            ]

        # Build simple citation objects from retrieved results
        citations: List[Dict[str, Any]] = []
        for idx, doc in enumerate(all_results[:20], start=1):
            title = doc.get("title") or doc.get("name") or "Untitled"
            journal = doc.get("journal") or doc.get("source") or ""
            year = doc.get("year") or None
            url = doc.get("url") or ""
            doi = doc.get("doi") or ""
            pmid = doc.get("pmid") or ""
            citations.append(
                {
                    "id": idx,
                    "authors": doc.get("authors") or "",
                    "title": title,
                    "journal": journal,
                    "year": year or 0,
                    "doi": doi or None,
                    "pmid": pmid or None,
                    "url": url or None,
                }
            )

        elapsed = time.time() - start_time

        data: Dict[str, Any] = {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": sections,
            "citations": citations,
            "sources_searched": len(all_results),
            "time_taken_seconds": int(elapsed),
            "generated_at": datetime.datetime.utcnow()
            .replace(microsecond=0)
            .isoformat()
            + "Z",
            "integrative_mode": len(domains) >= 2,
        }

        payload = format_response(
            status="success",
            service="ai-router",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    async def ollama_stream(
        settings: Settings,
        messages: List[Dict[str, str]],
        request_id: str,
    ):
        async with httpx.AsyncClient(timeout=None) as stream_client:
            try:
                resp = await stream_client.post(
                    f"{settings.OLLAMA_URL.rstrip('/')}/api/chat",
                    json={
                        "model": settings.MEDITRON_MODEL,
                        "messages": messages,
                        "stream": True,
                    },
                    headers={"Content-Type": "application/json"},
                )
                resp.raise_for_status()
                async for line in resp.aiter_lines():
                    if not line:
                        continue
                    yield f"data: {line}\n\n"
            except Exception as exc:
                json_log(
                    "manthana-ai-router",
                    "error",
                    event="ollama_stream_error",
                    error=str(exc),
                    request_id=request_id,
                )
                yield "data: {\"error\": \"stream_error\"}\n\n"

    @app.post(
        "/chat",
        tags=["chat"],
        description=(
            "Chat endpoint for Perplexica frontend. Performs RAG over "
            "Meilisearch and Qdrant and streams responses from Ollama."
        ),
    )
    @limiter.limit("100/minute")
    async def chat(
        request: Request,
        body: Dict[str, Any] = Body(...),
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        message: str = body.get("message", "")
        history: List[Dict[str, str]] = body.get("history", [])
        if not message:
            raise HTTPException(status_code=400, detail="Missing message.")

        search_results = await rag_search(message, settings, request_id)
        context_snippets: List[str] = []
        for doc in search_results["meilisearch"]:
            context_snippets.append(
                f"[Meili] {doc.get('title', '')}: {doc.get('content', '')[:400]}"
            )
        for doc in search_results["qdrant"]:
            context_snippets.append(
                f"[Qdrant] {doc.get('title', '')}: {doc.get('content', '')[:400]}"
            )
        context_text = "\n\n".join(context_snippets)

        messages: List[Dict[str, str]] = [
            {
                "role": "system",
                "content": (
                    "You are a medical AI assistant. "
                    "Use the provided context when helpful, but always be honest "
                    "about uncertainty. Recommend that users consult a doctor "
                    "for any medical decisions."
                ),
            },
            {
                "role": "system",
                "content": f"Context:\n{context_text}",
            },
        ]
        for h in history:
            role = h.get("role") or "user"
            content = h.get("content") or ""
            messages.append({"role": role, "content": content})
        messages.append({"role": "user", "content": message})

        generator = ollama_stream(settings=settings, messages=messages, request_id=request_id)
        return StreamingResponse(generator, media_type="text/event-stream")

    @app.post(
        "/plagiarism/check",
        tags=["plagiarism"],
        description="Check originality of a clinical or research text using local stack only.",
    )
    @limiter.limit("60/minute")
    async def plagiarism_check_endpoint(request: Request, body: Dict[str, Any] = Body(...)):
        text: str = body.get("text", "") or ""
        scan_id: str = body.get("scanId", "") or ""
        if not text or len(text.split()) < 50:
            return JSONResponse(
                status_code=400,
                content={
                    "error": "Text too short",
                    "detail": "Minimum 50 words required for analysis",
                    "scanId": scan_id or None,
                },
            )

        qdrant_client = getattr(app.state, "qdrant_client", None)
        try:
            result = await check_originality(
                report_text=text,
                qdrant_client=qdrant_client,
                searxng_url="http://searxng:8080",
            )
            return JSONResponse(status_code=200, content=result)
        except Exception as exc:
            request_id = getattr(request.state, "request_id", generate_request_id())
            json_log(
                "manthana-ai-router",
                "error",
                event="plagiarism_check_failed",
                error=str(exc),
                request_id=request_id,
            )
            return JSONResponse(
                status_code=500,
                content={
                    "error": "Originality check failed",
                    "detail": "Internal error while running plagiarism engine",
                    "scanId": scan_id or None,
                },
            )

    @app.get(
        "/plagiarism/health",
        tags=["plagiarism"],
        description="Health check for Manthana originality engine.",
    )
    async def plagiarism_health():
        return {
            "status": "ok",
            "layers": ["sentence-transformers", "searxng", "qdrant"],
            "cost": "₹0",
        }

    @app.get(
        "/services",
        response_model=BaseResponse,
        tags=["core"],
        description="List all downstream services and capabilities.",
    )
    @limiter.limit("100/minute")
    async def list_services(
        request: Request, settings: Settings = Depends(get_settings)
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        urls = service_urls(settings)
        capabilities = {
            "radiology": {
                "port": 8101,
                "url": urls["radiology"],
                "capabilities": ["xray", "dicom", "chest-conditions"],
            },
            "ecg": {
                "port": 8102,
                "url": urls["ecg"],
                "capabilities": ["ecg-signal", "ecg-image"],
            },
            "eye": {
                "port": 8103,
                "url": urls["eye"],
                "capabilities": ["fundus", "oct"],
            },
            "cancer": {
                "port": 8104,
                "url": urls["cancer"],
                "capabilities": ["oral", "skin", "pathology"],
            },
            "pathology": {
                "port": 8105,
                "url": urls["pathology"],
                "capabilities": ["wsi", "tile-analysis"],
            },
            "brain": {
                "port": 8106,
                "url": urls["brain"],
                "capabilities": ["mri", "eeg", "connectivity"],
            },
            "segmentation": {
                "port": 8107,
                "url": urls["segmentation"],
                "capabilities": ["auto", "interactive", "organ"],
            },
            "nlp": {
                "port": 8108,
                "url": urls["nlp"],
                "capabilities": ["qa", "ner", "summary", "icd"],
            },
            "drug": {
                "port": 8109,
                "url": urls["drug"],
                "capabilities": ["smiles", "search", "interaction", "similarity"],
            },
            "ayurveda": {
                "port": 8110,
                "url": urls["ayurveda"],
                "capabilities": ["prakriti", "vikriti", "herb", "formulation"],
            },
            "imaging": {
                "port": 8111,
                "url": urls["imaging"],
                "capabilities": ["dicom", "nifti", "metadata", "preprocess"],
            },
            "indexer": {
                "port": 8112,
                "url": urls["indexer"],
                "capabilities": ["index-document", "index-batch", "stats"],
            },
        }
        payload = format_response(
            status="success",
            service="ai-router",
            data={"services": capabilities},
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    metrics_store: Dict[str, int] = {
        "requests_total": 0,
        "errors_total": 0,
        "rate_limited_total": 0,
    }

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        metrics_store["requests_total"] += 1
        try:
            response = await call_next(request)
            if response.status_code >= 400:
                metrics_store["errors_total"] += 1
            return response
        except Exception:
            metrics_store["errors_total"] += 1
            raise

    @app.get(
        "/metrics",
        response_class=PlainTextResponse,
        tags=["monitoring"],
        description="Prometheus-compatible metrics for the AI router.",
    )
    async def metrics():
        lines = []
        lines.append("# HELP manthana_requests_total Total HTTP requests.")
        lines.append("# TYPE manthana_requests_total counter")
        lines.append(f"manthana_requests_total {metrics_store['requests_total']}")
        lines.append("# HELP manthana_errors_total Total HTTP errors.")
        lines.append("# TYPE manthana_errors_total counter")
        lines.append(f"manthana_errors_total {metrics_store['errors_total']}")
        lines.append("# HELP manthana_rate_limited_total Total rate limited requests.")
        lines.append("# TYPE manthana_rate_limited_total counter")
        lines.append(
            f"manthana_rate_limited_total {metrics_store['rate_limited_total']}"
        )
        return PlainTextResponse("\n".join(lines))

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Router service information.",
    )
    async def info(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        data = {
            "service": "ai-router",
            "version": "1.0.0",
            "disclaimer": DISCLAIMER,
        }
        payload = format_response(
            status="success",
            service="ai-router",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    # ══════════════════════════════════════════════════════════════════
    # MANTHANA WEB — /search route
    # Pure rich results. No AI synthesis. No LLM. Free at any scale.
    # ══════════════════════════════════════════════════════════════════

    from fastapi import Query as FQuery

    @app.get(
        "/search",
        tags=["search"],
        description=(
            "MANTHANA WEB — Medical search engine. "
            "Returns rich results from 32+ engines with trust scoring, "
            "images, videos, and related questions. No AI synthesis."
        ),
    )
    @limiter.limit("200/minute")
    async def medical_search(
        request: Request,
        q: str = FQuery(..., min_length=2, max_length=500,
                        description="Medical search query"),
        category: str = FQuery("medical", description="Medical domain category"),
        page: int = FQuery(1, ge=1, le=10, description="Result page number"),
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        start = time.time()

        # Normalise frontend domain → SearxNG category
        category_map: dict[str, str] = {
            "allopathy": "medical",
            "ayurveda": "ayurveda",
            "homeopathy": "homeopathy",
            "siddha": "siddha",
            "unani": "unani",
            "medical": "medical",
            "science": "science",
            "regulatory": "regulatory",
            "naturopathy": "naturopathy",
        }
        searxng_cat = category_map.get(category.lower(), "medical")
        searxng_url = settings.SEARXNG_URL

        # ── Run all 4 searches in parallel ───────────────────
        results_web, results_images, results_videos, results_local = (
            await asyncio.gather(
                fetch_searxng(q, searxng_cat, "json", page,
                              searxng_url, _redis_client),
                fetch_searxng(q, "images", "json", 1,
                              searxng_url, _redis_client),
                fetch_searxng(q, "videos", "json", 1,
                              searxng_url, _redis_client),
                search_own_index_async(
                    q, category,
                    settings.MEILISEARCH_URL,
                    settings.MEILISEARCH_API_KEY,
                ),
                return_exceptions=True,
            )
        )

        # Safely unwrap any exceptions
        if isinstance(results_web, Exception):
            results_web = {}
        if isinstance(results_images, Exception):
            results_images = {}
        if isinstance(results_videos, Exception):
            results_videos = {}
        if isinstance(results_local, Exception):
            results_local = []

        # ── Enrich + deduplicate + rank web results ───────────
        raw_web: list = results_web.get("results", [])  # type: ignore[union-attr]
        enriched = [enrich_result(r, category) for r in raw_web]
        enriched = deduplicate_results(enriched)
        enriched = sort_by_trust(enriched)

        # ── Process image results ─────────────────────────────
        raw_images: list = results_images.get("results", [])  # type: ignore[union-attr]
        image_results = []
        for r in raw_images[:12]:
            img_url = r.get("img_src") or r.get("url", "")
            if not img_url:
                continue
            if img_url.lower().endswith((".jpg", ".png", ".webp", ".gif", ".jpeg")) \
                    or r.get("img_src"):
                from search_utils import extract_domain as _ext
                image_results.append({
                    "url": img_url,
                    "title": r.get("title", ""),
                    "source": _ext(r.get("url", "")),
                    "sourceUrl": r.get("url", ""),
                    "thumbnail": r.get("thumbnail_src") or img_url,
                })

        # ── Process video results ─────────────────────────────
        raw_videos: list = results_videos.get("results", [])  # type: ignore[union-attr]
        from search_utils import extract_domain as _ext_v
        video_results = [
            {
                "url": r.get("url", ""),
                "title": r.get("title", ""),
                "thumbnail": r.get("thumbnail", ""),
                "source": _ext_v(r.get("url", "")),
                "publishedDate": r.get("publishedDate", ""),
            }
            for r in raw_videos[:6]
            if r.get("url")
        ]

        # ── Related questions (no LLM) ────────────────────────
        related = generate_related_questions(q, enriched[:3])

        # ── Engines used ──────────────────────────────────────
        engines_used = sorted(
            {r.get("engine", "") for r in raw_web if r.get("engine")}
        )[:10]

        elapsed = round(time.time() - start, 2)
        total = results_web.get("number_of_results", len(enriched))  # type: ignore[union-attr]

        response_data = {
            "query": q,
            "category": category,
            "total": total,
            "page": page,
            "results": enriched,
            "images": image_results,
            "videos": video_results,
            "relatedQuestions": related,
            "enginesUsed": engines_used,
            "localResults": results_local[:3] if isinstance(results_local, list) else [],
            "elapsed": elapsed,
            "synthesis": None,
        }

        payload = format_response(
            status="success",
            service="ai-router",
            data=response_data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/search/autocomplete",
        tags=["search"],
        description="Get search suggestions from SearxNG autocompleter.",
    )
    @limiter.limit("300/minute")
    async def search_autocomplete(
        request: Request,
        q: str = FQuery(..., min_length=2, max_length=200),
        category: str = FQuery("medical"),
        settings: Settings = Depends(get_settings),
    ):
        try:
            async with httpx.AsyncClient(timeout=2.0) as ac:
                res = await ac.get(
                    f"{settings.SEARXNG_URL}/autocompleter",
                    params={"q": q},
                )
                data = res.json()
                # SearxNG autocompleter returns [query, [list_of_suggestions]]
                if isinstance(data, list) and len(data) > 1:
                    suggestions = data[1][:7]
                    return JSONResponse(content={"suggestions": suggestions})
        except Exception as exc:
            json_log("manthana-ai-router", "debug",
                     event="autocomplete_error", error=str(exc))
        return JSONResponse(content={"suggestions": []})

    return app


settings = get_settings()

# Extend settings with downstream URLs for the router
Settings.RADIOLOGY_URL = "http://localhost:8101"  # type: ignore[attr-defined]
Settings.ECG_URL = "http://localhost:8102"  # type: ignore[attr-defined]
Settings.EYE_URL = "http://localhost:8103"  # type: ignore[attr-defined]
Settings.CANCER_URL = "http://localhost:8104"  # type: ignore[attr-defined]
Settings.PATHOLOGY_URL = "http://localhost:8105"  # type: ignore[attr-defined]
Settings.BRAIN_URL = "http://localhost:8106"  # type: ignore[attr-defined]
Settings.SEGMENTATION_URL = "http://localhost:8107"  # type: ignore[attr-defined]
Settings.NLP_URL = "http://localhost:8108"  # type: ignore[attr-defined]
Settings.DRUG_URL = "http://localhost:8109"  # type: ignore[attr-defined]
Settings.AYURVEDA_URL = "http://localhost:8110"  # type: ignore[attr-defined]
Settings.IMAGING_URL = "http://localhost:8111"  # type: ignore[attr-defined]
Settings.INDEXER_URL = "http://localhost:8112"  # type: ignore[attr-defined]

app = create_app(settings)

