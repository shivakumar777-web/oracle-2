"""
chat.py â€” Oracle Chat Router
==============================
Streaming chat endpoint with full RAG pipeline: query classification,
source routing, MeiliSearch + Qdrant + SearXNG + PubMed + ClinicalTrials,
re-ranking, domain intelligence, and adaptive prompts.

Implements ORACLE_SERVICE_FIX_PLAN.md Phase Aâ€“D.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Annotated, Any, AsyncGenerator, Dict, List, Optional

import httpx
from fastapi import APIRouter, Body, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import OracleSettings, get_oracle_settings

from services.shared.circuit_breaker import oracle_openrouter_circuit, CircuitBreakerError
from services.shared.domain_sources import (
    build_openrouter_web_search_parameters,
    ranked_search_priority_entries,
)
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

# â”€â”€ Lib imports (ai-router modules copied to /app/lib at build time) â”€â”€â”€
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
    json_log(
        "manthana.oracle",
        "error",
        event="lib_unavailable",
        error=str(e),
        fallback="minimal",
        hint="Set PYTHONPATH to oracle-2 and services/ai-router (see README-DEV.md).",
    )

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


# Exposed for health endpoint (set after stub/real lib load)
INTELLIGENCE_LIB_LOADED = _LIB_AVAILABLE

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


# â”€â”€ Request/Response Models â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

class ChatMessage(BaseModel):
    role: str = "user"
    content: str = ""


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


# â”€â”€ LLM Client Helpers (OpenRouter via cloud_inference.yaml) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

from manthana_inference import resolve_role, stream_chat_async
from services.shared.openrouter_helpers import (
    build_async_client,
    effective_inference_config,
    openrouter_api_keys,
)


def _get_openrouter_keys(settings: OracleSettings) -> List[str]:
    return openrouter_api_keys(settings)


def _sse_event(payload: Dict[str, Any]) -> str:
    """Single SSE line: data: <json>\\n\\n"""
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _sse_error_event(error_code: str, user_message: str) -> str:
    """SSE error visible to streamChat (type + message.content in fallback branch)."""
    return _sse_event({
        "type": "error",
        "error": error_code,
        "message": {"content": user_message},
    })


async def _openrouter_stream_with_key(
    api_key: str,
    settings: OracleSettings,
    messages: List[Dict[str, str]],
    *,
    web_search_parameters: Optional[Dict[str, Any]] = None,
    enable_web: bool = True,
    chat_role: str,
) -> AsyncGenerator[str, None]:
    cfg = effective_inference_config(settings)
    role_name = chat_role
    role_cfg = resolve_role(cfg, role_name)
    om = (settings.ORACLE_OPENROUTER_MODEL or "").strip()
    if om:
        role_cfg = role_cfg.model_copy(update={"model": om})
    client = build_async_client(api_key, settings)
    completion_meta: Dict[str, Any] = {}
    async for delta, _model in stream_chat_async(
        client,
        cfg,
        role_name,
        list(messages),
        role_cfg=role_cfg,
        web_search_parameters=web_search_parameters,
        strip_online_suffix=not enable_web,
        completion_meta=completion_meta,
    ):
        if delta:
            payload = json.dumps({"message": {"content": delta}, "type": "token"})
            yield f"data: {payload}\n\n"
    if enable_web and web_search_parameters:
        web_links = completion_meta.get("web_links") or []
        if web_links:
            yield _sse_event({"type": "web_links", "links": web_links})


async def _openrouter_stream_with_circuit(
    settings: OracleSettings,
    messages: List[Dict[str, str]],
    request_id: str,
    *,
    web_search_parameters: Optional[Dict[str, Any]] = None,
    enable_web: bool = True,
    chat_role: str,
) -> AsyncGenerator[str, None]:
    from openai import APIError, RateLimitError

    keys = _get_openrouter_keys(settings)

    if not keys:
        yield _sse_error_event(
            "no_openrouter_keys_configured",
            "OpenRouter API key not configured inside stream.",
        )
        yield _sse_event({"type": "done"})
        return

    for idx, api_key in enumerate(keys):
        key_num = "primary" if idx == 0 else f"fallback_{idx}"
        try:
            json_log("manthana.oracle", "info", event="openrouter_stream_start", key=key_num, request_id=request_id)
            async for chunk in _openrouter_stream_with_key(
                api_key,
                settings,
                messages,
                web_search_parameters=web_search_parameters,
                enable_web=enable_web,
                chat_role=chat_role,
            ):
                yield chunk
            json_log("manthana.oracle", "info", event="openrouter_stream_success", key=key_num, request_id=request_id)
            return
        except RateLimitError as e:
            json_log("manthana.oracle", "warning", event="openrouter_rate_limit", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                continue
            yield _sse_error_event(
                "rate_limit_exhausted",
                "All OpenRouter API keys are rate limited. Try again shortly.",
            )
            yield _sse_event({"type": "done"})
            return
        except APIError as e:
            json_log("manthana.oracle", "error", event="openrouter_api_error", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                continue
            yield _sse_error_event("openrouter_api_error", str(e))
            yield _sse_event({"type": "done"})
            return
        except Exception as e:
            json_log("manthana.oracle", "error", event="openrouter_stream_error", key=key_num, error=str(e), request_id=request_id)
            if idx < len(keys) - 1:
                continue
            yield _sse_error_event("openrouter_stream_failed", str(e))
            yield _sse_event({"type": "done"})
            return


# â”€â”€ RAG Helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


# â”€â”€ System Prompt Builder (Phase B) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def _build_chat_system_prompt(
    intensity: str,
    persona: str,
    evidence: str,
    domain: str,
    context: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    is_emergency: bool = False,
    *,
    primary_domain: MedicalDomain,
    search_priority_query: str = "",
) -> List[Dict[str, str]]:
    base_prompt = (
        "You are Manthana, a medical AI assistant that churns five oceans of medicine "
        "(Allopathy, Ayurveda, Homeopathy, Siddha, and Unani) to extract only Amrita â€” "
        "pure, verified medical knowledge. Always recommend consulting a doctor for medical decisions.\n\n"
    )
    if primary_domain == MedicalDomain.ALLOPATHY:
        base_prompt += (
            "WEB SEARCH CAPABILITY: You have real-time web search enabled via OpenRouter. "
            "When answering questions about current medical information, latest treatments, "
            "recent studies, or any query requiring up-to-date data, you MUST search the web "
            "and provide authoritative source URLs with your answers. "
            "Cite sources using [S1], [S2] format with full URLs."
        )
    else:
        base_prompt += (
            "WEB SEARCH: You may use real-time web search. For this session the user chose a **traditional "
            "medical system** (not allopathy as primary). Prefer classical texts, AYUSH portals, WHO traditional "
            "medicine, peer-reviewed ethnopharmacology, and accredited college hospital Ayurveda/Unani/Siddha "
            "guidance. Do **not** default to minoxidil, finasteride, or other Western first-line drugs unless "
            "the user explicitly asks for allopathic options or emergency care. "
            "Cite sources using [S1], [S2] with full URLs."
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

    domain_system_prompt = get_domain_system_prompt(primary_domain)
    system_prompts.append({"role": "system", "content": domain_system_prompt})

    # Search priorities: metadata-ranked pills (Part 2) + site hints (Part 1)
    ranked_entries = ranked_search_priority_entries(
        primary_domain.value,
        search_priority_query or "",
        top_k=6,
    )
    if ranked_entries:
        lines = [
            f"- **{e['display_name']}** ({e['short_name']}): prefer {e['site_hint']}"
            for e in ranked_entries
        ]
        search_priority_block = (
            f"SEARCH PRIORITIES ({primary_domain.value.upper()}): When searching the web, "
            "prioritize these authoritative catalogs (in order of relevance for this session):\n"
            + "\n".join(lines)
            + "\nUse these sites for citations, guidelines, and evidence."
        )
        system_prompts.append({"role": "system", "content": search_priority_block})

    # UI DOMAIN LOCK — enforced for ALL five domains so the LLM never drifts
    # to a different system than what the user explicitly selected.
    domain_lock_text: Dict[MedicalDomain, str] = {
        MedicalDomain.ALLOPATHY: (
            "UI DOMAIN LOCK — ALLOPATHY: The user selected **ALLOPATHY** in the Manthana app. "
            "Respond exclusively using evidence-based modern Western medicine: peer-reviewed research, "
            "clinical guidelines (WHO, NIH, ICMR, ADA, AHA, etc.), drug names, ICD codes, and "
            "pharmacological mechanisms. Do **not** lead with Ayurvedic, Homeopathic, Siddha, or Unani "
            "recommendations unless the user explicitly asks for a comparison. If traditional medicine is "
            "mentioned in web results, note it briefly but keep the primary answer in modern medicine."
        ),
        MedicalDomain.AYURVEDA: (
            "UI DOMAIN LOCK — AYURVEDA: The user selected **AYURVEDA** in the Manthana app. "
            "Your answer must be framed primarily in classical Ayurveda: dosha/dhatu/mala theory, "
            "Samhita references (Charaka, Sushruta, Vagbhata), Sanskrit shlokas, Panchakarma, "
            "Rasayana, and AYUSH pharmacopoeia. Do **not** default to allopathic drugs (minoxidil, "
            "metformin, statins, etc.) as the primary answer. Mention modern medicine only for "
            "comparison or emergency context if the user asks."
        ),
        MedicalDomain.HOMEOPATHY: (
            "UI DOMAIN LOCK — HOMEOPATHY: The user selected **HOMEOPATHY** in the Manthana app. "
            "Frame your answer in Hahnemannian homeopathy: Law of Similars, potency selection "
            "(centesimal / decimal / LM), materia medica (polychrests and specifics), miasmatic "
            "theory, and constitutional prescribing. Do **not** recommend allopathic drugs as the "
            "primary option. Reference CCRH, organon, and clinical homeopathy literature."
        ),
        MedicalDomain.SIDDHA: (
            "UI DOMAIN LOCK — SIDDHA: The user selected **SIDDHA** in the Manthana app. "
            "Answer in the Tamil Siddha tradition: three humors (Vaadham/Pitham/Kabam), Naadi pulse "
            "diagnosis, Mooligai herbs, Thathu/Jeevam pharmacology, Kayakalpa, and CCRS / AYUSH "
            "sources. Do **not** default to allopathic treatments as the primary recommendation."
        ),
        MedicalDomain.UNANI: (
            "UI DOMAIN LOCK — UNANI: The user selected **UNANI** in the Manthana app. "
            "Answer using Greco-Arabic Unani principles: four humors (Akhlat), Mizaj temperament, "
            "Asbab Sitta Zarooriya, Ilaj bil Tadbeer/Ghiza/Dawa, CCRUM pharmacopoeia, and WHO-EMRO "
            "traditional medicine guidelines. Do **not** default to allopathic drugs as the primary "
            "treatment recommendation."
        ),
    }
    lock_msg = domain_lock_text.get(primary_domain)
    if lock_msg:
        system_prompts.append({"role": "system", "content": lock_msg})

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
âŒ BAD: "Diabetes is a condition where blood sugar is high [S1]. Symptoms include thirst and frequent urination [S2]. Treatment involves medication [S3]."

âœ… GOOD:
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
            f"[S{i+1}] {d.get('title', '')} â€” {d.get('url', '') or 'indexed'}"
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


# â”€â”€ Main LLM stream (OpenRouter + optional second key) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async def _oracle_llm_stream(
    settings: OracleSettings,
    messages: List[Dict[str, str]],
    request_id: str,
    sources: Optional[List[Dict[str, Any]]] = None,
    strategies: Optional[List[Any]] = None,
    is_emergency: bool = False,
    *,
    web_search_parameters: Optional[Dict[str, Any]] = None,
    enable_web: bool = True,
    chat_role: str,
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

    keys = _get_openrouter_keys(settings)
    if not keys:
        json_log("manthana.oracle", "error", event="openrouter_no_keys", message="No OpenRouter API keys configured", request_id=request_id)
        yield _sse_error_event(
            "openrouter_no_keys",
            "OpenRouter API key not configured. Set OPENROUTER_API_KEY or ORACLE_OPENROUTER_API_KEY in the environment.",
        )
        yield _sse_event({"type": "done"})
        return

    try:
        if oracle_openrouter_circuit.state.value == "open":
            raise CircuitBreakerError("LLM circuit is OPEN")
        async for chunk in _openrouter_stream_with_circuit(
            settings,
            messages,
            request_id,
            web_search_parameters=web_search_parameters,
            enable_web=enable_web,
            chat_role=chat_role,
        ):
            yield chunk
        await oracle_openrouter_circuit._on_success()
        yield _sse_event({"type": "done"})
    except CircuitBreakerError:
        json_log("manthana.oracle", "warning", event="llm_circuit_open", request_id=request_id)
        yield _sse_error_event(
            "llm_service_unavailable",
            "LLM service temporarily unavailable (circuit open). Try again later.",
        )
        yield _sse_event({"type": "done"})
    except Exception as exc:
        json_log("manthana.oracle", "error", event="openrouter_stream_error", error=str(exc), request_id=request_id)
        await oracle_openrouter_circuit._on_failure()
        yield _sse_error_event("stream_error", "An error occurred during streaming.")
        yield _sse_event({"type": "done"})


# â”€â”€ Router Factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

def create_chat_router(limiter) -> APIRouter:
    router = APIRouter(tags=["chat"])

    @router.post("/chat")
    async def chat(
        request: Request,
        payload: Annotated[ChatRequest, Body()],
        settings: OracleSettings = Depends(get_oracle_settings),
    ):
        rid = getattr(request.state, "request_id", "unknown")
        message = payload.message
        domain = payload.domain or "allopathy"
        intensity = payload.intensity or "auto"
        persona = payload.persona or "auto"
        evidence = payload.evidence or "auto"
        enable_web = payload.enable_web if payload.enable_web is not None else True
        enable_trials = payload.enable_trials if payload.enable_trials is not None else False

        if payload.experiment_id:
            json_log("manthana.oracle", "info", event="chat_experiment", experiment_id=payload.experiment_id, request_id=rid)

        if settings.ORACLE_ENABLE_DOMAIN_INTELLIGENCE and not _LIB_AVAILABLE:
            async def intelligence_unavailable_stream():
                yield _sse_error_event(
                    "domain_intelligence_unavailable",
                    "Domain intelligence is unavailable â€” ai-router modules failed to import. "
                    "Check deployment (PYTHONPATH, MANTHANA_ROOT) or set ORACLE_ENABLE_DOMAIN_INTELLIGENCE=false for stub-only mode.",
                )
                yield _sse_event({"type": "done"})

            return StreamingResponse(
                intelligence_unavailable_stream(),
                media_type="text/event-stream",
            )

        if not getattr(request.app.state, "cloud_inference_ok", True):
            msg = getattr(request.app.state, "cloud_inference_error", "") or (
                "Cloud inference configuration is missing or invalid. "
                "Set CLOUD_INFERENCE_CONFIG_PATH to a valid cloud_inference.yaml on the Oracle service."
            )

            async def _cfg_err():
                yield _sse_error_event("cloud_inference_config", msg)
                yield _sse_event({"type": "done"})

            return StreamingResponse(
                _cfg_err(),
                media_type="text/event-stream",
                headers={"X-Request-ID": rid, "Cache-Control": "no-cache"},
            )

        try:
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

            # effective_domain always equals primary_domain (the user's explicit pill selection).
            # We keep detect_domain_in_query for logging/integrative detection but we no longer
            # auto-switch effective_domain away from the user's choice — doing so caused a split
            # where web_search_parameters used a different domain than the system prompt.
            # The user's pill IS their intent; honour it unconditionally.
            effective_domain = primary_domain
            if _LIB_AVAILABLE:
                detected_domain = detect_domain_in_query(message)
                is_integrative = is_integrative_query(message)
                if detected_domain and detected_domain != primary_domain:
                    if is_integrative:
                        json_log("manthana.oracle", "info", event="integrative_query_detected",
                                 primary_domain=primary_domain.value, detected_domain=detected_domain.value,
                                 request_id=rid)
                    else:
                        # Log only — no longer auto-switching; primary_domain is always authoritative.
                        json_log("manthana.oracle", "info", event="domain_query_hint_ignored",
                                 primary_domain=primary_domain.value, detected_domain=detected_domain.value,
                                 note="user_pill_takes_precedence", request_id=rid)
    
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
    
            use_rag = settings.ORACLE_USE_RAG
            strategies_for_progress = strategies if use_rag else []
    
            # Build parallel tasks (Meili/Qdrant/embed/SearXNG/PubMed/trials)
            tasks: Dict[str, Any] = {}
            client = getattr(request.app.state, "client", None)
            if client is None:
                client = httpx.AsyncClient(timeout=20.0)
    
            redis_cli = getattr(request.app.state, "redis", None)
    
            if use_rag and (SourceStrategy.MEILISEARCH in strategies or SourceStrategy.QDRANT in strategies):
                tasks["rag"] = _with_timeout(
                    _rag_search(rag_query, settings, client, rid),
                    {"meilisearch": [], "qdrant": []},
                    timeout=6.0,
                    source="rag",
                )
            if use_rag and SourceStrategy.SEARXNG in strategies:
                # Use shloka-focused query for Ayurveda to get classical text sources
                tasks["searxng"] = _with_timeout(
                    fetch_searxng(searxng_query, searxng_cat, "json", 1, settings.SEARXNG_URL, redis_cli),
                    {"results": []},
                    source="searxng",
                )
            # PubMed: allopathy-only (peer-reviewed Western medicine)
            if (
                use_rag
                and SourceStrategy.PUBMED in strategies
                and settings.ORACLE_ENABLE_PUBMED
                and effective_domain == MedicalDomain.ALLOPATHY
            ):
                pubmed_exp = expand_query(message, "allopathy")
                pubmed_query = pubmed_exp[1] if len(pubmed_exp) > 1 else message
                tasks["pubmed"] = _with_timeout(search_pubmed(pubmed_query, max_results=5), [], source="pubmed")
            # ClinicalTrials: allopathy + homeopathy (some homeopathy trials on CT.gov)
            if (
                use_rag
                and SourceStrategy.CLINICAL_TRIALS in strategies
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
    
            if use_rag:
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
            else:
                json_log("manthana.oracle", "info", event="chat_rag_disabled", request_id=rid)
                rag_result = {"meilisearch": [], "qdrant": []}
                web_raw = {"results": []}
                pubmed_articles = []
                trials_result = {"trials": []}
    
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
                intensity,
                persona,
                evidence,
                domain,
                context,
                sources=all_docs,
                is_emergency=is_emergency,
                primary_domain=primary_domain,
                search_priority_query=message,
            )
            if enable_web:
                if primary_domain == MedicalDomain.ALLOPATHY:
                    messages.append({
                        "role": "system",
                        "content": (
                            "WEB SEARCH ACTIVE: You have real-time web search enabled. "
                            "For any query requiring current, latest, or real-time medical information, "
                            "search the web and cite authoritative sources (WHO, NIH, PubMed, medical journals, "
                            "government health sites) with full URLs. Always provide source links for facts, "
                            "statistics, and recent medical developments. "
                            "When you use a web page, cite it inline as a markdown link "
                            "`[short site name](https://full-url)` so the app can list consulted pages at the end."
                        ),
                    })
                else:
                    messages.append({
                        "role": "system",
                        "content": (
                            "WEB SEARCH ACTIVE: Prefer sources aligned with the user's selected traditional system "
                            "(AYUSH, classical text repositories, WHO traditional medicine, peer-reviewed "
                            "ethnopharmacology). Do not treat Western cosmetic/pharma marketing pages as the primary "
                            "authority when the UI domain is not allopathy. "
                            "Cite each web page you use as a markdown link `[short site name](https://full-url)` "
                            "so consulted URLs can be listed for the user."
                        ),
                    })
            for h in payload.history[-10:]:
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
    
            # Always use primary_domain (user's pill selection) for web search — never
            # the auto-detected effective_domain, which only diverges from primary when
            # the user is on Allopathy but the query contains traditional-medicine keywords.
            # Using effective_domain here caused a split: Allopathy system prompt + Ayurveda
            # web-search allowlist, producing contradictory LLM behaviour.
            web_search_parameters: Optional[Dict[str, Any]] = (
                build_openrouter_web_search_parameters(primary_domain.value, query=message)
                if enable_web
                else None
            )
            if web_search_parameters:
                json_log(
                    "manthana.oracle",
                    "info",
                    event="openrouter_web_search_tool",
                    domain=effective_domain.value,
                    engine=web_search_parameters.get("engine"),
                    allowed_domains_n=len(web_search_parameters.get("allowed_domains", []) or []),
                    request_id=rid,
                )
    
            if settings.ORACLE_USE_FREE_MODELS:
                chat_role = "oracle_chat_free"
            elif is_emergency:
                chat_role = "oracle_chat"
            elif (intensity or "auto") == "quick":
                chat_role = "oracle_chat_shallow"
            else:
                chat_role = "oracle_chat"
    
            async def stream_generator():
                async for chunk in _oracle_llm_stream(
                    settings,
                    messages,
                    rid,
                    sources_for_stream,
                    strategies_for_progress,
                    is_emergency=is_emergency,
                    web_search_parameters=web_search_parameters,
                    enable_web=enable_web,
                    chat_role=chat_role,
                ):
                    yield chunk
    
            return StreamingResponse(
                stream_generator(),
                media_type="text/event-stream",
                headers={"X-Request-ID": rid, "Cache-Control": "no-cache"},
            )

        except Exception as exc:
            json_log(
                "manthana.oracle",
                "error",
                event="chat_handler_unhandled",
                error=str(exc),
                request_id=rid,
            )

            async def err_stream():
                yield _sse_error_event(
                    "chat_internal_error",
                    "The chat service hit an unexpected error. Please try again.",
                )
                yield _sse_event({"type": "done"})

            return StreamingResponse(
                err_stream(),
                media_type="text/event-stream",
                headers={"X-Request-ID": rid, "Cache-Control": "no-cache"},
            )

    return router
