"""
hybrid_research.py — GPT Researcher + SearXNG + LangGraph hybrid path
======================================================================
Web search via GPT Researcher's ``searx`` retriever (SEARX_URL).
Synthesis reuses orchestrator ``synthesize_research_report`` for JSON sections + grounding parity with legacy.
"""

from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Tuple, TypedDict
from urllib.parse import urlparse

import httpx

from config import ResearchSettings
from services.shared.domain_sources import SOURCE_SITE_FRAGMENT, get_sources_for_domains
from services.shared.models import DeepResearchRequest

logger = logging.getLogger("manthana.research.hybrid")

# GPT Researcher reads retriever/LLM config from os.environ — serialize hybrid runs per process.
_hybrid_lock: Optional[asyncio.Lock] = None


def _get_hybrid_lock() -> asyncio.Lock:
    global _hybrid_lock
    if _hybrid_lock is None:
        _hybrid_lock = asyncio.Lock()
    return _hybrid_lock


def hybrid_dependencies_available() -> bool:
    try:
        import gpt_researcher  # noqa: F401
        import langgraph  # noqa: F401

        return True
    except ImportError:
        return False


async def check_searxng_reachable(url: str, timeout: float = 5.0) -> bool:
    base = (url or "").strip().rstrip("/")
    if not base:
        return False
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base}/", follow_redirects=True)
            return resp.status_code < 500
    except Exception as exc:
        logger.debug("searxng_probe_failed: %s", exc)
        return False


def hybrid_ready(settings: ResearchSettings) -> Tuple[bool, str]:
    if settings.RESEARCH_USE_LEGACY_RAG:
        return True, "legacy_rag_enabled"
    if not hybrid_dependencies_available():
        return False, "gpt_researcher_or_langgraph_import_failed"
    if not (settings.SEARXNG_URL or "").strip():
        return False, "searxng_url_not_configured"
    return True, "ok"


@contextmanager
def _gpt_researcher_env(settings: ResearchSettings, depth: str) -> Any:
    """Temporarily set process env for GPT Researcher (retriever, LLM, embedding)."""
    d = (depth or "comprehensive").lower().strip()
    if d == "focused":
        max_iter, max_search, total_words = 3, 4, 800
    elif d == "exhaustive":
        max_iter, max_search, total_words = 8, 12, 2500
    else:
        max_iter, max_search, total_words = 5, 8, 1400

    if settings.RESEARCH_HYBRID_MAX_STEPS > 0:
        max_iter = settings.RESEARCH_HYBRID_MAX_STEPS

    searx = (settings.SEARXNG_URL or "").strip().rstrip("/") + "/"

    or_key = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    or_key_2 = (settings.OPENROUTER_API_KEY_2 or os.environ.get("OPENROUTER_API_KEY_2") or "").strip()
    api_key = or_key if (or_key and len(or_key) >= 8) else or_key_2

    llm = (settings.RESEARCH_GR_LLM or "openrouter:deepseek/deepseek-chat").strip()
    emb = (settings.RESEARCH_GR_EMBEDDING or "openrouter:openai/text-embedding-3-small").strip()

    updates: Dict[str, str] = {
        "RETRIEVER": "searx",
        "SEARX_URL": searx,
        "FAST_LLM": llm,
        "SMART_LLM": llm,
        "STRATEGIC_LLM": llm,
        "EMBEDDING": emb,
        "MAX_ITERATIONS": str(max_iter),
        "MAX_SEARCH_RESULTS_PER_QUERY": str(max_search),
        "TOTAL_WORDS": str(total_words),
    }
    if api_key:
        updates["OPENROUTER_API_KEY"] = api_key

    ollama_base = (settings.RESEARCH_EMBED_URL or settings.RESEARCH_OLLAMA_URL or "").strip().rstrip("/")
    if ollama_base and emb.lower().startswith("ollama:"):
        updates["OLLAMA_BASE_URL"] = ollama_base

    saved: Dict[str, Optional[str]] = {}
    try:
        for k, v in updates.items():
            saved[k] = os.environ.get(k)
            os.environ[k] = v
        yield
    finally:
        for k, old in saved.items():
            if old is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old


def _openrouter_key(settings: ResearchSettings) -> str:
    k1 = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    k2 = (settings.OPENROUTER_API_KEY_2 or os.environ.get("OPENROUTER_API_KEY_2") or "").strip()
    if k1 and len(k1) >= 8:
        return k1
    if k2 and len(k2) >= 8:
        return k2
    return ""


def _domain_source_pills(domains: List[str], sources_filter: List[str]) -> List[str]:
    auto = get_sources_for_domains(domains)
    if not sources_filter:
        return auto
    filt = set(sources_filter)
    return [s for s in auto if s in filt]


