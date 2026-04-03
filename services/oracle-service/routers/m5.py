"""
m5.py — Oracle M5 Router
=========================
M5 five-domain streaming endpoint using m5_engine for parallel answers
from all 5 medical systems with per-domain RAG (MeiliSearch + Qdrant).
Implements ORACLE_SERVICE_FIX_PLAN.md Phase C.
"""

from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, Dict, List

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from config import OracleSettings, get_oracle_settings
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


logger = logging.getLogger("manthana.oracle.m5")

# Lib imports (m5_engine, domain_intelligence, etc.)
_M5_ENGINE_AVAILABLE = False
try:
    from m5_engine import build_m5_response_from_parts, stream_m5_response
    from domain_intelligence import (
        MedicalDomain,
        expand_query_for_domain,
        get_domain_system_prompt,
        get_domain_trust_boost,
    )
    from source_router import SourceStrategy
    from clinical_trials import fetch_clinical_trials_gov
    from pubmed_client import search_pubmed
    from query_intelligence import expand_query
    _M5_ENGINE_AVAILABLE = True
except ImportError as e:
    json_log("manthana.oracle", "warning", event="m5_engine_unavailable", error=str(e))


# ── Models ───────────────────────────────────────────────────────────

class M5Request(BaseModel):
    message: str
    history: List[Dict[str, str]] = Field(default_factory=list)
    lang: str = Field(default="en")


# ── RAG Helpers (reuse chat logic) ────────────────────────────────────

async def _query_meilisearch(query: str, settings: OracleSettings, client: httpx.AsyncClient, rid: str) -> List[Dict]:
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
        json_log("manthana.oracle", "warning", event="m5_meilisearch_error", error=str(exc), request_id=rid)
    return []


async def _generate_embedding(text: str, settings: OracleSettings, client: httpx.AsyncClient) -> List[float]:
    try:
        resp = await client.post(
            f"{settings.ORACLE_EMBED_URL.rstrip('/')}/api/embeddings",
            json={"model": "nomic-embed-text", "prompt": text[:8000]},
            headers={"Content-Type": "application/json"},
            timeout=15.0,
        )
        resp.raise_for_status()
        emb = resp.json().get("embedding", [])
        if emb:
            return emb
    except Exception:
        pass
    return [0.0] * 768


async def _query_qdrant(query: str, settings: OracleSettings, client: httpx.AsyncClient, rid: str) -> List[Dict]:
    try:
        embedding = await _generate_embedding(query, settings, client)
        resp = await client.post(
            f"{settings.ORACLE_QDRANT_URL.rstrip('/')}/collections/{settings.ORACLE_QDRANT_COLLECTION}/points/search",
            json={"vector": embedding, "limit": 5, "with_payload": True},
            headers={"Content-Type": "application/json"},
        )
        if resp.status_code == 200:
            return [p.get("payload", {}) for p in resp.json().get("result", [])]
    except Exception as exc:
        json_log("manthana.oracle", "warning", event="m5_qdrant_error", error=str(exc), request_id=rid)
    return []


async def _rag_search(query: str, settings: OracleSettings, client: httpx.AsyncClient, rid: str) -> Dict[str, List]:
    meili, qdrant = await asyncio.gather(
        _query_meilisearch(query, settings, client, rid),
        _query_qdrant(query, settings, client, rid),
    )
    return {"meilisearch": meili, "qdrant": qdrant}


# ── LLM Helpers ────────────────────────────────────────────────────────

_GROQ_PLACEHOLDER = "your_groq_api_key_here"


def _get_groq_api_key(settings: OracleSettings) -> str:
    key = (settings.ORACLE_GROQ_API_KEY or "").strip()
    if not key or key == _GROQ_PLACEHOLDER or key.startswith("your_") or len(key) < 20:
        return ""
    return key


async def _query_domain_llm_async(
    settings: OracleSettings,
    domain: MedicalDomain,
    message: str,
    sources: List[Dict[str, Any]],
    rid: str,
) -> tuple[MedicalDomain, str, List[Dict[str, Any]]]:
    """Query LLM for a single domain using AsyncGroq."""
    api_key = _get_groq_api_key(settings)
    domain_prompt = get_domain_system_prompt(domain)
    m5_appendix = """
You are answering in M5 (Five Domain) mode. The user will see your response alongside answers from 4 other medical systems. Provide a comprehensive answer from YOUR domain perspective, emphasizing what makes your system unique. Keep it informative but concise (300-500 words) for comparison purposes.
"""
    messages = [
        {"role": "system", "content": domain_prompt + m5_appendix},
        {"role": "user", "content": message},
    ]
    if not api_key:
        return domain, f"[{domain.value.upper()}] Response unavailable - API key not configured.", sources
    try:
        from groq import AsyncGroq
        client = AsyncGroq(api_key=api_key)
        completion = await client.chat.completions.create(
            model=settings.ORACLE_GROQ_MODEL,
            messages=messages,
            max_completion_tokens=600,
            temperature=0.1,
        )
        content = completion.choices[0].message.content or ""
        return domain, content, sources
    except Exception as exc:
        json_log("manthana.oracle", "error", event="m5_domain_llm_error", domain=domain.value, error=str(exc), request_id=rid)
        return domain, f"[{domain.value.upper()}] Error: {str(exc)[:100]}", sources


