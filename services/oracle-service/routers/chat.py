"""
chat.py — Oracle Chat Router
==============================
Streaming chat endpoint with full RAG pipeline: query classification,
source routing, MeiliSearch + Qdrant + SearXNG + PubMed + ClinicalTrials,
re-ranking, domain intelligence, and adaptive prompts.

Implements ORACLE_SERVICE_FIX_PLAN.md Phase A–D.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncGenerator, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import OracleSettings, get_oracle_settings

# Shared imports
PROJECT_ROOT = "/opt/manthana"
import sys
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.circuit_breaker import oracle_groq_circuit, CircuitBreakerError
from services.shared.search_utils import deduplicate_results, enrich_result, fetch_searxng, sort_by_trust
# Local json_log (avoid heavy numpy/pillow deps)
def json_log(logger_name: str, level: str, **fields) -> None:
    """Emit structured JSON log."""
    import logging, json as _json
    log_obj = logging.getLogger(logger_name)
    numeric_level = getattr(logging, level.upper(), logging.INFO)
    if not log_obj.isEnabledFor(numeric_level):
        return
    try:
        record = _json.dumps(fields, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        record = str(fields)
    log_obj.log(numeric_level, record)


logger = logging.getLogger("manthana.oracle.chat")

# ── Lib imports (ai-router modules copied to /app/lib at build time) ───
_LIB_AVAILABLE = False
try:
    from query_intelligence import classify_query, expand_query, QueryType
    from source_router import route_sources, SourceStrategy
    from reranker import rerank_by_relevance
    from domain_intelligence import (
        MedicalDomain,
        expand_query_for_domain,
        get_ayurveda_enhanced_queries,
        get_domain_system_prompt,
        get_domain_trust_boost,
        detect_domain_in_query,
        is_integrative_query,
        should_prioritize_domain_sources,
    )
    from pubmed_client import search_pubmed
    from clinical_trials import fetch_clinical_trials_gov
    _LIB_AVAILABLE = True
    json_log("manthana.oracle", "info", event="lib_loaded", modules="query_intelligence,source_router,reranker,domain_intelligence,pubmed,clinical_trials")
except ImportError as e:
    json_log("manthana.oracle", "warning", event="lib_unavailable", error=str(e), fallback="minimal")

# Fallback when lib not available
if not _LIB_AVAILABLE:
    class QueryType:
        EMERGENCY = "emergency"
        CLINICAL_TRIAL = "clinical_trial"
        DRUG = "drug"
        GENERAL = "general"

    class SourceStrategy:
        MEILISEARCH = "meilisearch"
        QDRANT = "qdrant"
        SEARXNG = "searxng"
        PUBMED = "pubmed"
        CLINICAL_TRIALS = "clinical_trials"

    class MedicalDomain(str):
        ALLOPATHY = "allopathy"
        AYURVEDA = "ayurveda"
        HOMEOPATHY = "homeopathy"
        SIDDHA = "siddha"
        UNANI = "unani"

    def classify_query(q):
        from dataclasses import dataclass
        @dataclass
        class QC:
            query_type: str
            confidence: float
            matched_keywords: list
        return QC(QueryType.GENERAL, 0.5, [])

    def route_sources(qt, ev, web, trials):
        return [SourceStrategy.MEILISEARCH, SourceStrategy.QDRANT, SourceStrategy.SEARXNG]

    def expand_query(q, d="allopathy", m=3):
        return [q]

    def rerank_by_relevance(docs, q, top_k=10):
        return docs[:top_k]

    def expand_query_for_domain(q, d):
        return [q]

    def get_ayurveda_enhanced_queries(q):
        return {
            "general": [q],
            "shloka": [q],
            "modern": [q],
            "clinical": [q],
        }

    def get_domain_system_prompt(d):
        return f"You are an expert in {d}. Provide accurate, evidence-based information."

    def get_domain_trust_boost(d, url):
        return 0

    def detect_domain_in_query(q):
        return None

    def is_integrative_query(q):
        return False

    def should_prioritize_domain_sources(d, sources):
        return sources

    async def search_pubmed(q, max_results=5):
        return []

    async def fetch_clinical_trials_gov(q, filters=None, page=1, page_size=5, redis_client=None):
        return {"trials": []}

CATEGORY_MAP = {
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

_CHAT_SOURCE_TIMEOUT = 8.0
_EMBEDDING_MODEL = "nomic-embed-text"
_ALLOPATHY_ONLY_DOMAINS = ("pubmed.ncbi.nlm.nih.gov", "www.ncbi.nlm.nih.gov", "clinicaltrials.gov")


def _is_allopathy_only_url(url: str) -> bool:
    """True if URL is from an allopathy-only source (PubMed, ClinicalTrials)."""
    if not url:
        return False
    lower = url.lower()
    return any(d in lower for d in _ALLOPATHY_ONLY_DOMAINS)
_EMBED_MAX_CHARS = 8000
_EMBEDDING_DIM = 768


# ── Request/Response Models ───────────────────────────────────────────

class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = Field(default_factory=list)
    domain: str = Field(default="allopathy")
    lang: str = Field(default="en")
    intensity: str = Field(default="auto")
    persona: str = Field(default="auto")
    evidence: str = Field(default="auto")
    enable_web: bool = Field(default=True)
    enable_trials: bool = Field(default=False)
    experiment_id: Optional[str] = None


# ── LLM Client Helpers ────────────────────────────────────────────────

_GROQ_PLACEHOLDER = "your_groq_api_key_here"


def _get_groq_api_keys(settings: OracleSettings) -> List[str]:
    """Get list of valid Groq API keys (primary + secondary)."""
    keys = []
    
    # Primary key
    key1 = (settings.ORACLE_GROQ_API_KEY or "").strip()
    if key1 and key1 != _GROQ_PLACEHOLDER and not key1.startswith("your_") and len(key1) >= 20:
        keys.append(key1)
    
    # Secondary key (for fallback when primary rate limited)
    key2 = (settings.ORACLE_GROQ_API_KEY_2 or "").strip()
    if key2 and key2 != _GROQ_PLACEHOLDER and not key2.startswith("your_") and len(key2) >= 20:
        keys.append(key2)
    
    return keys


async def _groq_stream_with_key(
    api_key: str,
    settings: OracleSettings,
    messages: List[Dict[str, str]],
) -> AsyncGenerator[str, None]:
    """Stream from Groq with a specific API key."""
    from groq import AsyncGroq
    client = AsyncGroq(api_key=api_key)
    stream = await client.chat.completions.create(
        model=settings.ORACLE_GROQ_MODEL,
        messages=messages,
        max_completion_tokens=1024,
        temperature=0.1,
        stream=True,
    )
    async for chunk in stream:
        content = chunk.choices[0].delta.content if chunk.choices else None
        if content:
            payload = json.dumps({"message": {"content": content}, "type": "token"})
            yield f"data: {payload}\n\n"


async def _groq_stream_with_circuit(
    settings: OracleSettings,
    messages: List[Dict[str, str]],
    request_id: str,
) -> AsyncGenerator[str, None]:
    """Stream from Groq with automatic key rotation on rate limit."""
    from groq import RateLimitError, APIError
    
    keys = _get_groq_api_keys(settings)
    
    if not keys:
        yield json.dumps({"error": "no_groq_keys_configured"}) + "\n\n"
        yield 'data: {"type": "done"}\n\n'
        return
    
    # Try each key in sequence
    for idx, api_key in enumerate(keys):
        key_num = "primary" if idx == 0 else f"fallback_{idx}"
        try:
            json_log("manthana.oracle", "info", event="groq_stream_start", key=key_num, request_id=request_id)
            async for chunk in _groq_stream_with_key(api_key, settings, messages):
                yield chunk
            json_log("manthana.oracle", "info", event="groq_stream_success", key=key_num, request_id=request_id)
            return  # Success - exit
        except RateLimitError as e:
            json_log("manthana.oracle", "warning", event="groq_rate_limit", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                # Try next key
                continue
            else:
                # No more keys - return error
                yield json.dumps({"error": "rate_limit_exhausted", "message": "All Groq API keys rate limited"}) + "\n\n"
                yield 'data: {"type": "done"}\n\n'
                return
        except APIError as e:
            json_log("manthana.oracle", "error", event="groq_api_error", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                continue
            else:
                yield json.dumps({"error": "groq_api_error", "message": str(e)}) + "\n\n"
                yield 'data: {"type": "done"}\n\n'
                return
        except Exception as e:
            json_log("manthana.oracle", "error", event="groq_stream_error", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                continue
            else:
                yield json.dumps({"error": "groq_stream_failed", "message": str(e)}) + "\n\n"
                yield 'data: {"type": "done"}\n\n'
                return


# ── RAG Helpers ────────────────────────────────────────────────────────

async def _generate_embedding(
    text: str,
    settings: OracleSettings,
    client: httpx.AsyncClient,
    request_id: str,
) -> List[float]:
    try:
        resp = await client.post(
            f"{settings.ORACLE_EMBED_URL.rstrip('/')}/api/embeddings",
            json={"model": _EMBEDDING_MODEL, "prompt": text[:_EMBED_MAX_CHARS]},
            headers={"Content-Type": "application/json"},
            timeout=15.0,
        )
        resp.raise_for_status()
        embedding = resp.json().get("embedding", [])
        if embedding:
            return embedding
    except Exception as exc:
        json_log("manthana.oracle", "warning", event="embedding_fallback", error=str(exc), request_id=request_id)
    return [0.0] * _EMBEDDING_DIM


async def _query_meilisearch(
    query: str,
    settings: OracleSettings,
    client: httpx.AsyncClient,
    request_id: str,
) -> List[Dict[str, Any]]:
    try:
        key = settings.ORACLE_MEILISEARCH_KEY or ""
        resp = await client.post(
            f"{settings.ORACLE_MEILISEARCH_URL.rstrip('/')}/indexes/medical_search/search",
            json={"q": query, "limit": 5},
            headers={"X-Meili-API-Key": key, "Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            return resp.json().get("hits", [])
    except Exception as exc:
        json_log("manthana.oracle", "warning", event="meilisearch_error", error=str(exc), request_id=request_id)
    return []


async def _query_qdrant(
    query: str,
    settings: OracleSettings,
    client: httpx.AsyncClient,
    request_id: str,
) -> List[Dict[str, Any]]:
    try:
        embedding = await _generate_embedding(query, settings, client, request_id)
        resp = await client.post(
            f"{settings.ORACLE_QDRANT_URL.rstrip('/')}/collections/{settings.ORACLE_QDRANT_COLLECTION}/points/search",
            json={"vector": embedding, "limit": 5, "with_payload": True},
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            return [p.get("payload", {}) for p in resp.json().get("result", [])]
    except Exception as exc:
        json_log("manthana.oracle", "warning", event="qdrant_error", error=str(exc), request_id=request_id)
    return []


async def _rag_search(
    query: str,
    settings: OracleSettings,
    client: httpx.AsyncClient,
    request_id: str,
) -> Dict[str, List[Dict[str, Any]]]:
    meili, qdrant = await asyncio.gather(
        _query_meilisearch(query, settings, client, request_id),
        _query_qdrant(query, settings, client, request_id),
    )
    return {"meilisearch": meili, "qdrant": qdrant}


async def _with_timeout(coro, default: Any, timeout: float = _CHAT_SOURCE_TIMEOUT, source: str = "") -> Any:
    try:
        return await asyncio.wait_for(coro, timeout=timeout)
    except asyncio.TimeoutError:
        if source:
            json_log("manthana.oracle", "warning", event="chat_source_timeout", source=source, timeout=timeout)
        return default
    except Exception as exc:
        if source:
            json_log("manthana.oracle", "warning", event="chat_source_error", source=source, error=str(exc))
        return default


# ── System Prompt Builder (Phase B) ───────────────────────────────────

def _build_chat_system_prompt(
    intensity: str,
    persona: str,
    evidence: str,
    domain: str,
    context: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    is_emergency: bool = False,
) -> List[Dict[str, str]]:
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

    intensity_prompts = {
        "quick": "Provide a brief 2-3 sentence answer. Use **bold** for key terms. Be concise and direct.",
        "clinical": "Provide a detailed clinical response with clear ## Headings, **bold** key terms, bullet points for lists, and proper section separation.",
        "deep": "Provide a comprehensive medical analysis with full Markdown formatting: ## Headings, ### Subheadings, **bold** key terms, bullet points, and well-structured sections.",
    }
    persona_prompts = {
        "patient": "Use simple, everyday language. Avoid medical jargon; explain technical terms. Be reassuring but honest.",
        "clinician": "Use precise medical terminology. Include ICD-10 codes when relevant, differential diagnoses, and guideline references.",
        "researcher": "Provide academic-level analysis with explicit citations. Discuss methodology, statistical significance, and research gaps.",
        "student": "Explain step-by-step. Define all medical terms. Connect basic science to clinical application.",
    }
    evidence_prompts = {
        "gold": "Base your answer ONLY on highest quality evidence: peer-reviewed journals, systematic reviews, WHO, NIH, CDC, ICMR, major medical societies.",
        "all": "Consider broad evidence including peer-reviewed research, clinical trials, traditional medicine texts, and clinical experience.",
        "guidelines": "Strictly follow established clinical guidelines from WHO, national health agencies, and professional societies.",
        "trials": "Prioritize evidence from clinical trials. Reference trial names, phases, NCT IDs, CTRI numbers.",
    }

    system_prompts: List[Dict[str, str]] = []
    system_prompts.append({"role": "system", "content": base_prompt})
    if intensity != "auto" and intensity in intensity_prompts:
        system_prompts.append({"role": "system", "content": f"Response Style: {intensity_prompts[intensity]}"})
    if persona != "auto" and persona in persona_prompts:
        system_prompts.append({"role": "system", "content": f"Target Audience: {persona_prompts[persona]}"})
    if evidence != "auto" and evidence in evidence_prompts:
        system_prompts.append({"role": "system", "content": f"Evidence Standard: {evidence_prompts[evidence]}"})

    try:
        med_domain = MedicalDomain(domain.lower())
        domain_system_prompt = get_domain_system_prompt(med_domain)
        system_prompts.append({"role": "system", "content": domain_system_prompt})
    except (ValueError, AttributeError):
        pass

    system_prompts.append({"role": "system", "content": f"Retrieved Medical Context:\n{context}"})

    # Formatting instructions for better output structure
    formatting_prompt = """