def _site_fragments_for_pills(pills: List[str]) -> str:
    parts: List[str] = []
    for p in pills:
        frag = SOURCE_SITE_FRAGMENT.get(p)
        if frag:
            parts.append(f"({frag})")
    if not parts:
        return ""
    return " OR ".join(parts)


def _build_augmented_query(
    question: str,
    domain_id: str,
    subdomain_map: Dict[str, List[str]],
    sources_filter: List[str],
) -> str:
    doms = [domain_id] if domain_id else []
    pills = _domain_source_pills(doms, sources_filter)
    frag = _site_fragments_for_pills(pills)
    subs = subdomain_map.get(domain_id) or []
    bits = [question.strip()]
    if subs:
        bits.append("Focus areas: " + ", ".join(subs))
    if frag:
        bits.append("Prefer sources matching: " + frag)
    return "\n\n".join(bits)


def _gr_sources_to_merged(sources: List[Dict[str, Any]], tradition: str) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for i, s in enumerate(sources or []):
        if not isinstance(s, dict):
            continue
        url = (s.get("url") or "").strip()
        key = url or f"idx-{i}"
        if key in seen:
            continue
        seen.add(key)
        title = (s.get("title") or "").strip() or (urlparse(url).netloc if url else f"Source {i+1}")
        content = (s.get("content") or s.get("raw_content") or "")[:2000]
        out.append(
            {
                "title": title,
                "content": content,
                "url": url or None,
                "source": tradition or "gpt-researcher",
            }
        )
    return out


