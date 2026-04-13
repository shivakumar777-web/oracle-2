"""
Manthana AI Router — main.py
=============================
Central routing and orchestration gateway for the Manthana medical
intelligence platform.

Products served:
  • Manthana Web   → GET  /search
  • Oracle Q&A     → POST /query
  • Deep Research   → POST /deep-research
  • Chat (stream)   → POST /chat
  • Clinical Tools  → POST /analyze/auto
  • Plagiarism      → POST /plagiarism/check

Downstream backends:
  SearXNG · Meilisearch · Qdrant · Perplexica · Ollama · Redis
  11 clinical micro-services (ecg … indexer; radiology ML service removed)
"""

import asyncio
import datetime
import hashlib
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional, Set

# ── Path bootstrapping (for shared module access) ─────────────────────
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
AI_ROUTER_DIR = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
if AI_ROUTER_DIR not in sys.path:
    sys.path.insert(0, AI_ROUTER_DIR)
AI_TOOLS = os.path.join(PROJECT_ROOT, "ai-tools")
if AI_TOOLS not in sys.path:
    sys.path.insert(0, AI_TOOLS)

import httpx
from fastapi import (
    APIRouter,
    Body,
    Depends,
    FastAPI,
    File,
    Form,
    HTTPException,
    Query as FQuery,
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
from services.shared.models import (
    BaseResponse,
    ChatRequest,
    ClinicalTrialsSearchRequest,
    DeepResearchRequest,
    DrugInteractionRequest,
    ErrorDetail,
    FileAnalysisRequest,
    HerbDrugRequest,
    InteractionCheckEnrichedRequest,
    OracleQueryRequest,
    PlagiarismCheckRequest,
    ReportEnrichRequest,
    ReportPdfRequest,
)
from services.shared.utils import (
    DISCLAIMER,
    DetectedFileType,
    detect_file_type,
    format_response,
    generate_request_id,
    json_log,
    validate_file_content,
)
from auth import get_current_user_optional, get_protected_user
from services.shared.search_utils import (
    deduplicate_results,
    enrich_result,
    extract_domain,
    fetch_searxng,
    generate_related_questions,
    search_own_index_async,
    sort_by_trust,
)

from services.shared.medical_ontology import enrich_findings_with_ontology, icd10_lookup, infer_rads_system, lookup_icd_radlex
from services.shared.audit import write_audit_log, query_audit_log
from clinical_trials import fetch_clinical_trials_gov
from herb_drug import analyze_herb_drug
from query_intelligence import classify_query, expand_query, QueryType
from source_router import route_sources, SourceStrategy
from reranker import rerank_by_relevance
from pubmed_client import search_pubmed
from domain_intelligence import (
    MedicalDomain,
    detect_domain_in_query,
    expand_query_for_domain,
    get_domain_system_prompt,
    get_domain_trust_boost,
    should_prioritize_domain_sources,
    is_integrative_query,
)
from m5_engine import (
    build_m5_response_from_parts,
    stream_m5_response,
    DomainAnswer,
    M5Response,
    DOMAIN_INFO,
    get_domain_badge_color,
)

# ── Optional Redis import ─────────────────────────────────────────────
try:
    import redis.asyncio as aioredis

    _REDIS_AVAILABLE = True
except ImportError:
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("manthana.ai-router")

# ── Constants ─────────────────────────────────────────────────────────
_EMBEDDING_DIM = 768
_EMBEDDING_MODEL = "nomic-embed-text"
_EMBED_MAX_CHARS = 2_000
_RAG_RESULT_LIMIT = 8
_DEEP_RESEARCH_SOURCE_LIMIT = 12
_DEEP_RESEARCH_CITATION_LIMIT = 20
_SEARCH_IMAGE_LIMIT = 12
_SEARCH_VIDEO_LIMIT = 6
_AUTOCOMPLETE_LIMIT = 7
_SEARXNG_CACHE_TTL = 300  # seconds

SERVICE_NAMES: List[str] = [
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

# Search categories (matches api.py for frontend compatibility)
CATEGORIES: List[Dict[str, str]] = [
    {"id": "medical", "label": "All Medical"},
    {"id": "allopathy", "label": "Allopathy"},
    {"id": "ayurveda", "label": "Ayurveda"},
    {"id": "homeopathy", "label": "Homeopathy"},
    {"id": "siddha", "label": "Siddha"},
    {"id": "unani", "label": "Unani"},
    {"id": "naturopathy", "label": "Naturopathy"},
    {"id": "science", "label": "Research & Science"},
    {"id": "regulatory", "label": "Regulatory (CDSCO/AYUSH)"},
    {"id": "general", "label": "General Web"},
]

# Map frontend domain names → SearXNG categories
CATEGORY_MAP: Dict[str, str] = {
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

# Per-service capability metadata exposed via GET /services
SERVICE_CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "ecg":          {"port": 8102, "capabilities": ["ecg-signal", "ecg-image"]},
    "eye":          {"port": 8103, "capabilities": ["fundus", "oct"]},
    "cancer":       {"port": 8104, "capabilities": ["oral", "skin", "pathology"]},
    "pathology":    {"port": 8105, "capabilities": ["wsi", "tile-analysis"]},
    "brain":        {"port": 8106, "capabilities": ["mri", "eeg", "connectivity"]},
    "segmentation": {"port": 8107, "capabilities": ["auto", "interactive", "organ"]},
    "nlp":          {"port": 8108, "capabilities": ["qa", "ner", "summary", "icd"]},
    "drug":         {"port": 8109, "capabilities": ["smiles", "search", "interaction", "similarity"]},
    "ayurveda":     {"port": 8110, "capabilities": ["prakriti", "vikriti", "herb", "formulation"]},
    "imaging":      {"port": 8111, "capabilities": ["dicom", "nifti", "metadata", "preprocess"]},
    "indexer":      {"port": 8112, "capabilities": ["index-document", "index-batch", "stats"]},
}


# ═══════════════════════════════════════════════════════════════════════
# Circuit Breaker
# ═══════════════════════════════════════════════════════════════════════
class CircuitBreaker:
    """
    Lightweight async-safe circuit breaker.

    States:
      closed    → all calls pass through
      half-open → one probe call allowed; success closes, failure re-opens
      open      → all calls rejected until reset_timeout expires
    """

    __slots__ = ("failure_threshold", "reset_timeout", "_failures", "_open_until", "_lock")

    def __init__(self, failure_threshold: int = 3, reset_timeout: int = 60) -> None:
        self.failure_threshold = failure_threshold
        self.reset_timeout = reset_timeout
        self._failures: Dict[str, int] = {}
        self._open_until: Dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def can_call(self, service: str) -> bool:
        async with self._lock:
            deadline = self._open_until.get(service)
            if deadline is None:
                return True
            if time.monotonic() >= deadline:
                # Transition → half-open (allow one probe)
                self._open_until.pop(service, None)
                self._failures[service] = self.failure_threshold - 1
                return True
            return False

    async def on_success(self, service: str) -> None:
        async with self._lock:
            self._failures.pop(service, None)
            self._open_until.pop(service, None)

    async def on_failure(self, service: str) -> None:
        async with self._lock:
            count = self._failures.get(service, 0) + 1
            self._failures[service] = count
            if count >= self.failure_threshold:
                self._open_until[service] = time.monotonic() + self.reset_timeout
                logger.warning(
                    "Circuit OPEN for %s — will retry after %ds",
                    service,
                    self.reset_timeout,
                )

    async def state(self, service: str) -> str:
        async with self._lock:
            deadline = self._open_until.get(service)
            if deadline is not None and time.monotonic() < deadline:
                return "open"
            if self._failures.get(service, 0) > 0:
                return "half-open"
            return "closed"


# Module-level singletons
_circuit = CircuitBreaker()
_limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


# ═══════════════════════════════════════════════════════════════════════
# Thread-safe Prometheus-style metrics
# ═══════════════════════════════════════════════════════════════════════
class _MetricsStore:
    __slots__ = ("requests_total", "errors_total", "rate_limited_total", "_lock")

    def __init__(self) -> None:
        self.requests_total: int = 0
        self.errors_total: int = 0
        self.rate_limited_total: int = 0
        self._lock = asyncio.Lock()

    async def inc_requests(self) -> None:
        async with self._lock:
            self.requests_total += 1

    async def inc_errors(self) -> None:
        async with self._lock:
            self.errors_total += 1

    async def inc_rate_limited(self) -> None:
        async with self._lock:
            self.rate_limited_total += 1

    def snapshot(self) -> Dict[str, int]:
        return {
            "requests_total": self.requests_total,
            "errors_total": self.errors_total,
            "rate_limited_total": self.rate_limited_total,
        }


_metrics = _MetricsStore()


# ═══════════════════════════════════════════════════════════════════════
# Helper: build service URL map from Settings
# ═══════════════════════════════════════════════════════════════════════
def _service_urls(settings: Settings) -> Dict[str, str]:
    return {
        "ecg":          getattr(settings, "ECG_URL",          "http://ecg:8102"),
        "eye":          getattr(settings, "EYE_URL",          "http://eye:8103"),
        "cancer":       getattr(settings, "CANCER_URL",       "http://cancer:8104"),
        "pathology":    getattr(settings, "PATHOLOGY_URL",    "http://pathology:8105"),
        "brain":        getattr(settings, "BRAIN_URL",        "http://brain:8106"),
        "segmentation": getattr(settings, "SEGMENTATION_URL", "http://segmentation:8107"),
        "nlp":          getattr(settings, "NLP_URL",          "http://nlp:8108"),
        "drug":         getattr(settings, "DRUG_URL",         "http://drug:8109"),
        "ayurveda":     getattr(settings, "AYURVEDA_URL",     "http://ayurveda:8110"),
        "imaging":      getattr(settings, "IMAGING_URL",      "http://imaging-utils:8111"),
        "indexer":      getattr(settings, "INDEXER_URL",      "http://indexer:8112"),
    }


# ═══════════════════════════════════════════════════════════════════════
# Embedding helper
# ═══════════════════════════════════════════════════════════════════════
async def _generate_embedding(
    text: str,
    settings: Settings,
    client: httpx.AsyncClient,
) -> List[float]:
    """Generate a 768-dim embedding via Ollama nomic-embed-text.
    Falls back to a zero vector (with warning) if Ollama is unreachable."""
    try:
        resp = await client.post(
            f"{settings.EMBED_URL.rstrip('/')}/api/embeddings",
            json={"model": _EMBEDDING_MODEL, "prompt": text[:_EMBED_MAX_CHARS]},
            headers={"Content-Type": "application/json"},
            timeout=15.0,
        )
        resp.raise_for_status()
        embedding = resp.json().get("embedding", [])
        if embedding:
            return embedding
        json_log("manthana.ai-router", "warning",
                 event="empty_embedding", model=_EMBEDDING_MODEL)
    except Exception as exc:
        json_log(
            "manthana.ai-router", "warning",
            event="embedding_fallback",
            error=str(exc),
            note="Using zero vector — Qdrant results will be unranked",
        )
    return [0.0] * _EMBEDDING_DIM


# ═══════════════════════════════════════════════════════════════════════
# Clinical file routing
# ═══════════════════════════════════════════════════════════════════════
_HINT_MAP: List[tuple[List[str], str]] = [
    (["radiology", "xray", "chest"],               "radiology"),  # routed but disabled (503)
    (["ecg", "ekg"],                                "ecg"),
    (["fundus", "retina", "eye"],                   "eye"),
    (["skin", "derm", "lesion"],                    "cancer"),
    (["mri", "fmri", "brain"],                      "brain"),
    (["eeg"],                                       "brain"),
]

_FILETYPE_TO_SERVICE: Dict[DetectedFileType, str] = {
    DetectedFileType.DICOM:     "radiology",
    DetectedFileType.XRAY:      "radiology",
    DetectedFileType.ECG_CSV:   "ecg",
    DetectedFileType.ECG_IMAGE: "ecg",
    DetectedFileType.FUNDUS:    "eye",
    DetectedFileType.SKIN:      "cancer",
    DetectedFileType.ORAL:      "cancer",
    DetectedFileType.MRI:       "brain",
    DetectedFileType.EEG:       "brain",
}


def _detect_route_for_file(
    filename: Optional[str],
    content_type: Optional[str],
    type_hint: Optional[str],
) -> str:
    """Determine which clinical micro-service should handle a file."""
    if type_hint:
        hint_lower = type_hint.lower()
        for keywords, service in _HINT_MAP:
            if any(kw in hint_lower for kw in keywords):
                return service

    detected = detect_file_type(filename, content_type)
    return _FILETYPE_TO_SERVICE.get(detected, "unsupported")


def _pick_downstream_endpoint(route: str, filename: Optional[str]) -> str:
    """Choose the specific endpoint path for a routed clinical service."""
    fname = (filename or "").lower()
    if route == "ecg":
        return "/analyze/ecg"
    if route == "eye":
        return "/analyze/fundus"
    if route == "cancer":
        return "/analyze/skin"
    if route == "brain":
        return "/analyze/mri" if fname.endswith((".nii", ".nii.gz")) else "/analyze/eeg"
    return "/analyze"


# ═══════════════════════════════════════════════════════════════════════
# RAG helpers
# ═══════════════════════════════════════════════════════════════════════
async def _query_meilisearch(
    query: str,
    settings: Settings,
    client: httpx.AsyncClient,
    request_id: str,
) -> List[Dict[str, Any]]:
    try:
        meili_key = getattr(settings, "MEILISEARCH_KEY", "") or getattr(settings, "MEILISEARCH_API_KEY", "")
        resp = await client.post(
            f"{settings.MEILISEARCH_URL.rstrip('/')}/indexes/medical_search/search",
            json={"q": query, "limit": 5},
            headers={
                "X-Meili-API-Key": meili_key,
                "Content-Type": "application/json",
            },
        )
        if resp.status_code == 200:
            return resp.json().get("hits", [])
    except Exception as exc:
        json_log("manthana.ai-router", "warning",
                 event="meilisearch_error", error=str(exc), request_id=request_id)
    return []


async def _query_qdrant(
    query: str,
    settings: Settings,
    client: httpx.AsyncClient,
    request_id: str,
) -> List[Dict[str, Any]]:
    try:
        embedding = await _generate_embedding(query, settings, client)
        resp = await client.post(
            f"{settings.QDRANT_URL.rstrip('/')}/collections/medical_documents/points/search",
            json={"vector": embedding, "limit": 5, "with_payload": True},
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            return [p.get("payload", {}) for p in resp.json().get("result", [])]
    except Exception as exc:
        json_log("manthana.ai-router", "warning",
                 event="qdrant_error", error=str(exc), request_id=request_id)
    return []


async def _query_perplexica(
    query: str, settings: Settings
) -> List[Dict[str, Any]]:
    try:
        async with httpx.AsyncClient(timeout=15.0) as pc:
            resp = await pc.post(
                f"{settings.PERPLEXICA_URL}/api/search",
                json={
                    "query": query,
                    "focusMode": "webSearch",
                    "optimizationMode": "speed",
                },
            )
            return resp.json().get("sources", [])
    except Exception:
        return []


_CHAT_SOURCE_TIMEOUT = 8.0  # Phase 4: per-source timeout for resilient fetch


async def _with_timeout(
    coro, default: Any, timeout: float = _CHAT_SOURCE_TIMEOUT, source: str = "",
) -> Any:
    """Phase 4: Run coroutine with timeout; return default on timeout or error."""
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        if source:
            json_log("manthana.ai-router", "warning", event="chat_source_timeout", source=source, timeout=timeout)
        return default
    except Exception as exc:
        if source:
            json_log("manthana.ai-router", "warning", event="chat_source_error", source=source, error=str(exc))
        return default


async def _rag_search(
    query: str,
    settings: Settings,
    client: httpx.AsyncClient,
    request_id: str,
) -> Dict[str, List[Dict[str, Any]]]:
    """Run Meilisearch + Qdrant RAG in parallel (used by /chat)."""
    meili, qdrant = await asyncio.gather(
        _query_meilisearch(query, settings, client, request_id),
        _query_qdrant(query, settings, client, request_id),
    )
    return {"meilisearch": meili, "qdrant": qdrant}


def _merge_and_deduplicate(
    *lists: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    seen: Set[str] = set()
    merged: List[Dict[str, Any]] = []
    for source_list in lists:
        for item in source_list:
            key = str(
                item.get("id")
                or item.get("url")
                or item.get("title")
                or id(item)
            )
            if key not in seen:
                seen.add(key)
                merged.append(item)
    return merged


# ═══════════════════════════════════════════════════════════════════════
# LLM helpers — OpenRouter (SSOT: config/cloud_inference.yaml)
# ═══════════════════════════════════════════════════════════════════════

from manthana_inference import (  # noqa: E402
    build_openrouter_async_client,
    build_openrouter_sync_client,
    chat_complete_async,
    chat_complete_sync,
    resolve_role,
    stream_chat_async,
)
from services.shared.openrouter_helpers import (  # noqa: E402
    get_inference_config,
    openrouter_api_keys,
)


async def _call_groq_chat(
    settings: Settings,
    prompt: str,
    system_prompt: Optional[str],
    request_id: str,
    *,
    role: str = "ai_router_chat",
    max_tokens: Optional[int] = None,
    temperature: Optional[float] = None,
) -> str:
    """Non-streaming chat via OpenRouter."""
    keys = openrouter_api_keys(settings)
    if not keys:
        json_log(
            "manthana.ai-router",
            "error",
            event="openrouter_no_client",
            message="OPENROUTER_API_KEY not set",
            request_id=request_id,
        )
        raise HTTPException(
            status_code=502,
            detail="OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env",
        )
    messages: List[Dict[str, str]] = []
    if system_prompt:
        messages.append({"role": "system", "content": system_prompt})
    messages.append({"role": "user", "content": prompt})
    cfg = get_inference_config()
    rc = resolve_role(cfg, role)
    if max_tokens is not None or temperature is not None:
        rc = rc.model_copy(
            update={
                **({"max_tokens": max_tokens} if max_tokens is not None else {}),
                **({"temperature": temperature} if temperature is not None else {}),
            }
        )
    last_err: Optional[Exception] = None
    for api_key in keys:
        try:

            def _sync_one() -> str:
                client = build_openrouter_sync_client(api_key, cfg)
                text, _m, *_ = chat_complete_sync(client, cfg, role, list(messages), role_cfg=rc)
                return text

            loop = asyncio.get_running_loop()
            return await loop.run_in_executor(None, _sync_one)
        except Exception as exc:
            last_err = exc
            json_log(
                "manthana.ai-router",
                "warning",
                event="openrouter_key_failed",
                error=str(exc),
                request_id=request_id,
            )
    json_log("manthana.ai-router", "error", event="openrouter_error", error=str(last_err), request_id=request_id)
    raise HTTPException(status_code=502, detail="Failed to call OpenRouter language model.") from last_err


async def _groq_stream(
    settings: Settings,
    messages: List[Dict[str, str]],
    request_id: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    strategies: Optional[List[Any]] = None,
    is_emergency: bool = False,
):
    """Yield SSE chunks: progress, sources, tokens, done. Frontend expects data: {message: {content}} for tokens."""
    # Phase 4: Emit emergency flag for frontend disclaimer
    if is_emergency:
        yield 'data: {"type": "emergency", "is_emergency": true}\n\n'
    # Phase 3: Emit progress events
    if strategies:
        for s in strategies:
            stage = getattr(s, "value", str(s)) if s else ""
            yield f'data: {json.dumps({"type": "progress", "stage": stage, "status": "complete"})}\n\n'
    yield f'data: {json.dumps({"type": "progress", "stage": "context_ready", "status": "complete"})}\n\n'

    # Phase 3: Emit sources for citation display
    if sources:
        yield f'data: {json.dumps({"type": "sources", "sources": sources})}\n\n'

    keys = openrouter_api_keys(settings)
    if not keys:
        json_log(
            "manthana.ai-router",
            "error",
            event="openrouter_no_client",
            message="OPENROUTER_API_KEY not set",
            request_id=request_id,
        )
        yield 'data: {"message":{"content":"OpenRouter API key not configured. Set OPENROUTER_API_KEY in .env"}}\n\n'
        yield 'data: {"type": "done"}\n\n'
        return
    cfg = get_inference_config()
    try:
        for api_key in keys:
            try:
                client = build_openrouter_async_client(api_key, cfg)
                async for delta, _model in stream_chat_async(client, cfg, "ai_router_chat", list(messages)):
                    if delta:
                        payload = json.dumps({"message": {"content": delta}, "type": "token"})
                        yield f"data: {payload}\n\n"
                yield 'data: {"type": "done"}\n\n'
                return
            except Exception as inner:
                json_log(
                    "manthana.ai-router",
                    "warning",
                    event="openrouter_stream_key_failed",
                    error=str(inner),
                    request_id=request_id,
                )
        raise RuntimeError("all keys failed")
    except Exception as exc:
        json_log("manthana.ai-router", "error", event="openrouter_stream_error", error=str(exc), request_id=request_id)
        yield 'data: {"error": "stream_error"}\n\n'
        yield 'data: {"type": "done"}\n\n'


# ═══════════════════════════════════════════════════════════════════════
# Deep Research prompt builder
# ═══════════════════════════════════════════════════════════════════════
_DEEP_RESEARCH_PROMPT_TEMPLATE = """\
You are a medical AI research assistant.
You will receive:
- A clinical or research question
- Retrieved source snippets
- A numbered list of sources to cite

Question:
{question}

Selected domains: {domains}
Subdomains: {subdomains}
Intent: {intent}
Depth: {depth}

Context (snippets from search):
{context_text}

Sources for citation indices [n]:
{sources_block}

Based on this, produce a JSON object with the following structure ONLY (no extra text):
{{
  "sections": [
    {{ "id": "summary",      "title": "Research Summary",         "content": "..." }},
    {{ "id": "findings",     "title": "Key Findings",             "content": "..." }},
    {{ "id": "clinical",     "title": "Clinical Evidence",        "content": "..." }},
    {{ "id": "traditional",  "title": "Traditional Correlation",  "content": "..." }},
    {{ "id": "integrative",  "title": "Integrative Synthesis",    "content": "..." }},
    {{ "id": "gaps",         "title": "Research Gaps",            "content": "..." }}
  ]
}}

Rules:
- Use markdown inside each content string where helpful.
- Use numeric citation markers like [1], [2] that correspond to the numbered sources above.
- If a section is not applicable, still include it with a brief explanation.
- Respond with VALID JSON only."""


def _build_deep_research_prompt(
    question: str,
    domains: List[str],
    subdomains: List[str],
    intent: str,
    depth: str,
    context_text: str,
    sources_block: str,
) -> str:
    return _DEEP_RESEARCH_PROMPT_TEMPLATE.format(
        question=question,
        domains=", ".join(domains) or "none",
        subdomains=", ".join(subdomains) or "none",
        intent=intent,
        depth=depth,
        context_text=context_text,
        sources_block=sources_block,
    )


def _parse_deep_research_sections(raw_answer: str) -> List[Dict[str, Any]]:
    """Parse structured sections from the LLM JSON response."""
    try:
        parsed = json.loads(raw_answer)
        raw_sections = parsed.get("sections") or []
        sections: List[Dict[str, Any]] = []
        for s in raw_sections:
            title = s.get("title", "")
            content = s.get("content", "")
            if not content:
                continue
            sections.append({
                "id": s.get("id") or title.lower().replace(" ", "-") or "section",
                "title": title or "Section",
                "content": content,
            })
        if sections:
            return sections
    except (json.JSONDecodeError, AttributeError, TypeError):
        pass
    # Fallback: wrap entire raw answer as a single summary section
    return [{"id": "summary", "title": "Research Summary", "content": raw_answer}]


def _normalize_analyze_response(
    route: str,
    endpoint: str,
    downstream_body: Dict[str, Any],
) -> Dict[str, Any]:
    """Transform downstream clinical service response to frontend AnalysisResponse shape."""
    inner = downstream_body.get("data", downstream_body) if isinstance(downstream_body, dict) else {}
    if not isinstance(inner, dict):
        inner = {}

    pathologies = inner.get("pathologies", [])
    findings: List[Dict[str, Any]] = []
    for p in pathologies if isinstance(pathologies, list) else []:
        if not isinstance(p, dict):
            continue
        label = p.get("name", p.get("label", ""))
        score = float(p.get("score", p.get("confidence", 0)) or 0)
        confidence = int(round(score * 100)) if score <= 1.0 else int(round(score))
        confidence = max(0, min(100, confidence))
        critical = p.get("critical", False)
        severity = "critical" if critical else ("moderate" if confidence >= 70 else "clear")
        findings.append({
            "label": label,
            "confidence": confidence,
            "severity": severity,
            "model_type": p.get("model_type", "ml"),
        })

    modality_map = {
        ("eye", "/analyze/fundus"): "fundus",
        ("cancer", "/analyze/skin"): "skin_lesion",
        ("ecg", "/analyze/ecg"): "ecg",
        ("brain", "/analyze/mri"): "mri",
        ("brain", "/analyze/eeg"): "eeg",
    }
    modality = modality_map.get((route, endpoint), route)

    report_parts = [f"{f.get('label', '')} ({f.get('confidence', 0)}%)" for f in findings]
    report = "; ".join(report_parts) if report_parts else "No significant findings."

    models_used = inner.get("models_used", [])
    if not models_used and inner.get("model_type"):
        models_used = [{"id": route, "name": route.title(), "groupId": modality, "routingMode": "auto"}]

    return {
        "service_used": route,
        "modality": modality,
        "findings": findings,
        "report": report,
        "models_used": models_used,
        "supports_heatmap": inner.get("supports_heatmap", False),
        "validated": inner.get("validated", True),
        "disclaimer": DISCLAIMER,
    }


def _build_citations(docs: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    citations: List[Dict[str, Any]] = []
    for idx, doc in enumerate(docs[:limit], start=1):
        citations.append({
            "id": idx,
            "authors": doc.get("authors", ""),
            "title": doc.get("title") or doc.get("name") or "Untitled",
            "journal": doc.get("journal") or doc.get("source") or "",
            "year": doc.get("year") or 0,
            "doi": doc.get("doi") or None,
            "pmid": doc.get("pmid") or None,
            "url": doc.get("url") or None,
        })
    return citations


# ═══════════════════════════════════════════════════════════════════════
# App factory
# ═══════════════════════════════════════════════════════════════════════
def create_app(settings: Settings) -> FastAPI:
    """Build and return the fully configured FastAPI application."""

    # ── Shared httpx client + Redis (managed via lifespan) ────────────
    _state: Dict[str, Any] = {}

    @asynccontextmanager
    async def lifespan(application: FastAPI):
        # --- Startup ---
        application.state.client = httpx.AsyncClient(
            timeout=httpx.Timeout(20.0, connect=5.0),
            limits=httpx.Limits(max_connections=200, max_keepalive_connections=40),
        )
        application.state.redis = None
        _state["client"] = application.state.client
        _state["redis"] = None

        if _REDIS_AVAILABLE and aioredis is not None:
            try:
                rc = aioredis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True,
                )
                await rc.ping()
                application.state.redis = rc
                _state["redis"] = rc
                logger.info("[REDIS] Search cache connected (%s)", settings.REDIS_URL)
            except Exception as exc:
                logger.warning("[REDIS] Unavailable (%s) — running without cache", exc)
        else:
            logger.warning("[REDIS] redis.asyncio not installed — running without cache")

        or_keys = openrouter_api_keys(settings)
        if or_keys:
            logger.info("[OpenRouter] API key configured (Oracle chat ready)")
        else:
            logger.warning("[OpenRouter] OPENROUTER_API_KEY not set — Oracle chat will fail.")

        yield

        # --- Shutdown ---
        if getattr(application.state, "client", None):
            await application.state.client.aclose()
        if getattr(application.state, "redis", None):
            try:
                await application.state.redis.close()
            except Exception:
                pass

    app = FastAPI(
        title="Manthana AI Router",
        description=(
            "Central routing and orchestration gateway for Manthana "
            "medical intelligence services."
        ),
        version="2.0.0",
        lifespan=lifespan,
    )

    # ── CORS ──────────────────────────────────────────────────────────
    _allowed_origins = list(filter(None, [
        os.getenv("FRONTEND_URL", "http://localhost:3001"),
        "http://localhost:3000",
        "http://localhost:3001",
    ]))
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_allowed_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # ── Rate limiter ──────────────────────────────────────────────────
    app.state.limiter = _limiter
    app.add_middleware(SlowAPIMiddleware)

    # ── Accessor helpers ──────────────────────────────────────────────
    def _client() -> httpx.AsyncClient:
        return _state["client"]

    def _redis():
        return _state.get("redis")

    # ──────────────────────────────────────────────────────────────────
    # Middleware
    # ──────────────────────────────────────────────────────────────────

    @app.middleware("http")
    async def request_id_middleware(request: Request, call_next):
        """Attach a unique request ID and log request lifecycle."""
        request_id = generate_request_id()
        request.state.request_id = request_id
        t0 = time.monotonic()
        try:
            response: Response = await call_next(request)
        except Exception as exc:
            elapsed = int((time.monotonic() - t0) * 1000)
            json_log(
                "manthana.ai-router", "error",
                event="unhandled_exception",
                path=request.url.path,
                method=request.method,
                request_id=request_id,
                duration_ms=elapsed,
                error=str(exc),
            )
            raise
        elapsed = int((time.monotonic() - t0) * 1000)
        response.headers["X-Request-ID"] = request_id
        json_log(
            "manthana.ai-router", "info",
            event="request",
            path=request.url.path,
            method=request.method,
            status_code=response.status_code,
            request_id=request_id,
            duration_ms=elapsed,
        )
        return response

    @app.middleware("http")
    async def upload_size_guard(request: Request, call_next):
        """Reject uploads exceeding MAX_UPLOAD_MB early."""
        content_length = request.headers.get("content-length")
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if content_length and int(content_length) > max_bytes:
            rid = getattr(request.state, "request_id", generate_request_id())
            err = ErrorDetail(
                code=413,
                message="Uploaded file too large.",
                details={"max_mb": settings.MAX_UPLOAD_MB},
            )
            return JSONResponse(
                status_code=413,
                content=format_response("error", "ai-router", None, err.dict(), rid),
            )
        return await call_next(request)

    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        await _metrics.inc_requests()
        try:
            response = await call_next(request)
            if response.status_code >= 400:
                await _metrics.inc_errors()
            return response
        except Exception:
            await _metrics.inc_errors()
            raise

    # ── Rate limit handler ────────────────────────────────────────────
    @app.exception_handler(RateLimitExceeded)
    async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
        await _metrics.inc_rate_limited()
        rid = getattr(request.state, "request_id", generate_request_id())
        err = ErrorDetail(
            code=429,
            message="Rate limit exceeded.",
            details={"detail": str(exc.detail)},
        )
        return JSONResponse(
            status_code=429,
            content=format_response("error", "ai-router", None, err.dict(), rid),
        )

    # ──────────────────────────────────────────────────────────────────
    # Internal helpers (closure-scoped — access _client / _redis)
    # ──────────────────────────────────────────────────────────────────

    async def _health_probe(name: str, url: str, request_id: str) -> str:
        if not await _circuit.can_call(name):
            return "degraded"
        try:
            resp = await _client().get(f"{url.rstrip('/')}/health", timeout=5.0)
            if resp.status_code == 200:
                await _circuit.on_success(name)
                return "online"
            await _circuit.on_failure(name)
            return "offline"
        except Exception as exc:
            await _circuit.on_failure(name)
            json_log("manthana.ai-router", "warning",
                     event="health_check_failed", service=name,
                     error=str(exc), request_id=request_id)
            return "offline"

    async def _forward_to_clinical_service(
        route: str,
        endpoint: str,
        file_content: bytes,
        filename: str,
        content_type: str,
        meta: FileAnalysisRequest,
        request_id: str,
        settings: Settings,
    ) -> JSONResponse:
        """Forward an uploaded file to a clinical micro-service using
        proper multipart/form-data (not httpx.MultipartWriter)."""
        urls = _service_urls(settings)
        base_url = urls[route]

        if not await _circuit.can_call(route):
            err = ErrorDetail(
                code=503,
                message=f"{route} service temporarily unavailable",
                details={"service": route},
            )
            return JSONResponse(
                status_code=503,
                content=format_response("error", "ai-router", None, err.dict(), request_id),
            )

        try:
            resp = await _client().post(
                f"{base_url.rstrip('/')}{endpoint}",
                files={"file": (filename, file_content, content_type)},
                data={"meta": meta.json()},
                headers={"X-Request-ID": request_id},
                timeout=60.0,
            )
            await _circuit.on_success(route)
        except Exception as exc:
            await _circuit.on_failure(route)
            err = ErrorDetail(
                code=502,
                message=f"Failed to call {route} service.",
                details={"error": str(exc)},
            )
            return JSONResponse(
                status_code=502,
                content=format_response("error", "ai-router", None, err.dict(), request_id),
            )

        try:
            downstream_body = resp.json()
        except Exception:
            downstream_body = {"raw": resp.text}

        if resp.status_code == 200 and isinstance(downstream_body, dict):
            data = _normalize_analyze_response(route, endpoint, downstream_body)
            # Audit trail: which model produced which finding
            try:
                models_used = data.get("models_used", [])
                model_id = models_used[0].get("id", route) if models_used else route
                write_audit_log(
                    request_id=request_id,
                    service=route,
                    endpoint=endpoint,
                    model_id=model_id,
                    patient_id=meta.patient_id if meta else None,
                    findings=data.get("findings"),
                    findings_count=len(data.get("findings", [])),
                )
            except Exception as audit_exc:
                json_log("manthana.ai-router", "warning",
                         event="audit_log_failed", error=str(audit_exc), request_id=request_id)
        else:
            data = {
                "service_used": route,
                "endpoint": endpoint,
                "downstream_status": resp.status_code,
                "result": downstream_body,
            }
        return JSONResponse(
            status_code=200,
            content=format_response("success", "ai-router", data, None, request_id),
        )

    # ──────────────────────────────────────────────────────────────────
    # Routes — /v1 for versioned API; /health, /info, /metrics at root
    # ──────────────────────────────────────────────────────────────────

    v1 = APIRouter(prefix="/v1", tags=["v1"])

    # ── Health & info at root (for LB, Prometheus) ─────────────────────
    @app.get("/health", response_model=BaseResponse, tags=["core"],
             description="Check health of AI router and all downstream services.")
    @_limiter.limit("100/minute")
    async def health(request: Request, settings: Settings = Depends(get_settings)):
        rid = getattr(request.state, "request_id", generate_request_id())
        urls = _service_urls(settings)
        statuses = await asyncio.gather(
            *[_health_probe(n, u, rid) for n, u in urls.items()]
        )
        svc_status = dict(zip(urls.keys(), statuses))
        healthy = sum(1 for s in svc_status.values() if s == "online")
        data = {
            "router": "online",
            "services": svc_status,
            "healthy_count": healthy,
            "total_count": len(svc_status),
        }
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    # ── Auth (optional) ──────────────────────────────────────────────
    @v1.get("/me", response_model=BaseResponse, tags=["core"],
             description="Current user from JWT (Better Auth). Returns null when not authenticated.")
    @_limiter.limit("100/minute")
    async def me(
        request: Request,
        user: Optional[dict] = Depends(get_current_user_optional),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        return JSONResponse(
            content=format_response("success", "ai-router", {"user": user}, None, rid)
        )

    # ── Clinical auto-routing ─────────────────────────────────────────
    @v1.post("/analyze/auto", response_model=BaseResponse, tags=["routing"],
              description="Automatically route medical data to the appropriate analysis service.")
    @_limiter.limit("100/minute")
    async def analyze_auto(
        request: Request,
        file: UploadFile = File(...),
        type_hint: Optional[str] = Form(default=None),
        patient_id: Optional[str] = Form(default=None),
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        detected = detect_file_type(file.filename, file.content_type)
        route = _detect_route_for_file(file.filename, file.content_type, type_hint)
        endpoint = _pick_downstream_endpoint(route, file.filename)
        if route == "radiology":
            err = ErrorDetail(
                code=503,
                message="Chest X-ray and DICOM radiology analysis is not available (service removed).",
                details={"route": "radiology"},
            )
            return JSONResponse(
                status_code=503,
                content=format_response("error", "ai-router", None, err.dict(), rid),
            )
        if route == "unsupported":
            err = ErrorDetail(
                code=400,
                message="Could not determine a clinical analyzer for this file.",
                details={
                    "hint": "Use type_hint or a supported file type (e.g. ECG CSV, fundus, MRI).",
                },
            )
            return JSONResponse(
                status_code=400,
                content=format_response("error", "ai-router", None, err.dict(), rid),
            )
        meta = FileAnalysisRequest(type_hint=type_hint, patient_id=patient_id)
        file_content = await file.read()
        valid, err_msg = validate_file_content(file_content, detected)
        if not valid:
            err = ErrorDetail(code=400, message="Invalid file content", details={"error": err_msg})
            return JSONResponse(
                status_code=400,
                content=format_response("error", "ai-router", None, err.dict(), rid),
            )
        return await _forward_to_clinical_service(
            route=route,
            endpoint=endpoint,
            file_content=file_content,
            filename=file.filename or "upload",
            content_type=file.content_type or "application/octet-stream",
            meta=meta,
            request_id=rid,
            settings=settings,
        )

    # ── Oracle Q&A ────────────────────────────────────────────────────
    @v1.post("/query", response_model=BaseResponse, tags=["nlp"],
              description="RAG-style query enriched with Meilisearch, Qdrant, and Perplexica.")
    @_limiter.limit("100/minute")
    async def query(
        request: Request,
        body: OracleQueryRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        question = body.text
        if not question:
            raise HTTPException(status_code=400, detail="Missing query text.")

        r_meili, r_qdrant, r_perplexica = await asyncio.gather(
            _query_meilisearch(question, settings, _client(), rid),
            _query_qdrant(question, settings, _client(), rid),
            _query_perplexica(question, settings),
        )
        combined = _merge_and_deduplicate(r_meili, r_qdrant, r_perplexica)[
            :_RAG_RESULT_LIMIT
        ]

        ctx_parts: List[str] = []
        for doc in combined:
            title = doc.get("title", "") or doc.get("name", "")
            snippet = doc.get("content") or doc.get("snippet") or doc.get("text") or ""
            ctx_parts.append(f"{title}: {snippet[:400]}")
        context = "\n\n".join(ctx_parts)

        enriched_prompt = (
            f"Context:\n{context}\n\n"
            f"Question:\n{question}\n\n"
            "Answer as a concise, evidence-based medical explanation."
        )
        answer = await _call_groq_chat(
            settings, enriched_prompt,
            "You are a medical AI assistant. "
            "Answer based on evidence-based medicine only. "
            "Always recommend consulting a doctor.",
            rid,
        )
        data = {
            "question": question,
            "answer": answer,
            "sources": {
                "meilisearch": r_meili,
                "qdrant": r_qdrant,
                "perplexica": r_perplexica,
                "combined": combined,
            },
        }
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    # ── Deep Research ─────────────────────────────────────────────────
    @v1.post("/deep-research", response_model=BaseResponse, tags=["nlp"],
              description="Structured deep research with citations and multi-section output.")
    @_limiter.limit("60/minute")
    async def deep_research(
        request: Request,
        body: DeepResearchRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        t0 = time.monotonic()
        rid = getattr(request.state, "request_id", generate_request_id())
        question = body.question_text
        if not question:
            raise HTTPException(status_code=400, detail="Missing query text.")

        domains: List[str] = body.domains or []
        subdomains: List[str] = body.subdomains or []
        intent: str = body.intent or "clinical"
        depth: str = body.depth or "comprehensive"

        r_meili, r_qdrant, r_perplexica = await asyncio.gather(
            _query_meilisearch(question, settings, _client(), rid),
            _query_qdrant(question, settings, _client(), rid),
            _query_perplexica(question, settings),
        )
        all_results = _merge_and_deduplicate(r_meili, r_qdrant, r_perplexica)

        # Numbered source references
        numbered: List[str] = []
        for idx, doc in enumerate(all_results[:_DEEP_RESEARCH_SOURCE_LIMIT], 1):
            t = doc.get("title") or doc.get("name") or "Untitled"
            s = doc.get("source") or doc.get("domain") or ""
            u = doc.get("url") or ""
            y = doc.get("year") or ""
            numbered.append(f"{idx}. {t} ({s}, {y}) {u}".strip())
        sources_block = "\n".join(numbered)

        # Context snippets
        ctx_parts = []
        for doc in all_results[:_RAG_RESULT_LIMIT]:
            title = doc.get("title", "") or doc.get("name", "")
            snip = doc.get("content") or doc.get("snippet") or doc.get("text") or ""
            ctx_parts.append(f"{title}: {snip[:800]}")
        context_text = "\n\n".join(ctx_parts)

        prompt = _build_deep_research_prompt(
            question, domains, subdomains, intent, depth, context_text, sources_block,
        )
        answer = await _call_groq_chat(
            settings,
            prompt,
            "You are a medical AI research assistant. Return ONLY valid JSON as specified, no commentary.",
            rid,
            role="ai_router_synthesis",
            max_tokens=8192,
            temperature=0.2,
        )

        sections = _parse_deep_research_sections(answer)
        citations = _build_citations(all_results, _DEEP_RESEARCH_CITATION_LIMIT)
        elapsed = time.monotonic() - t0

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
            .isoformat() + "Z",
            "integrative_mode": len(domains) >= 2,
        }
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    # ═══════════════════════════════════════════════════════════════════════
    # Dynamic System Prompt Builder for Oracle Chat Modes
    # ═══════════════════════════════════════════════════════════════════════
    def _build_chat_system_prompt(
        intensity: str,
        persona: str,
        evidence: str,
        domain: str,
        context: str,
        sources: Optional[List[Dict[str, Any]]] = None,
        is_emergency: bool = False,
    ) -> List[Dict[str, str]]:
        """Build system prompts based on user-selected modes."""
        
        # Base medical assistant identity
        base_prompt = (
            "You are Manthana, a medical AI assistant that churns five oceans of medicine "
            "(Allopathy, Ayurveda, Homeopathy, Siddha, and Unani) to extract only Amrita — "
            "pure, verified medical knowledge. Always recommend consulting a doctor for medical decisions."
        )
        if is_emergency:
            base_prompt += (
                "\n\nCRITICAL: This query appears to involve an emergency or urgent medical situation. "
                "You MUST begin your response with: 'If this is a medical emergency, call emergency services "
                "(112 in India, 911 in US) immediately. Do not delay.' "
                "Provide brief, actionable guidance. Emphasize seeking immediate professional care."
            )
        
        # Intensity modifiers
        intensity_prompts = {
            "quick": (
                "Provide a brief 2-3 sentence answer. Be concise and direct. "
                "Focus only on the most essential information."
            ),
            "clinical": (
                "Provide a detailed clinical response with specific medical reasoning. "
                "Include confidence levels, relevant findings, and clinical significance. "
                "Structure your answer with clear sections: Assessment, Key Points, and Recommendation."
            ),
            "deep": (
                "Provide a comprehensive medical analysis with: (1) Detailed assessment, "
                "(2) Differential diagnoses if applicable, (3) Evidence-based treatment options, "
                "(4) Prognosis and follow-up recommendations, (5) Relevant citations or guidelines. "
                "Be thorough but organized with clear headings."
            ),
        }
        
        # Persona modifiers
        persona_prompts = {
            "patient": (
                "Use simple, everyday language that a layperson can understand. "
                "Avoid medical jargon; if you must use technical terms, explain them immediately. "
                "Be reassuring but honest about uncertainties and risks. "
                "Focus on practical advice and what the patient should know or do."
            ),
            "clinician": (
                "Use precise medical terminology appropriate for healthcare professionals. "
                "Include ICD-10 codes when relevant, differential diagnoses, and guideline references. "
                "Discuss pathophysiology, pharmacology, and clinical decision-making. "
                "Reference standard treatment protocols and recent clinical evidence."
            ),
            "researcher": (
                "Provide an academic-level analysis with explicit citations. "
                "Discuss study methodology, statistical significance, confidence intervals, and effect sizes. "
                "Identify research gaps and suggest areas for further investigation. "
                "Compare conflicting evidence and explain the strength of recommendations."
            ),
            "student": (
                "Explain concepts step-by-step as if teaching a medical student. "
                "Define all medical terms clearly. Connect basic science to clinical application. "
                "Reference standard textbooks and educational resources. "
                "Include memory aids and clinical pearls where helpful."
            ),
        }
        
        # Evidence modifiers
        evidence_prompts = {
            "gold": (
                "Base your answer ONLY on the highest quality evidence: peer-reviewed journals, "
                "systematic reviews, meta-analyses, and guidelines from WHO, NIH, CDC, ICMR, "
                "and major medical societies (AHA, ADA, APA, etc.). Do not cite low-quality sources."
            ),
            "all": (
                "Consider a broad range of evidence including peer-reviewed research, "
                "clinical trials, traditional medicine texts (Ayurvedic classics like Charaka Samhita), "
                "and well-established clinical experience. Balance modern and traditional perspectives."
            ),
            "guidelines": (
                "Strictly follow established clinical guidelines from WHO, national health agencies "
                "(MoHFW India, AYUSH, CDSCO), and professional medical societies. "
                "Reference specific guideline documents and recommendation grades."
            ),
            "trials": (
                "Prioritize evidence from clinical trials. Reference specific trial names, "
                "phases, and registration numbers (NCT ID for ClinicalTrials.gov, CTRI number for India). "
                "Include trial phase, sample size, and primary endpoints when discussing treatments."
            ),
        }
        
        # Build the system prompts
        system_prompts: List[Dict[str, str]] = []
        
        # Base identity
        system_prompts.append({"role": "system", "content": base_prompt})
        
        # Add intensity modifier (if not auto)
        if intensity != "auto" and intensity in intensity_prompts:
            system_prompts.append({
                "role": "system",
                "content": f"Response Style: {intensity_prompts[intensity]}"
            })
        
        # Add persona modifier (if not auto)
        if persona != "auto" and persona in persona_prompts:
            system_prompts.append({
                "role": "system",
                "content": f"Target Audience: {persona_prompts[persona]}"
            })
        
        # Add evidence modifier (if not auto)
        if evidence != "auto" and evidence in evidence_prompts:
            system_prompts.append({
                "role": "system",
                "content": f"Evidence Standard: {evidence_prompts[evidence]}"
            })
        
        # Add enhanced domain context using domain_intelligence module
        try:
            med_domain = MedicalDomain(domain.lower())
            domain_system_prompt = get_domain_system_prompt(med_domain)
            system_prompts.append({
                "role": "system",
                "content": domain_system_prompt
            })
        except ValueError:
            # Unknown domain, skip domain-specific prompt
            pass
        
        # Add retrieved context
        system_prompts.append({"role": "system", "content": f"Retrieved Medical Context:\n{context}"})

        # Phase 3: Citation instruction + sources block
        if sources:
            sources_block = "\n".join(
                f"[S{i+1}] {d.get('title', '')} — {d.get('url', '') or 'indexed'} ({d.get('_source', '')}, Trust: {d.get('trustScore', 0)})"
                for i, d in enumerate(sources[:15])
            )
            citation_instruction = (
                "Cite sources inline as [S1], [S2], etc. when referencing the context. "
                "List full citations at the end of your response."
            )
            system_prompts.append({
                "role": "system",
                "content": f"{citation_instruction}\n\nSources for citation:\n{sources_block}",
            })

        return system_prompts

    # ── Chat (streaming) ─────────────────────────────────────────────
    @v1.post("/chat", tags=["chat"],
              description="Streaming chat with RAG context from Meilisearch, Qdrant, SearXNG, PubMed, and ClinicalTrials.gov. Phase 2: query intelligence, source routing, re-ranking.")
    @_limiter.limit("100/minute")
    async def chat(
        request: Request,
        body: ChatRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        message: str = body.message
        history: List = body.history
        experiment_id: Optional[str] = body.experiment_id

        # Phase 4: A/B testing — log experiment for analytics
        if experiment_id:
            json_log("manthana.ai-router", "info", event="chat_experiment", experiment_id=experiment_id, request_id=rid)

        # Extract mode parameters
        intensity: str = body.intensity or "auto"
        persona: str = body.persona or "auto"
        evidence: str = body.evidence or "auto"
        domain: str = body.domain or "allopathy"
        enable_web: bool = body.enable_web if body.enable_web is not None else True
        enable_trials: bool = body.enable_trials if body.enable_trials is not None else False

        # Phase 2: Query intelligence + source routing
        classification = classify_query(message)
        strategies = route_sources(
            classification.query_type, evidence, enable_web, enable_trials,
        )

        # Domain Intelligence: Check for integrative queries and secondary domain detection
        try:
            primary_domain = MedicalDomain(domain.lower())
        except ValueError:
            primary_domain = MedicalDomain.ALLOPATHY
        
        # Detect if user explicitly mentions another domain in query
        detected_domain = detect_domain_in_query(message)
        is_integrative = is_integrative_query(message)
        
        # If user explicitly asks about different domain and it's integrative, 
        # allow both domains; otherwise stick to primary
        effective_domain = primary_domain
        if detected_domain and detected_domain != primary_domain and is_integrative:
            # Query spans multiple systems - will use integrative mode
            json_log("manthana.ai-router", "info",
                     event="integrative_query_detected",
                     primary_domain=primary_domain.value,
                     detected_domain=detected_domain.value,
                     request_id=rid)
        elif detected_domain and detected_domain != primary_domain:
            # User explicitly asking about different domain - use that domain
            effective_domain = detected_domain
            json_log("manthana.ai-router", "info",
                     event="secondary_domain_override",
                     primary_domain=primary_domain.value,
                     effective_domain=effective_domain.value,
                     request_id=rid)
        
        # Domain-specific query expansion for better retrieval
        domain_expanded_queries = expand_query_for_domain(message, effective_domain)
        rag_query = domain_expanded_queries[-1] if len(domain_expanded_queries) > 1 else message
        
        # Build parallel tasks for each strategy
        tasks: Dict[str, Any] = {}
        client = _client()
        redis_cli = _redis()
        searxng_cat = CATEGORY_MAP.get(domain.lower(), "medical")

        if SourceStrategy.MEILISEARCH in strategies or SourceStrategy.QDRANT in strategies:
            # Use domain-expanded query for RAG search
            tasks["rag"] = _with_timeout(
                _rag_search(rag_query, settings, client, rid),
                {"meilisearch": [], "qdrant": []},
                timeout=6.0,
                source="rag",
            )
        if SourceStrategy.SEARXNG in strategies:
            tasks["searxng"] = _with_timeout(
                fetch_searxng(message, searxng_cat, "json", 1, settings.SEARXNG_URL, redis_cli),
                {"results": []},
                source="searxng",
            )
        if SourceStrategy.PUBMED in strategies:
            # Use allopathy-specific expansion for PubMed
            pubmed_query = expand_query(message, "allopathy")[1] if len(expand_query(message, "allopathy")) > 1 else message
            tasks["pubmed"] = _with_timeout(search_pubmed(pubmed_query, max_results=5), [], source="pubmed")
        if SourceStrategy.CLINICAL_TRIALS in strategies:
            tasks["trials"] = _with_timeout(
                fetch_clinical_trials_gov(
                    message, filters={"status": "active"}, page_size=5, redis_client=redis_cli,
                ),
                {"trials": []},
                source="trials",
            )

        # Run all tasks in parallel (Phase 4: each has timeout; exceptions become defaults)
        gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
        task_keys = list(tasks.keys())
        for i, r in enumerate(gathered):
            if isinstance(r, BaseException):
                json_log("manthana.ai-router", "warning",
                         event="chat_source_failed", source=task_keys[i], error=str(r), request_id=rid)

        # Unpack results (replace exceptions with empty defaults)
        rag_result = {"meilisearch": [], "qdrant": []}
        web_raw = {"results": []}
        pubmed_articles: List[Dict[str, Any]] = []
        trials_result = {"trials": []}
        for k, r in zip(task_keys, gathered):
            if isinstance(r, BaseException):
                continue
            if k == "rag":
                rag_result = r if isinstance(r, dict) else {"meilisearch": [], "qdrant": []}
            elif k == "searxng":
                web_raw = r if isinstance(r, dict) else {"results": []}
            elif k == "pubmed":
                pubmed_articles = r if isinstance(r, list) else []
            elif k == "trials":
                trials_result = r if isinstance(r, dict) else {"trials": []}

        # Normalize all docs to {title, content, _source} for re-ranking
        all_docs: List[Dict[str, Any]] = []
        for doc in rag_result.get("meilisearch", []):
            url = doc.get("url", "")
            base_score = 85
            # Apply domain-specific trust boost
            domain_boost = get_domain_trust_boost(effective_domain, url)
            all_docs.append({
                "title": doc.get("title", ""),
                "content": doc.get("content", "")[:400],
                "_source": "Meili",
                "url": url,
                "trustScore": base_score + domain_boost,
            })
        for doc in rag_result.get("qdrant", []):
            url = doc.get("url", "")
            base_score = 85
            domain_boost = get_domain_trust_boost(effective_domain, url)
            all_docs.append({
                "title": doc.get("title", ""),
                "content": doc.get("content", "")[:400],
                "_source": "Qdrant",
                "url": url,
                "trustScore": base_score + domain_boost,
            })
        raw_web = web_raw.get("results", [])
        if raw_web:
            enriched_web = [enrich_result(r, domain) for r in raw_web]
            enriched_web = deduplicate_results(enriched_web)
            # Apply domain-specific trust boosts before sorting
            for doc in enriched_web:
                url = doc.get("url", "")
                base_score = doc.get("trustScore", 45)
                domain_boost = get_domain_trust_boost(effective_domain, url)
                doc["trustScore"] = base_score + domain_boost
            enriched_web = sort_by_trust(enriched_web)
            for doc in enriched_web[:8]:
                all_docs.append({
                    "title": doc.get("title", ""),
                    "content": (doc.get("snippet", "") or doc.get("content", ""))[:400],
                    "_source": "Web",
                    "url": doc.get("url", ""),
                    "trustScore": doc.get("trustScore", 45),
                })
        for art in pubmed_articles[:5]:
            content = f"Authors: {art.get('authors', '')}. Published: {art.get('pubdate', '')}."
            all_docs.append({
                "title": art.get("title", ""),
                "content": content,
                "_source": "PubMed",
                "url": art.get("url", ""),
                "trustScore": 95,
            })
        for t in trials_result.get("trials", [])[:5]:
            content = f"Phase {t.get('phase', '')}, Status: {t.get('status', '')}. Condition: {t.get('condition', '')}. {t.get('intervention', '')}"
            all_docs.append({
                "title": t.get("title", ""),
                "content": content[:400],
                "_source": "ClinicalTrials",
                "url": t.get("url", ""),
                "trustScore": 93,
            })

        # Domain-aware re-ranking: prioritize domain-relevant sources
        all_docs = should_prioritize_domain_sources(effective_domain, all_docs)
        
        # Re-rank by relevance (heuristic)
        all_docs = rerank_by_relevance(all_docs, message, top_k=15)

        # Build context from re-ranked docs
        ctx_parts: List[str] = []
        for doc in all_docs:
            src = doc.get("_source", "")
            title = doc.get("title", "")
            content = doc.get("content", "")
            ctx_parts.append(f"[{src}] {title}: {content}")

        context = "\n\n".join(ctx_parts)

        # Build dynamic system prompts based on modes (Phase 3: with sources for citation)
        is_emergency = classification.query_type == QueryType.EMERGENCY
        messages: List[Dict[str, str]] = _build_chat_system_prompt(
            intensity, persona, evidence, domain, context, sources=all_docs, is_emergency=is_emergency,
        )

        # Add conversation history
        for h in history:
            messages.append({
                "role": h.role or "user",
                "content": h.content or "",
            })
        messages.append({"role": "user", "content": message})

        # Phase 3: Sources for streaming (id, title, url, trustScore, source)
        sources_for_stream = [
            {
                "id": f"S{i+1}",
                "title": d.get("title", ""),
                "url": d.get("url", ""),
                "trustScore": d.get("trustScore", 0),
                "source": d.get("_source", ""),
            }
            for i, d in enumerate(all_docs[:15])
        ]

        return StreamingResponse(
            _groq_stream(settings, messages, rid, sources_for_stream, strategies, is_emergency=is_emergency),
            media_type="text/event-stream",
        )

    # ── M5 Five Domain Chat ─────────────────────────────────────────────
    @v1.post("/chat/m5", tags=["chat"],
             description="M5 Mode: Query all 5 medical systems simultaneously. Returns integrated answers from Allopathy, Ayurveda, Homeopathy, Siddha, and Unani.")
    @_limiter.limit("30/minute")
    async def chat_m5(
        request: Request,
        body: ChatRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        """M5 endpoint: Parallel queries to all 5 medical domains."""
        rid = getattr(request.state, "request_id", generate_request_id())
        message: str = body.message
        history: List = body.history
        
        json_log("manthana.ai-router", "info",
                 event="m5_query_start", query=message[:100], request_id=rid)
        
        # Run 5 parallel domain queries
        domains = [
            MedicalDomain.ALLOPATHY,
            MedicalDomain.AYURVEDA,
            MedicalDomain.HOMEOPATHY,
            MedicalDomain.SIDDHA,
            MedicalDomain.UNANI,
        ]
        
        async def query_single_domain(domain: MedicalDomain) -> tuple[MedicalDomain, str, List[Dict]]:
            """Query a single domain and return content + sources."""
            try:
                # Expand query for domain
                expanded_queries = expand_query_for_domain(message, domain)
                domain_query = expanded_queries[-1] if len(expanded_queries) > 1 else message
                
                # Get sources for this domain
                strategies = [SourceStrategy.MEILISEARCH, SourceStrategy.QDRANT]
                if domain == MedicalDomain.ALLOPATHY:
                    strategies.extend([SourceStrategy.PUBMED, SourceStrategy.SEARXNG])
                
                # Search (simplified for M5 - use existing RAG)
                client = _client()
                rag_result = await _rag_search(domain_query, settings, client, rid)
                
                # Build sources list
                sources: List[Dict[str, Any]] = []
                for doc in rag_result.get("meilisearch", [])[:5]:
                    url = doc.get("url", "")
                    base_score = 85
                    domain_boost = get_domain_trust_boost(domain, url)
                    sources.append({
                        "title": doc.get("title", ""),
                        "url": url,
                        "trustScore": base_score + domain_boost,
                        "_source": "Meili",
                    })
                
                # Get domain system prompt
                domain_prompt = get_domain_system_prompt(domain)
                m5_appendix = """
You are answering in M5 (Five Domain) mode. The user will see your response alongside answers from 4 other medical systems. Provide a comprehensive answer from YOUR domain perspective, emphasizing what makes your system unique. Keep it informative but concise (300-500 words) for comparison purposes.
"""
                
                # Build messages for this domain
                messages = [
                    {"role": "system", "content": domain_prompt + m5_appendix},
                    {"role": "user", "content": message}
                ]
                
                keys = openrouter_api_keys(settings)
                cfg = get_inference_config()
                content = f"[{domain.value.upper()}] Response unavailable - API key not configured."
                for api_key in keys:
                    try:
                        client = build_openrouter_async_client(api_key, cfg)
                        content, _m, *_ = await chat_complete_async(
                            client,
                            cfg,
                            "oracle_m5",
                            messages,
                        )
                        break
                    except Exception:
                        continue
                
                return domain, content, sources
                
            except Exception as exc:
                json_log("manthana.ai-router", "error",
                         event="m5_domain_error", domain=domain.value, error=str(exc), request_id=rid)
                return domain, f"[{domain.value.upper()}] Error generating response: {str(exc)[:100]}", []
        
        # Run all 5 queries in parallel
        domain_results = await asyncio.gather(*[query_single_domain(d) for d in domains])
        
        # Build M5 response
        domain_contents = {r[0]: r[1] for r in domain_results}
        domain_sources = {r[0]: r[2] for r in domain_results}
        
        m5_response = build_m5_response_from_parts(message, domain_contents, domain_sources)
        
        # Stream the response
        return StreamingResponse(
            stream_m5_response(message, m5_response.get_all_answers(), m5_response.integrative_summary),
            media_type="text/event-stream",
        )

    # ── Plagiarism (extracted to routers/plagiarism.py) ─────────────────
    from routers.plagiarism import create_plagiarism_router
    v1.include_router(create_plagiarism_router(_limiter))

    # ── Clinical report enrichment ─────────────────────────────────────
    @v1.post(
        "/report/enrich",
        response_model=BaseResponse,
        tags=["reports"],
        description=(
            "Enrich structured imaging findings with ICD-10, RadLex, RADS scoring "
            "and LLM-generated impression/differential."
        ),
    )
    @_limiter.limit("60/minute")
    async def enrich_report(
        request: Request,
        body: ReportEnrichRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        modality: str = body.modality
        findings_in = body.findings

        # Build enriched findings with ICD-10 / RadLex metadata (shared)
        ontology = enrich_findings_with_ontology(findings_in, modality)
        enriched_findings = ontology["enriched_findings"]
        rads_score = ontology["rads_score"]
        triage_level = ontology["triage_level"]
        labels = [f.get("label", "") for f in enriched_findings if f.get("label")]

        # LLM-backed impression + differential with Redis cache
        redis_client = _redis()
        cache_key = None
        impression = ""
        differential_map: Dict[str, List[str]] = {}
        triage_from_llm: Optional[str] = None

        try:
            labels_sorted = ",".join(sorted([l for l in labels if l]))
            raw_key = f"{modality}::{labels_sorted}"
            cache_key = hashlib.sha256(raw_key.encode("utf-8")).hexdigest()
            cached = None
            if redis_client is not None:
                cached = await redis_client.get(cache_key)
            if cached:
                parsed = json.loads(cached)
            else:
                prompt = (
                    "You are a radiology reporting assistant.\n"
                    "Given the imaging modality and a list of findings (label, confidence, severity),\n"
                    "produce ONLY a compact JSON object with fields:\n"
                    "{\n"
                    '  "impression": "single concise impression sentence",\n'
                    '  "differential": { "<label>": ["Dx1", "Dx2", "Dx3"], ... },\n'
                    '  "triage_level": "ROUTINE" | "URGENT" | "EMERGENT"\n'
                    "}\n"
                    "Do not include any other keys or text.\n\n"
                    f"Modality: {modality}\n"
                    f"Findings: {json.dumps(findings_in, default=str)}\n"
                )
                raw = await _call_groq_chat(
                    settings=settings,
                    prompt=prompt,
                    system_prompt=(
                        "You are a radiology reporting assistant. "
                        "Return strictly valid JSON. Be conservative and recommend "
                        "clinical correlation when appropriate."
                    ),
                    request_id=rid,
                    role="ai_router_synthesis",
                    max_tokens=2048,
                    temperature=0.1,
                )
                parsed = json.loads(raw)
                if redis_client is not None:
                    await redis_client.setex(cache_key, 3600, json.dumps(parsed))

            impression = str(parsed.get("impression", "") or "")
            triage_from_llm = parsed.get("triage_level")
            diff_raw = parsed.get("differential") or {}
            if isinstance(diff_raw, dict):
                for k, v in diff_raw.items():
                    if isinstance(v, list):
                        differential_map[str(k)] = [str(x) for x in v][:3]
        except Exception as exc:
            json_log(
                "manthana.ai-router",
                "warning",
                event="report_enrich_llm_fallback",
                error=str(exc),
                request_id=rid,
            )

        if triage_from_llm in {"ROUTINE", "URGENT", "EMERGENT"}:
            triage_level = triage_from_llm  # type: ignore[assignment]

        # Attach differential lists to enriched findings
        for ef in enriched_findings:
            lbl = ef.get("label")
            if lbl in differential_map:
                ef["differential"] = differential_map[lbl]
            elif not ef.get("differential"):
                ef["differential"] = []

        if not impression:
            labels_str = ", ".join([f.get("label", "") for f in enriched_findings if f.get("label")])
            impression = f"{labels_str}. Correlate clinically." if labels_str else "No dominant abnormality. Correlate clinically."

        data = {
            "enriched_findings": enriched_findings,
            "rads_score": rads_score,
            "triage_level": triage_level,
            "impression": impression,
            "report_standard": "ACR 2024",
        }
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    # ── Legacy API proxies (categories, icd10, report/pdf) ─────────────
    @v1.get("/categories", tags=["search"],
             description="Available medical domain categories (frontend compatibility).")
    @_limiter.limit("100/minute")
    async def categories_proxy(request: Request):
        rid = getattr(request.state, "request_id", generate_request_id())
        category_ids = [c["id"] for c in CATEGORIES]
        data = {"categories": category_ids}
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    @v1.get("/icd10/suggest", tags=["icd10"],
             description="ICD-10 code autocomplete (proxies to manthana-api, fallback to shared ontology).")
    @_limiter.limit("100/minute")
    async def icd10_suggest_proxy(
        request: Request,
        q: str = FQuery(..., min_length=2, max_length=200),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        try:
            resp = await _client().get(
                f"{settings.MANTHANA_API_URL.rstrip('/')}/icd10/suggest",
                params={"q": q},
                timeout=10.0,
            )
            resp.raise_for_status()
            body = resp.json()
            data = {"query": body.get("query", q), "suggestions": body.get("suggestions", [])}
            return JSONResponse(
                content=format_response("success", "ai-router", data, None, rid)
            )
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="icd10_proxy_failed", error=str(exc), request_id=rid)
            try:
                matches = icd10_lookup(q)
                data = {"query": q, "suggestions": matches}
                return JSONResponse(
                    content=format_response("success", "ai-router", data, None, rid)
                )
            except Exception as fallback_exc:
                json_log("manthana.ai-router", "error",
                         event="icd10_fallback_failed", error=str(fallback_exc), request_id=rid)
                err = ErrorDetail(code=502, message="ICD-10 service unavailable.", details={"error": str(exc)})
                return JSONResponse(
                    status_code=502,
                    content=format_response("error", "ai-router", None, err.dict(), rid)
                )

    @v1.post("/report/pdf", tags=["reports"],
              description="Generate PDF report (proxies to manthana-api).")
    @_limiter.limit("30/minute")
    async def report_pdf_proxy(
        request: Request,
        body: ReportPdfRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        try:
            resp = await _client().post(
                f"{settings.MANTHANA_API_URL.rstrip('/')}/report/pdf",
                json=body.model_dump(exclude_none=True),
                timeout=30.0,
            )
            resp.raise_for_status()
            return StreamingResponse(
                iter([resp.content]),
                media_type="application/pdf",
                headers={
                    "Content-Disposition": 'attachment; filename="Manthana_Report.pdf"',
                },
            )
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="report_pdf_proxy_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="PDF generation failed.", details={"error": str(exc)})
            return JSONResponse(
                status_code=502,
                content=format_response("error", "ai-router", None, err.dict(), rid)
            )

    # ── Chest X-ray endpoints (radiology microservice removed) ─────────
    @v1.post("/analyze/xray", response_model=BaseResponse, tags=["routing"],
              description="Chest X-ray analysis — disabled (radiology backend removed).")
    @_limiter.limit("100/minute")
    async def analyze_xray_proxy(
        request: Request,
        file: UploadFile = File(...),
        user: Optional[dict] = Depends(get_protected_user),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        await file.read()  # consume upload
        err = ErrorDetail(
            code=503,
            message="Chest X-ray analysis is not available (radiology service removed).",
            details={},
        )
        return JSONResponse(
            status_code=503,
            content=format_response("error", "ai-router", None, err.dict(), rid),
        )

    @v1.post("/analyze/xray/heatmap", response_model=BaseResponse, tags=["routing"],
              description="Grad-CAM heatmap — disabled (radiology backend removed).")
    @_limiter.limit("60/minute")
    async def analyze_xray_heatmap_proxy(
        request: Request,
        file: UploadFile = File(...),
        user: Optional[dict] = Depends(get_protected_user),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        await file.read()
        err = ErrorDetail(
            code=503,
            message="Heatmap generation is not available (radiology service removed).",
            details={},
        )
        return JSONResponse(
            status_code=503,
            content=format_response("error", "ai-router", None, err.dict(), rid),
        )

    # ── Drug interaction proxies ─────────────────────────────────────
    @v1.post("/interaction/check", response_model=BaseResponse, tags=["interaction"],
              description="Check drug interactions (proxies to drug service).")
    @_limiter.limit("60/minute")
    async def interaction_check_proxy(
        request: Request,
        body: DrugInteractionRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        base_url = getattr(settings, "DRUG_URL", "http://drug:8109")
        try:
            resp = await _client().post(
                f"{base_url.rstrip('/')}/interaction/check",
                json={"drugs": body.drugs},
                timeout=15.0,
            )
            resp.raise_for_status()
            payload = resp.json()
            return JSONResponse(content=payload)
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="interaction_check_proxy_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="Drug interaction check failed.", details={"error": str(exc)})
            return JSONResponse(status_code=502, content=format_response("error", "ai-router", None, err.dict(), rid))

    @v1.post("/interaction/check/enriched", response_model=BaseResponse, tags=["interaction"],
              description="Enriched drug interaction with FDA data (proxies to drug service).")
    @_limiter.limit("60/minute")
    async def interaction_check_enriched_proxy(
        request: Request,
        body: InteractionCheckEnrichedRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        drug_a = body.drug_a_val
        drug_b = body.drug_b_val
        if not drug_a or not drug_b:
            err = ErrorDetail(code=400, message="Both drug_a and drug_b required.", details=None)
            return JSONResponse(status_code=400, content=format_response("error", "ai-router", None, err.dict(), rid))
        base_url = getattr(settings, "DRUG_URL", "http://drug:8109")
        try:
            resp = await _client().post(
                f"{base_url.rstrip('/')}/interaction/check/enriched",
                json={"drug_a": drug_a, "drug_b": drug_b},
                timeout=15.0,
            )
            resp.raise_for_status()
            payload = resp.json()
            data = payload.get("data") if isinstance(payload.get("data"), dict) else payload
            return JSONResponse(content=format_response("success", "ai-router", data, None, rid))
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="interaction_check_enriched_proxy_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="Enriched interaction check failed.", details={"error": str(exc)})
            return JSONResponse(status_code=502, content=format_response("error", "ai-router", None, err.dict(), rid))

    @v1.post("/drug-interaction/check", response_model=BaseResponse, tags=["interaction"],
              description="Alias for /interaction/check (frontend compatibility).")
    @_limiter.limit("60/minute")
    async def drug_interaction_check_alias(
        request: Request,
        body: DrugInteractionRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        return await interaction_check_proxy(request, body, user, settings)

    # ── SNOMED lookup proxy ────────────────────────────────────────────
    @v1.get("/snomed/lookup", tags=["snomed"],
             description="SNOMED-CT concept lookup (proxies to NLP, maps to frontend shape).")
    @_limiter.limit("100/minute")
    async def snomed_lookup_proxy(
        request: Request,
        term: str = FQuery(..., min_length=2),
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        base_url = getattr(settings, "NLP_URL", "http://nlp:8108")
        try:
            resp = await _client().get(
                f"{base_url.rstrip('/')}/snomed/lookup",
                params={"term": term},
                timeout=15.0,
            )
            resp.raise_for_status()
            payload = resp.json()
            raw_data = payload.get("data", {}) if isinstance(payload, dict) else payload
            concepts_raw = raw_data.get("concepts", []) if isinstance(raw_data, dict) else []
            concepts = [
                {"conceptId": c.get("concept_id", c.get("conceptId", "")), "preferredTerm": c.get("term", c.get("preferredTerm", ""))}
                for c in concepts_raw
            ]
            data = {"term": term, "concepts": concepts}
            return JSONResponse(content=format_response("success", "ai-router", data, None, rid))
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="snomed_lookup_proxy_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="SNOMED lookup failed.", details={"error": str(exc)})
            return JSONResponse(status_code=502, content=format_response("error", "ai-router", None, err.dict(), rid))

    # ── Herb-drug safety (evidence-based) ─────────────────────────────
    @v1.post("/herb-drug/analyze", tags=["ayurveda"],
              description="Herb-drug interaction safety (curated evidence + PubMed literature).")
    @_limiter.limit("60/minute")
    async def herb_drug_analyze(
        request: Request,
        body: HerbDrugRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        herb = body.herb.strip()
        drug = body.drug.strip()
        base_url = getattr(settings, "AYURVEDA_URL", "http://ayurveda:8110")
        herb_info: Dict[str, Any] = {}
        try:
            herb_resp = await _client().post(
                f"{base_url.rstrip('/')}/search/herb",
                json={"name": herb},
                timeout=15.0,
            )
            if herb_resp.status_code == 200:
                herb_data = herb_resp.json()
                herb_info = herb_data.get("data", {}) if isinstance(herb_data, dict) else {}
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="herb_drug_ayurveda_lookup_failed", error=str(exc), request_id=rid)
        redis_client = _redis()
        try:
            data = await analyze_herb_drug(
                herb=herb,
                drug=drug,
                herb_info=herb_info,
                redis_client=redis_client,
            )
            return JSONResponse(content=format_response("success", "ai-router", data, None, rid))
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="herb_drug_analyze_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="Herb-drug analysis failed.", details={"error": str(exc)})
            return JSONResponse(status_code=502, content=format_response("error", "ai-router", None, err.dict(), rid))

    # ── Clinical trials search (ClinicalTrials.gov API v2) ─────────────
    @v1.post("/clinical-trials/search", tags=["trials"],
              description="Search clinical trials via ClinicalTrials.gov API v2. Supports India filter.")
    @_limiter.limit("60/minute")
    async def clinical_trials_search(
        request: Request,
        body: ClinicalTrialsSearchRequest,
        user: Optional[dict] = Depends(get_protected_user),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        query = body.query.strip()
        filters = body.filters or {}
        page = int(filters.get("page", 1) or 1)
        redis_client = _redis()
        try:
            result = await fetch_clinical_trials_gov(
                query=query,
                filters=filters,
                page=page,
                page_size=25,
                redis_client=redis_client,
            )
            data = {
                "query": query,
                "filters": filters,
                "trials": result.get("trials", []),
                "total": result.get("total", 0),
                "next_page_token": result.get("next_page_token"),
                "source": "ClinicalTrials.gov",
            }
            return JSONResponse(content=format_response("success", "ai-router", data, None, rid))
        except Exception as exc:
            json_log("manthana.ai-router", "warning",
                     event="clinical_trials_search_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=502, message="Clinical trials search failed.", details={"error": str(exc)})
            return JSONResponse(status_code=502, content=format_response("error", "ai-router", None, err.dict(), rid))

    # ── Services catalog ──────────────────────────────────────────────
    @v1.get("/services", response_model=BaseResponse, tags=["core"],
             description="List all downstream services and capabilities.")
    @_limiter.limit("100/minute")
    async def list_services(
        request: Request, settings: Settings = Depends(get_settings)
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        urls = _service_urls(settings)
        capabilities = {}
        for svc, meta in SERVICE_CAPABILITIES.items():
            capabilities[svc] = {
                **meta,
                "url": urls.get(svc, ""),
            }
        return JSONResponse(
            content=format_response("success", "ai-router", {"services": capabilities}, None, rid)
        )

    # ── Audit log (compliance) ────────────────────────────────────────
    @v1.get("/audit/log", tags=["compliance"],
             description="Query analysis audit log (request_id, patient_id, service, limit).")
    @_limiter.limit("60/minute")
    async def audit_log_query(
        request: Request,
        request_id: Optional[str] = FQuery(None, description="Filter by request ID"),
        patient_id: Optional[str] = FQuery(None, description="Filter by patient ID"),
        service: Optional[str] = FQuery(None, description="Filter by service"),
        limit: int = FQuery(50, ge=1, le=500, description="Max results"),
        user: Optional[dict] = Depends(get_protected_user),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        try:
            entries = query_audit_log(
                request_id=request_id,
                patient_id=patient_id,
                service=service,
                limit=limit,
            )
            return JSONResponse(
                content=format_response("success", "ai-router", {"entries": entries, "count": len(entries)}, None, rid)
            )
        except Exception as exc:
            json_log("manthana.ai-router", "warning", event="audit_query_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(code=500, message="Audit query failed.", details={"error": str(exc)})
            return JSONResponse(status_code=500, content=format_response("error", "ai-router", None, err.dict(), rid))

    # ── Manthana Web Search ───────────────────────────────────────────
    @v1.get("/search", tags=["search"],
             description="MANTHANA WEB — Medical search engine with trust scoring, images, videos.")
    @_limiter.limit("200/minute")
    async def medical_search(
        request: Request,
        q: str = FQuery(..., min_length=2, max_length=500, description="Medical search query"),
        category: str = FQuery("medical", description="Medical domain category"),
        page: int = FQuery(1, ge=1, le=10, description="Result page number"),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        t0 = time.monotonic()

        searxng_cat = CATEGORY_MAP.get(category.lower(), "medical")
        searxng_url = settings.SEARXNG_URL
        redis_client = _redis()
        meili_key = (
            getattr(settings, "MEILISEARCH_API_KEY", "")
            or getattr(settings, "MEILISEARCH_KEY", "")
        )

        # Run 4 searches in parallel
        results_web, results_images, results_videos, results_local = await asyncio.gather(
            fetch_searxng(q, searxng_cat, "json", page, searxng_url, redis_client),
            fetch_searxng(q, "images", "json", 1, searxng_url, redis_client),
            fetch_searxng(q, "videos", "json", 1, searxng_url, redis_client),
            search_own_index_async(q, category, settings.MEILISEARCH_URL, meili_key),
            return_exceptions=True,
        )

        # Safely unwrap exceptions
        if isinstance(results_web, BaseException):
            results_web = {}
        if isinstance(results_images, BaseException):
            results_images = {}
        if isinstance(results_videos, BaseException):
            results_videos = {}
        if isinstance(results_local, BaseException):
            results_local = []

        # Enrich + deduplicate + rank web results
        raw_web: list = results_web.get("results", [])  # type: ignore[union-attr]
        enriched = [enrich_result(r, category) for r in raw_web]
        enriched = deduplicate_results(enriched)
        enriched = sort_by_trust(enriched)

        # Process images
        raw_images: list = results_images.get("results", [])  # type: ignore[union-attr]
        image_results: List[Dict[str, Any]] = []
        for r in raw_images[:_SEARCH_IMAGE_LIMIT]:
            img_url = r.get("img_src") or r.get("url", "")
            if not img_url:
                continue
            image_results.append({
                "url": img_url,
                "title": r.get("title", ""),
                "source": extract_domain(r.get("url", "")),
                "sourceUrl": r.get("url", ""),
                "thumbnail": r.get("thumbnail_src") or img_url,
            })

        # Process videos
        raw_videos: list = results_videos.get("results", [])  # type: ignore[union-attr]
        video_results: List[Dict[str, Any]] = [
            {
                "url": r.get("url", ""),
                "title": r.get("title", ""),
                "thumbnail": r.get("thumbnail", ""),
                "source": extract_domain(r.get("url", "")),
                "publishedDate": r.get("publishedDate", ""),
            }
            for r in raw_videos[:_SEARCH_VIDEO_LIMIT]
            if r.get("url")
        ]

        # Related questions (no LLM, pure heuristic)
        related = generate_related_questions(q, enriched[:3])

        # Engines used
        engines_used = sorted(
            {r.get("engine", "") for r in raw_web if r.get("engine")}
        )[:10]

        elapsed = round(time.monotonic() - t0, 2)
        total = results_web.get("number_of_results", len(enriched))  # type: ignore[union-attr]

        data = {
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
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    # ── Autocomplete ──────────────────────────────────────────────────
    @v1.get("/search/autocomplete", tags=["search"],
             description="Get search suggestions from SearXNG autocompleter.")
    @_limiter.limit("300/minute")
    async def search_autocomplete(
        request: Request,
        q: str = FQuery(..., min_length=2, max_length=200),
        category: str = FQuery("medical"),
        settings: Settings = Depends(get_settings),
    ):
        rid = getattr(request.state, "request_id", generate_request_id())
        suggestions: List[str] = []
        try:
            async with httpx.AsyncClient(timeout=2.0) as ac:
                res = await ac.get(
                    f"{settings.SEARXNG_URL}/autocompleter",
                    params={"q": q},
                )
                data = res.json()
                if isinstance(data, list) and len(data) > 1:
                    suggestions = data[1][:_AUTOCOMPLETE_LIMIT]
        except Exception as exc:
            json_log("manthana.ai-router", "debug",
                     event="autocomplete_error", error=str(exc), request_id=rid)
        return JSONResponse(
            content=format_response("success", "ai-router", {"suggestions": suggestions}, None, rid)
        )

    # ── Prometheus metrics ────────────────────────────────────────────
    @app.get("/metrics", response_class=PlainTextResponse, tags=["monitoring"],
             description="Prometheus-compatible metrics.")
    async def metrics():
        snap = _metrics.snapshot()
        lines = [
            "# HELP manthana_requests_total Total HTTP requests.",
            "# TYPE manthana_requests_total counter",
            f"manthana_requests_total {snap['requests_total']}",
            "# HELP manthana_errors_total Total HTTP errors.",
            "# TYPE manthana_errors_total counter",
            f"manthana_errors_total {snap['errors_total']}",
            "# HELP manthana_rate_limited_total Total rate-limited requests.",
            "# TYPE manthana_rate_limited_total counter",
            f"manthana_rate_limited_total {snap['rate_limited_total']}",
        ]
        return PlainTextResponse("\n".join(lines))

    # ── Info (root + v1) ───────────────────────────────────────────────
    async def _info_handler(request: Request):
        rid = getattr(request.state, "request_id", generate_request_id())
        data = {
            "service": "ai-router",
            "version": "2.0.0",
            "disclaimer": DISCLAIMER,
        }
        return JSONResponse(
            content=format_response("success", "ai-router", data, None, rid)
        )

    @app.get("/info", response_model=BaseResponse, tags=["core"],
             description="Router service information (root).")
    async def info_root(request: Request):
        return await _info_handler(request)

    @v1.get("/info", response_model=BaseResponse, tags=["core"],
             description="Router service information.")
    async def info_v1(request: Request):
        return await _info_handler(request)

    app.include_router(v1)
    return app


# ═══════════════════════════════════════════════════════════════════════
# Module entry-point
# ═══════════════════════════════════════════════════════════════════════
settings = get_settings()
app = create_app(settings)