# ── Router Factory ───────────────────────────────────────────────────

def create_m5_router(limiter) -> APIRouter:
    router = APIRouter(tags=["m5"])

    @router.post("/chat/m5")
    @limiter.limit("60/minute")
    async def m5_chat(
        request: Request,
        body: M5Request,
        settings: OracleSettings = Depends(get_oracle_settings),
    ):
        rid = getattr(request.state, "request_id", "unknown")
        message = body.message

        json_log("manthana.oracle", "info", event="m5_query_start", query=message[:100], request_id=rid)

        if not settings.ORACLE_ENABLE_M5:
            async def err_stream():
                yield 'data: {"error": "M5 mode disabled"}\n\n'
                yield 'data: {"type": "done"}\n\n'
            return StreamingResponse(err_stream(), media_type="text/event-stream")

        if not _M5_ENGINE_AVAILABLE:
            async def fallback_stream():
                yield 'data: {"error": "M5 engine not available"}\n\n'
                yield 'data: {"type": "done"}\n\n'
            return StreamingResponse(fallback_stream(), media_type="text/event-stream")

        client = getattr(request.app.state, "client", None)
        if client is None:
            client = httpx.AsyncClient(timeout=20.0)
        redis_cli = getattr(request.app.state, "redis", None)

        domains = [
            MedicalDomain.ALLOPATHY,
            MedicalDomain.AYURVEDA,
            MedicalDomain.HOMEOPATHY,
            MedicalDomain.SIDDHA,
            MedicalDomain.UNANI,
        ]

        async def query_single_domain(domain: MedicalDomain) -> tuple[MedicalDomain, str, List[Dict]]:
            expanded = expand_query_for_domain(message, domain)
            domain_query = expanded[-1] if len(expanded) > 1 else message
            rag_result = await _rag_search(domain_query, settings, client, rid)
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
            for doc in rag_result.get("qdrant", [])[:5]:
                url = doc.get("url", "")
                base_score = 85
                domain_boost = get_domain_trust_boost(domain, url)
                sources.append({
                    "title": doc.get("title", ""),
                    "url": url,
                    "trustScore": base_score + domain_boost,
                    "_source": "Qdrant",
                })
            if domain == MedicalDomain.ALLOPATHY:
                if settings.ORACLE_ENABLE_PUBMED:
                    pubmed_exp = expand_query(message, "allopathy")
                    pubmed_q = pubmed_exp[1] if len(pubmed_exp) > 1 else message
                    try:
                        articles = await search_pubmed(pubmed_q, max_results=3)
                        for art in articles:
                            sources.append({
                                "title": art.get("title", ""),
                                "url": art.get("url", ""),
                                "trustScore": 95,
                                "_source": "PubMed",
                            })
                    except Exception:
                        pass
                if settings.ORACLE_ENABLE_TRIALS:
                    try:
                        trials_res = await fetch_clinical_trials_gov(
                            message, filters={"status": "active"}, page_size=3, redis_client=redis_cli,
                        )
                        for t in trials_res.get("trials", [])[:3]:
                            sources.append({
                                "title": t.get("title", ""),
                                "url": t.get("url", ""),
                                "trustScore": 93,
                                "_source": "ClinicalTrials",
                            })
                    except Exception:
                        pass
            return await _query_domain_llm_async(settings, domain, message, sources, rid)

        domain_results = await asyncio.gather(*[query_single_domain(d) for d in domains])
        domain_contents = {r[0]: r[1] for r in domain_results}
        domain_sources = {r[0]: r[2] for r in domain_results}

        m5_response = build_m5_response_from_parts(message, domain_contents, domain_sources)
        domain_answers = m5_response.get_all_answers()
        integrative_summary = m5_response.integrative_summary

        async def stream_generator():
            async for chunk in stream_m5_response(message, domain_answers, integrative_summary):
                yield chunk

        return StreamingResponse(
            stream_generator(),
            media_type="text/event-stream",
            headers={"X-Request-ID": rid, "Cache-Control": "no-cache"},
        )

    return router