def _dedupe_merged(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for d in docs:
        u = (d.get("url") or "") + "\0" + (d.get("title") or "")
        if u in seen:
            continue
        seen.add(u)
        out.append(d)
    return out


async def _conduct_research_with_env(query: str, tradition: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Assume _gpt_researcher_env + lock already held."""
    from gpt_researcher import GPTResearcher
    from gpt_researcher.utils.enum import Tone

    logs: List[str] = []
    researcher = GPTResearcher(
        query=query,
        report_type="research_report",
        report_format="markdown",
        tone=Tone.Objective,
        verbose=False,
    )
    logs.append("GPT Researcher: conducting web research via SearXNG…")
    await researcher.conduct_research()
    raw = researcher.get_research_sources()
    merged = _gr_sources_to_merged(raw, tradition)
    logs.append(f"Retrieved {len(merged)} scraped sources.")
    return merged, logs


async def _collect_domain_sources(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    depth: str,
    log_fn: Optional[Callable[[str], None]] = None,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Sequential domain runs under one env + lock (GPT Researcher uses process env)."""
    domains = list(body.domains or [])
    if not domains:
        domains = ["allopathy"]
    sources_filter = list(body.sources or [])
    subdomain_map = dict(body.subdomain_map or {})
    question = body.question_text
    all_docs: List[Dict[str, Any]] = []
    all_logs: List[str] = []

    async with _get_hybrid_lock():
        with _gpt_researcher_env(settings, depth):
            for dom in domains:
                q = _build_augmented_query(question, dom, subdomain_map, sources_filter)
                try:
                    docs, lg = await _conduct_research_with_env(q, dom)
                    for d in docs:
                        d["source"] = dom
                    all_docs.extend(docs)
                    all_logs.extend(lg)
                    if log_fn:
                        for line in lg:
                            log_fn(line)
                        log_fn(f"Completed domain: {dom} ({len(docs)} sources).")
                except Exception as exc:
                    msg = f"Domain {dom} research failed: {exc!s}"
                    logger.warning(msg, exc_info=True)
                    all_logs.append(msg)
                    if log_fn:
                        log_fn(msg)

    return _dedupe_merged(all_docs), all_logs


def _hybrid_timeout_sec(settings: ResearchSettings, body: DeepResearchRequest, budget_timeout: float) -> float:
    if settings.RESEARCH_HYBRID_TIMEOUT_SECONDS and settings.RESEARCH_HYBRID_TIMEOUT_SECONDS > 0:
        return float(settings.RESEARCH_HYBRID_TIMEOUT_SECONDS)
    ts = getattr(body, "target_seconds", None)
    if ts is not None and ts > 0:
        return min(float(budget_timeout), float(ts))
    return float(budget_timeout)


def hybrid_pipeline_timeout(settings: ResearchSettings, body: DeepResearchRequest) -> float:
    """Wall-clock cap for hybrid path (stream + sync). Lazy-imports orchestrator depth helpers."""
    from orchestrator import _depth_config, _effective_total_timeout

    depth = (body.depth or "comprehensive").strip()
    budget = _depth_config(depth)
    base = _effective_total_timeout(budget, getattr(body, "target_seconds", None))
    return _hybrid_timeout_sec(settings, body, base)


class _GraphState(TypedDict, total=False):
    merged_docs: List[Dict[str, Any]]
    research_logs: List[str]
    sections: List[Dict[str, Any]]
    followup_questions: List[str]
    citations: List[Dict[str, Any]]
    provider_used: str
    error: str


async def _langgraph_run_hybrid(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
    merged_seed: List[Dict[str, Any]],
    use_deep: bool,
    log_fn: Optional[Callable[[str], None]] = None,
) -> _GraphState:
    from langgraph.graph import END, StateGraph

    depth = (body.depth or "comprehensive").strip()
    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    subdomain_map = dict(body.subdomain_map or {})
    intent = (body.intent or "clinical").strip()
    output_format = (body.output_format or "structured").lower()
    citation_style = (body.citation_style or "vancouver").lower()
    lang = (body.lang or "en").strip()

    async def node_collect(state: _GraphState) -> _GraphState:
        merged, logs = await _collect_domain_sources(body, settings, depth, log_fn=log_fn)
        return {"merged_docs": merged, "research_logs": logs}

    async def node_synthesize(state: _GraphState) -> _GraphState:
        merged = state.get("merged_docs") or merged_seed
        from orchestrator import _apply_scoring_and_cap, _depth_config, synthesize_research_report

        budget = _depth_config(depth)
        total_cap = int(budget["total_cap"])
        merged2, _ = _apply_scoring_and_cap(merged, body.question_text, domains, use_deep, total_cap)
        sections, followup, citations, provider_used = await synthesize_research_report(
            body.question_text,
            domains,
            subdomains,
            subdomain_map,
            intent,
            depth,
            merged2,
            output_format,
            citation_style,
            lang,
            settings,
            request_id,
            use_deep=use_deep,
            log_callback=log_fn,
        )
        return {
            "sections": sections,
            "followup_questions": followup,
            "citations": citations,
            "provider_used": provider_used,
        }

    graph = StateGraph(_GraphState)
    graph.add_node("collect", node_collect)
    graph.add_node("synthesize", node_synthesize)
    graph.set_entry_point("collect")
    graph.add_edge("collect", "synthesize")
    graph.add_edge("synthesize", END)
    app = graph.compile()
    initial: _GraphState = {"merged_docs": merged_seed, "research_logs": []}
    return await app.ainvoke(initial)


async def run_hybrid_research(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
) -> Dict[str, Any]:
    ready, reason = hybrid_ready(settings)
    t0 = time.monotonic()
    question = body.question_text
    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    intent = (body.intent or "clinical").strip()
    depth = (body.depth or "comprehensive").strip()
    dpt = depth.lower().strip()
    use_deep = False if dpt == "focused" else (body.deep if body.deep is not None else True)
    citation_style = (body.citation_style or "vancouver").lower()
    lang = (body.lang or "en").strip()

    if not question:
        return _empty_result(question, domains, subdomains, intent, citation_style, time.monotonic() - t0)

    if not ready:
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {
                    "id": "error",
                    "title": "Hybrid research unavailable",
                    "content": f"Hybrid mode is not ready ({reason}). Enable legacy RAG or fix configuration.",
                }
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }

    if not await check_searxng_reachable((settings.SEARXNG_URL or "").strip()):
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {
                    "id": "error",
                    "title": "SearXNG unreachable",
                    "content": (
                        f"SearXNG at {settings.SEARXNG_URL!r} did not respond. "
                        "Start SearXNG or set RESEARCH_USE_LEGACY_RAG=true."
                    ),
                }
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }

    if not _openrouter_key(settings) and not (settings.RESEARCH_OLLAMA_URL or "").strip():
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {
                    "id": "error",
                    "title": "LLM not configured",
                    "content": "Configure OPENROUTER_API_KEY or RESEARCH_OLLAMA_URL for hybrid research.",
                }
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }

    timeout_sec = hybrid_pipeline_timeout(settings, body)

    try:

        async def _pipe() -> Dict[str, Any]:
            final = await _langgraph_run_hybrid(
                body, settings, request_id, merged_seed=[], use_deep=use_deep, log_fn=None
            )
            merged = final.get("merged_docs") or []
            from evolution import record_lesson

            record_lesson(
                domains,
                intent,
                question[:200],
                "good" if len(merged) >= 3 else "degraded",
                {"hybrid": len(merged), "path": "hybrid"},
                notes="path=hybrid",
            )
            return {
                "query": question,
                "domains_consulted": domains,
                "subdomains_consulted": subdomains,
                "intent": intent,
                "sections": final.get("sections") or [],
                "citations": final.get("citations") or [],
                "sources_searched": len(merged),
                "time_taken_seconds": int(time.monotonic() - t0),
                "generated_at": _iso_now(),
                "integrative_mode": len(domains) >= 2,
                "followup_questions": final.get("followup_questions") or [],
                "citation_style": citation_style,
                "provider_used": final.get("provider_used") or "",
            }

        return await asyncio.wait_for(_pipe(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        logger.warning("hybrid_research_timeout", extra={"request_id": request_id})
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {
                    "id": "timeout",
                    "title": "Time limit reached",
                    "content": f"Hybrid research exceeded the time budget ({timeout_sec:.0f}s).",
                }
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }
    except Exception as exc:
        logger.exception("hybrid_research_error", extra={"request_id": request_id})
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {"id": "error", "title": "Hybrid research error", "content": str(exc)},
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }


def _empty_result(
    question: str,
    domains: List[str],
    subdomains: List[str],
    intent: str,
    citation_style: str,
    elapsed: float,
) -> Dict[str, Any]:
    return {
        "query": question,
        "domains_consulted": domains,
        "subdomains_consulted": subdomains,
        "intent": intent,
        "sections": [{"id": "error", "title": "Invalid request", "content": "Missing query text."}],
        "citations": [],
        "sources_searched": 0,
        "time_taken_seconds": int(elapsed),
        "generated_at": _iso_now(),
        "integrative_mode": len(domains) >= 2,
        "followup_questions": [],
        "citation_style": citation_style,
        "provider_used": "",
    }


def _iso_now() -> str:
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


async def _yield_section_events(payload: Dict[str, Any], elapsed: float, request_id: str, citation_style: str) -> AsyncIterator[Dict[str, Any]]:
    for sec in payload.get("sections") or []:
        yield {
            "type": "section",
            "id": sec.get("id", "section"),
            "title": sec.get("title", "Section"),
            "content": sec.get("content", ""),
        }
    yield {"type": "citations", "data": payload.get("citations") or []}
    yield {"type": "followup", "questions": payload.get("followup_questions") or []}
    yield {
        "type": "done",
        "meta": {
            "sources_searched": payload.get("sources_searched", 0),
            "time_taken_seconds": int(elapsed),
            "integrative_mode": payload.get("integrative_mode", False),
            "request_id": request_id,
            "citation_style": citation_style,
            "provider_used": payload.get("provider_used") or "",
        },
    }


async def stream_hybrid_research_events(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
    timeout_sec: float,
) -> AsyncIterator[Dict[str, Any]]:
    t0 = time.monotonic()
    question = body.question_text
    citation_style = (body.citation_style or "vancouver").lower()
    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    intent = (body.intent or "clinical").strip()
    depth = (body.depth or "comprehensive").strip()
    dpt = depth.lower().strip()
    use_deep = False if dpt == "focused" else (body.deep if body.deep is not None else True)

    ready, reason = hybrid_ready(settings)

    if not question:
        yield {"type": "error", "message": "Missing query text."}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": 0,
                "integrative_mode": False,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
        return

    yield {"type": "log", "text": "Starting Manthana Deep Research (hybrid: GPT Researcher + SearXNG)…"}

    if not ready:
        yield {"type": "log", "text": f"Hybrid not ready: {reason}"}
        yield {"type": "error", "message": f"Hybrid unavailable: {reason}"}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(domains) >= 2,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
        return

    if not await check_searxng_reachable((settings.SEARXNG_URL or "").strip()):
        yield {"type": "error", "message": "SearXNG unreachable"}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(domains) >= 2,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
        return

    log_lines: List[str] = []

    def log_cb(msg: str) -> None:
        log_lines.append(msg)

    try:
        final = await asyncio.wait_for(
            _langgraph_run_hybrid(
                body,
                settings,
                request_id,
                merged_seed=[],
                use_deep=use_deep,
                log_fn=log_cb,
            ),
            timeout=timeout_sec,
        )
        for line in log_lines:
            yield {"type": "log", "text": line}
        merged = final.get("merged_docs") or []
        yield {"type": "log", "text": f"Merged {len(merged)} unique sources for synthesis."}

        from evolution import record_lesson

        record_lesson(
            domains,
            intent,
            question[:200],
            "good" if len(merged) >= 3 else "degraded",
            {"hybrid": len(merged), "path": "hybrid"},
            notes="path=hybrid",
        )

        elapsed = time.monotonic() - t0
        payload = {
            "sections": final.get("sections") or [],
            "citations": final.get("citations") or [],
            "followup_questions": final.get("followup_questions") or [],
            "sources_searched": len(merged),
            "integrative_mode": len(domains) >= 2,
            "provider_used": final.get("provider_used") or "",
        }
        async for ev in _yield_section_events(payload, elapsed, request_id, citation_style):
            yield ev
    except asyncio.TimeoutError:
        yield {"type": "error", "message": f"Research exceeded time budget ({timeout_sec:.0f}s)."}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(domains) >= 2,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
    except Exception as exc:
        logger.exception("hybrid_stream_error", extra={"request_id": request_id})
        yield {"type": "error", "message": str(exc)}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(domains) >= 2,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