## RESPONSE FORMATTING RULES

You MUST format your response using proper Markdown for readability:

### Structure:
1. **Start with a brief summary** (2-3 sentences max) in plain text
2. **Use clear headings** (## or ###) to organize sections
3. **Use bullet points** (- or *) for lists, not dense paragraphs
4. **Use bold** (**) for key terms, medical concepts, and important warnings
5. **Use italic** (*) for emphasis and caveats
6. **Add blank lines** between sections for visual separation

### Citation Style:
- Place citations AFTER the relevant claim: "Diabetes is a metabolic disorder [S1]."
- Don't cluster multiple citations together
- Citations should flow naturally in the text

### Section Organization (adapt based on query type):
- **Overview/Summary** - Brief answer first
- **Key Points** - Bullet list of main takeaways
- **Detailed Explanation** - Structured with subheadings
- **Treatment/Management** - If applicable
- **When to Seek Help** - Safety-critical info
- **Sources** - Full citations at end

### Formatting Examples:
❌ BAD: "Diabetes is a condition where blood sugar is high [S1]. Symptoms include thirst and frequent urination [S2]. Treatment involves medication [S3]."

✅ GOOD:
## Overview
Diabetes is a chronic metabolic disorder characterized by elevated blood glucose levels [S1].

## Key Symptoms
- **Excessive thirst** (polydipsia)
- **Frequent urination** (polyuria) 
- **Unexplained weight loss**

## Treatment Options
Treatment typically includes:
- **Lifestyle modifications** - Diet and exercise [S2]
- **Medications** - Metformin, insulin as needed [S3]

## Sources
[S1] Title - URL
[S2] Title - URL
"""

    if sources:
        sources_block = "\n".join(
            f"[S{i+1}] {d.get('title', '')} — {d.get('url', '') or 'indexed'}"
            for i, d in enumerate(sources[:15])
        )
        citation_instruction = (
            "Cite sources inline as [S1], [S2], etc. when referencing the context. "
            "Place citations AFTER the specific claim they support."
        )
        system_prompts.append({
            "role": "system",
            "content": f"{formatting_prompt}\n\n{citation_instruction}\n\n## Available Sources for Citation\n{sources_block}",
        })
    else:
        system_prompts.append({"role": "system", "content": formatting_prompt})

    return system_prompts


# ── Main Groq Stream (with progress, sources, emergency, multi-key fallback) ───────────────

async def _groq_stream(
    settings: OracleSettings,
    messages: List[Dict[str, str]],
    request_id: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    strategies: Optional[List[Any]] = None,
    is_emergency: bool = False,
) -> AsyncGenerator[str, None]:
    if is_emergency:
        yield 'data: {"type": "emergency", "is_emergency": true}\n\n'
    if strategies:
        for s in strategies:
            stage = getattr(s, "value", str(s)) if s else ""
            yield f'data: {json.dumps({"type": "progress", "stage": stage, "status": "complete"})}\n\n'
    yield f'data: {json.dumps({"type": "progress", "stage": "context_ready", "status": "complete"})}\n\n'
    if sources:
        yield f'data: {json.dumps({"type": "sources", "sources": sources})}\n\n'

    # Check if any Groq keys are configured
    keys = _get_groq_api_keys(settings)
    if not keys:
        json_log("manthana.oracle", "error", event="groq_no_keys", message="No Groq API keys configured", request_id=request_id)
        yield 'data: {"message":{"content":"Groq API key not configured. Please add ORACLE_GROQ_API_KEY to environment."}}\n\n'
        yield 'data: {"type": "done"}\n\n'
        return

    try:
        if oracle_groq_circuit.state.value == "open":
            raise CircuitBreakerError("Groq circuit is OPEN")
        # _groq_stream_with_circuit now handles key rotation internally
        async for chunk in _groq_stream_with_circuit(settings, messages, request_id):
            yield chunk
        await oracle_groq_circuit._on_success()
        yield 'data: {"type": "done"}\n\n'
    except CircuitBreakerError:
        json_log("manthana.oracle", "warning", event="groq_circuit_open", request_id=request_id)
        yield 'data: {"error": "groq_service_unavailable", "message": "Groq service temporarily unavailable (circuit open)"}\n\n'
        yield 'data: {"type": "done"}\n\n'
    except Exception as exc:
        json_log("manthana.oracle", "error", event="groq_stream_error", error=str(exc), request_id=request_id)
        await oracle_groq_circuit._on_failure()
        yield 'data: {"error": "stream_error", "message": "An error occurred during streaming"}\n\n'
        yield 'data: {"type": "done"}\n\n'


# ── Router Factory ───────────────────────────────────────────────────

def create_chat_router(limiter) -> APIRouter:
    router = APIRouter(tags=["chat"])

    @router.post("/chat")
    @limiter.limit("100/minute")
    async def chat(
        request: Request,
        body: ChatRequest,
        settings: OracleSettings = Depends(get_oracle_settings),
    ):
        rid = getattr(request.state, "request_id", "unknown")
        message = body.message
        domain = body.domain or "allopathy"
        intensity = body.intensity or "auto"
        persona = body.persona or "auto"
        evidence = body.evidence or "auto"
        enable_web = body.enable_web if body.enable_web is not None else True
        enable_trials = body.enable_trials if body.enable_trials is not None else False

        if body.experiment_id:
            json_log("manthana.oracle", "info", event="chat_experiment", experiment_id=body.experiment_id, request_id=rid)

        # Phase 2: Query intelligence + source routing
        classification = classify_query(message)
        strategies = route_sources(
            classification.query_type, evidence, enable_web, enable_trials,
        )

        # Domain intelligence
        try:
            primary_domain = MedicalDomain(domain.lower())
        except (ValueError, AttributeError):
            primary_domain = MedicalDomain.ALLOPATHY

        detected_domain = detect_domain_in_query(message) if _LIB_AVAILABLE else None
        is_integrative = is_integrative_query(message) if _LIB_AVAILABLE else False
        effective_domain = primary_domain
        if detected_domain and detected_domain != primary_domain and is_integrative:
            json_log("manthana.oracle", "info", event="integrative_query_detected", primary_domain=primary_domain.value, detected_domain=detected_domain.value, request_id=rid)
        elif detected_domain and detected_domain != primary_domain:
            effective_domain = detected_domain
            json_log("manthana.oracle", "info", event="secondary_domain_override", primary_domain=primary_domain.value, effective_domain=effective_domain.value, request_id=rid)

        # Domain-specific query expansion
        # Special enhanced handling for Ayurveda to get classical shlokas
        if effective_domain == MedicalDomain.AYURVEDA and _LIB_AVAILABLE:
            # Get enhanced Ayurveda queries with shloka-specific variations
            ayurveda_queries = get_ayurveda_enhanced_queries(message)
            domain_expanded_queries = ayurveda_queries["general"]
            # Use shloka-focused query for RAG to get classical text content
            rag_query = ayurveda_queries["shloka"][-1] if ayurveda_queries["shloka"] else message
            # Also use shloka query for SearXNG to find classical text sources
            searxng_query = ayurveda_queries["shloka"][0] if ayurveda_queries["shloka"] else message
            json_log(
                "manthana.oracle",
                "info",
                event="ayurveda_enhanced_query",
                shloka_query=rag_query,
                searxng_query=searxng_query,
                request_id=rid,
            )
        else:
            domain_expanded_queries = expand_query_for_domain(message, effective_domain)
            rag_query = domain_expanded_queries[-1] if len(domain_expanded_queries) > 1 else message
            searxng_query = rag_query
        
        searxng_cat = CATEGORY_MAP.get(effective_domain.value, "medical")

        # Build parallel tasks
        tasks: Dict[str, Any] = {}
        client = getattr(request.app.state, "client", None)
        if client is None:
            client = httpx.AsyncClient(timeout=20.0)

        redis_cli = getattr(request.app.state, "redis", None)

        if SourceStrategy.MEILISEARCH in strategies or SourceStrategy.QDRANT in strategies:
            tasks["rag"] = _with_timeout(
                _rag_search(rag_query, settings, client, rid),
                {"meilisearch": [], "qdrant": []},
                timeout=6.0,
                source="rag",
            )
        if SourceStrategy.SEARXNG in strategies:
            # Use shloka-focused query for Ayurveda to get classical text sources
            tasks["searxng"] = _with_timeout(
                fetch_searxng(searxng_query, searxng_cat, "json", 1, settings.SEARXNG_URL, redis_cli),
                {"results": []},
                source="searxng",
            )
        # PubMed: allopathy-only (peer-reviewed Western medicine)
        if (
            SourceStrategy.PUBMED in strategies
            and settings.ORACLE_ENABLE_PUBMED
            and effective_domain == MedicalDomain.ALLOPATHY
        ):
            pubmed_exp = expand_query(message, "allopathy")
            pubmed_query = pubmed_exp[1] if len(pubmed_exp) > 1 else message
            tasks["pubmed"] = _with_timeout(search_pubmed(pubmed_query, max_results=5), [], source="pubmed")
        # ClinicalTrials: allopathy + homeopathy (some homeopathy trials on CT.gov)
        if (
            SourceStrategy.CLINICAL_TRIALS in strategies
            and settings.ORACLE_ENABLE_TRIALS
            and effective_domain in (MedicalDomain.ALLOPATHY, MedicalDomain.HOMEOPATHY)
        ):
            tasks["trials"] = _with_timeout(
                fetch_clinical_trials_gov(
                    message, filters={"status": "active"}, page_size=5, redis_client=redis_cli,
                ),
                {"trials": []},
                source="trials",
            )

        gathered = await asyncio.gather(*tasks.values(), return_exceptions=True)
        task_keys = list(tasks.keys())
        for i, r in enumerate(gathered):
            if isinstance(r, BaseException):
                json_log("manthana.oracle", "warning", event="chat_source_failed", source=task_keys[i], error=str(r), request_id=rid)

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

        # Normalize all docs to {title, content, _source, url, trustScore}
        all_docs: List[Dict[str, Any]] = []
        for doc in rag_result.get("meilisearch", []):
            url = doc.get("url", "")
            base_score = 85
            domain_boost = get_domain_trust_boost(effective_domain, url)
            all_docs.append({
                "title": doc.get("title", ""),
                "content": (doc.get("content", "") or doc.get("snippet", ""))[:400],
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
                "content": (doc.get("content", "") or doc.get("snippet", ""))[:400],
                "_source": "Qdrant",
                "url": url,
                "trustScore": base_score + domain_boost,
            })
        raw_web = web_raw.get("results", [])
        if raw_web:
            enriched_web = [enrich_result(r, domain) for r in raw_web]
            enriched_web = deduplicate_results(enriched_web)
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

        # Domain-aware re-ranking
        all_docs = should_prioritize_domain_sources(effective_domain, all_docs)
        # For traditional domains, exclude allopathy-only sources (PubMed, ClinicalTrials)
        if effective_domain in (MedicalDomain.AYURVEDA, MedicalDomain.SIDDHA, MedicalDomain.UNANI):
            all_docs = [d for d in all_docs if not _is_allopathy_only_url(d.get("url", ""))]
        all_docs = rerank_by_relevance(all_docs, message, top_k=15)

        # Build context
        ctx_parts = [f"[{d.get('_source', '')}] {d.get('title', '')}: {d.get('content', '')}" for d in all_docs]
        context = "\n\n".join(ctx_parts)

        is_emergency = classification.query_type == QueryType.EMERGENCY
        messages: List[Dict[str, str]] = _build_chat_system_prompt(
            intensity, persona, evidence, domain, context, sources=all_docs, is_emergency=is_emergency,
        )
        for h in body.history[-10:]:
            messages.append({"role": h.role or "user", "content": h.content or ""})
        messages.append({"role": "user", "content": message})

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

        async def stream_generator():
            async for chunk in _groq_stream(
                settings, messages, rid, sources_for_stream, strategies, is_emergency=is_emergency
            ):
                yield chunk

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={"X-Request-ID": rid, "Cache-Control": "no-cache"},
        )

    return router
