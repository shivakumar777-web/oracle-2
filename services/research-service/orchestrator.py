"""
orchestrator.py — Deep Research orchestration (Phase 1)
========================================================
Ports RAG + prompt shaping from ai-router into research-service.
Respects: domains, subdomains, intent, depth, sources[], output_format,
citation_style, lang. Isolated — no imports from oracle/web/analysis.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
import time
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Sequence, Tuple

import httpx

from citation_grounding import (
    apply_grounded_citations_to_sections,
    build_grounded_citations,
    extract_cited_indices,
)
from config import ResearchSettings
from evolution import format_lessons_for_prompt, load_lessons, record_lesson
from llm_router import llm_with_fallback
from planner import decompose_query
from reflection import filter_low_quality, score_sources
from services.shared.domain_sources import SOURCE_SITE_FRAGMENT, get_sources_for_domains
from services.shared.models import DeepResearchRequest
from services.shared.circuit_breaker import CircuitBreakerError, circuit, get_circuit_breaker

logger = logging.getLogger("manthana.research.orchestrator")

# ── Constants (aligned with ai-router) ─────────────────────────────
_EMBEDDING_DIM = 768
_EMBEDDING_MODEL = "nomic-embed-text"
_EMBED_MAX_CHARS = 2000
_RAG_SNIPPET_CHARS = 800

# Depth → budgets (per plan §5.3)
_DEPTH_BUDGET: Dict[str, Dict[str, Any]] = {
    "focused": {
        "per_connector": 3,
        "perplexica_mode": "speed",
        "total_cap": 8,
        "timeout": 15.0,
        "searxng_limit": 4,
    },
    "comprehensive": {
        "per_connector": 5,
        "perplexica_mode": "balanced",
        "total_cap": 15,
        "timeout": 35.0,
        "searxng_limit": 8,
    },
    "exhaustive": {
        "per_connector": 8,
        "perplexica_mode": "quality",
        "total_cap": 25,
        "timeout": 75.0,
        "searxng_limit": 12,
    },
}

# ═══════════════════════════════════════════════════════════════════════
#  CIRCUIT BREAKERS — Per-connector resilience (production-ready)
# ═══════════════════════════════════════════════════════════════════════
# Each connector gets its own circuit breaker for graceful degradation.
# If a service fails repeatedly, we skip it rather than failing the whole query.

research_meilisearch_circuit = get_circuit_breaker(
    "research_meilisearch", failure_threshold=5, recovery_timeout=30.0
)
research_qdrant_circuit = get_circuit_breaker(
    "research_qdrant", failure_threshold=5, recovery_timeout=30.0
)
research_perplexica_circuit = get_circuit_breaker(
    "research_perplexica", failure_threshold=5, recovery_timeout=45.0
)
research_searxng_circuit = get_circuit_breaker(
    "research_searxng", failure_threshold=10, recovery_timeout=30.0
)
research_pubmed_circuit = get_circuit_breaker(
    "research_pubmed", failure_threshold=5, recovery_timeout=60.0
)
research_clinicaltrials_circuit = get_circuit_breaker(
    "research_clinicaltrials", failure_threshold=5, recovery_timeout=60.0
)

# Intent modifiers (mirrors frontend deep-research-config.ts)
INTENT_MODIFIERS: Dict[str, str] = {
    "clinical": (
        "Focus on clinical evidence, patient outcomes, treatment protocols, and current guidelines. "
        "Include level of evidence grading (Oxford LOE / GRADE) where appropriate."
    ),
    "thesis": (
        "Structure the output as a thesis-ready literature review with: Abstract, Introduction, "
        "Review of Literature, Discussion, Conclusion, and full bibliographic references in the chosen citation style."
    ),
    "systematic-review": (
        "Follow PRISMA guidelines. Include PICO framework analysis, search strategy, inclusion/exclusion criteria, "
        "study quality assessment, and evidence synthesis with heterogeneity analysis where applicable."
    ),
    "drug-herb-research": (
        "Include detailed pharmacology: molecular mechanisms, pharmacokinetics, pharmacodynamics, "
        "known interactions, contraindications, and dosage evidence. For herbs, include phytochemical constituents."
    ),
    "case-report": (
        "Follow CARE guidelines for case reporting. Structure: Title, Abstract, Introduction, Patient Information, "
        "Clinical Findings, Diagnostic Assessment, Therapeutic Intervention, Follow-up, Discussion, Conclusions."
    ),
    "comparative": (
        "Explicitly analyse the topic through all selected medical traditions in parallel. "
        "Identify convergence, divergence, and opportunities for integrative medicine."
    ),
}

OUTPUT_FORMAT_INSTRUCTIONS: Dict[str, str] = {
    "structured": (
        "Return JSON with exactly these section ids and titles: "
        "summary (Research Summary), findings (Key Findings), clinical (Clinical Evidence), "
        "traditional (Traditional Correlation), integrative (Integrative Synthesis), gaps (Research Gaps)."
    ),
    "summary": (
        "Return JSON with a single section id \"summary\" titled \"Research Summary\" containing "
        "a concise research summary in 3–5 paragraphs with citations [n]."
    ),
    "bullets": (
        "Return JSON with a single section id \"findings\" titled \"Key Findings\" containing "
        "a bulleted list of key points with citations [n]."
    ),
}

# When output_format is \"structured\", section ids must match the intent-specific template (Phase 3.3).
STRUCTURED_FORMAT_BY_INTENT: Dict[str, str] = {
    "clinical": OUTPUT_FORMAT_INSTRUCTIONS["structured"],
    "thesis": (
        "Return JSON with exactly these section ids and titles: "
        "abstract (Abstract), introduction (Introduction), literature (Review of Literature), "
        "discussion (Discussion), conclusion (Conclusion). "
        "Literature section must synthesize retrieved sources with [n] citations; other sections follow academic thesis norms."
    ),
    "systematic-review": (
        "Return JSON with exactly these section ids and titles: "
        "background (Background), methods (Methods (PRISMA)), results (Results), "
        "quality (Quality Assessment), synthesis (Evidence Synthesis), gaps (Gaps & Limitations). "
        "Methods must describe PICO, search strategy, inclusion/exclusion, and PRISMA-style flow in prose; "
        "Results and synthesis must reference retrieved studies with [n] citations."
    ),
    "case-report": (
        "Return JSON with exactly these section ids and titles: "
        "introduction (Introduction), patient (Patient Information), findings (Clinical Findings), "
        "assessment (Diagnostic Assessment), intervention (Therapeutic Intervention), "
        "followup (Follow-up), discussion (Discussion). "
        "Follow CARE-style narrative: de-identified patient details, timeline, and evidence-backed discussion with [n] citations."
    ),
    "drug-herb-research": OUTPUT_FORMAT_INSTRUCTIONS["structured"],
    "comparative": OUTPUT_FORMAT_INSTRUCTIONS["structured"],
}

# Section JSON templates vary by output_format + intent (systematic-review / thesis / case-report)
SECTIONS_JSON_STRUCTURED = """{{
  "sections": [
    {{ "id": "summary", "title": "Research Summary", "content": "..." }},
    {{ "id": "findings", "title": "Key Findings", "content": "..." }},
    {{ "id": "clinical", "title": "Clinical Evidence", "content": "..." }},
    {{ "id": "traditional", "title": "Traditional Correlation", "content": "..." }},
    {{ "id": "integrative", "title": "Integrative Synthesis", "content": "..." }},
    {{ "id": "gaps", "title": "Research Gaps", "content": "..." }}
  ]
}}"""

SECTIONS_JSON_THESIS = """{{
  "sections": [
    {{ "id": "abstract", "title": "Abstract", "content": "..." }},
    {{ "id": "introduction", "title": "Introduction", "content": "..." }},
    {{ "id": "literature", "title": "Review of Literature", "content": "..." }},
    {{ "id": "discussion", "title": "Discussion", "content": "..." }},
    {{ "id": "conclusion", "title": "Conclusion", "content": "..." }}
  ]
}}"""

SECTIONS_JSON_PRISMA = """{{
  "sections": [
    {{ "id": "background", "title": "Background", "content": "..." }},
    {{ "id": "methods", "title": "Methods (PRISMA)", "content": "..." }},
    {{ "id": "results", "title": "Results", "content": "..." }},
    {{ "id": "quality", "title": "Quality Assessment", "content": "..." }},
    {{ "id": "synthesis", "title": "Evidence Synthesis", "content": "..." }},
    {{ "id": "gaps", "title": "Gaps & Limitations", "content": "..." }}
  ]
}}"""

SECTIONS_JSON_CASE = """{{
  "sections": [
    {{ "id": "introduction", "title": "Introduction", "content": "..." }},
    {{ "id": "patient", "title": "Patient Information", "content": "..." }},
    {{ "id": "findings", "title": "Clinical Findings", "content": "..." }},
    {{ "id": "assessment", "title": "Diagnostic Assessment", "content": "..." }},
    {{ "id": "intervention", "title": "Therapeutic Intervention", "content": "..." }},
    {{ "id": "followup", "title": "Follow-up", "content": "..." }},
    {{ "id": "discussion", "title": "Discussion", "content": "..." }}
  ]
}}"""

# Single-section modes must match OUTPUT_FORMAT_INSTRUCTIONS (summary / bullets).
SECTIONS_JSON_SUMMARY_ONLY = """{{
  "sections": [
    {{ "id": "summary", "title": "Research Summary", "content": "..." }}
  ]
}}"""

SECTIONS_JSON_BULLETS_ONLY = """{{
  "sections": [
    {{ "id": "findings", "title": "Key Findings", "content": "..." }}
  ]
}}"""

CITATION_STYLE_INSTRUCTIONS: Dict[str, str] = {
    "vancouver": "Use Vancouver-style numeric citations in text as [1], [2]. List references in order of appearance.",
    "numeric": "Use numeric citation markers [1], [2] matching the numbered source index.",
    "apa": "When citing in prose, follow APA 7 author–date patterns; keep [n] markers tied to the source index list.",
    "harvard": "Use author–date patterns consistent with Harvard referencing; keep [n] tied to the source index.",
    "mla": "Use MLA conventions where appropriate; keep [n] tied to the source index.",
    "icmr": "Follow ICMR / Indian medical referencing norms; keep [n] tied to the source index.",
}

# SOURCE_SITE_FRAGMENT, DOMAIN_AUTO_SOURCES, INTEGRATIVE_CROSS_DOMAIN_CORE →
# services.shared.domain_sources (single source of truth; Gap 3).

DOMAIN_QUERY_TEMPLATES: Dict[str, str] = {
    "allopathy": "{query} clinical evidence pharmacology treatment",
    "ayurveda": "{query} Ayurvedic traditional medicine herb formulation",
    "homeopathy": "{query} homeopathic remedy potency materia medica",
    "siddha": "{query} Siddha Tamil traditional medicine thiraviyam",
    "unani": "{query} Unani tibb hakeem mizaj ilaj",
}


def build_domain_query(base_query: str, domains: List[str]) -> str:
    """Domain-aware query expansion for core connectors (not PubMed / scoped SearXNG)."""
    if not domains:
        return base_query
    if len(domains) == 1:
        template = DOMAIN_QUERY_TEMPLATES.get(domains[0], "{query}")
        return template.format(query=base_query)
    domain_terms: List[str] = []
    for d in domains:
        template = DOMAIN_QUERY_TEMPLATES.get(d, "")
        if template:
            suffix = template.replace("{query}", "").strip()
            if suffix:
                domain_terms.append(suffix)
    return f"{base_query} {' '.join(domain_terms[:3])}"


def format_subdomain_context(
    domains: List[str],
    subdomain_map: Dict[str, List[str]],
    subdomains_flat: List[str],
) -> str:
    """Structured subdomain lines per domain, or flat fallback."""
    if subdomain_map:
        lines: List[str] = ["Domain-specific focus areas:"]
        labels: Dict[str, str] = {
            "allopathy": "Allopathy",
            "ayurveda": "Ayurveda",
            "homeopathy": "Homeopathy",
            "siddha": "Siddha",
            "unani": "Unani",
        }
        for d in domains:
            subs = subdomain_map.get(d) or []
            if not subs:
                continue
            label = labels.get(d, d.replace("-", " ").title())
            human = ", ".join(s.replace("-", " ").title() for s in subs)
            lines.append(f"- {label}: {human}")
        if len(lines) > 1:
            return "\n".join(lines)
    if subdomains_flat:
        return f"Subdomains: {', '.join(subdomains_flat)}"
    return "No specific subdomain focus."


def _depth_config(depth: Optional[str]) -> Dict[str, Any]:
    d = (depth or "comprehensive").lower().strip()
    return _DEPTH_BUDGET.get(d, _DEPTH_BUDGET["comprehensive"])


def _effective_total_timeout(
    budget: Dict[str, Any],
    target_seconds: Optional[float],
) -> float:
    """Cap total pipeline time: depth budget + LLM headroom, optionally user target_seconds."""
    base = float(budget["timeout"]) + 120.0  # retrieval + Groq
    if target_seconds is not None and target_seconds > 0:
        return min(base, float(target_seconds))
    return base


def _any_llm_configured(settings: ResearchSettings) -> bool:
    import os

    k1 = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    k2 = (settings.OPENROUTER_API_KEY_2 or os.environ.get("OPENROUTER_API_KEY_2") or "").strip()
    return bool(
        (k1 and len(k1) >= 8)
        or (k2 and len(k2) >= 8)
        or (settings.RESEARCH_OLLAMA_URL or "").strip()
    )


def _format_sources_as_markdown(sources: List[Dict[str, Any]]) -> str:
    """Format retrieved sources as markdown when LLM synthesis is unavailable."""
    lines: List[str] = []
    for i, doc in enumerate(sources, 1):
        title = doc.get("title", "Untitled")
        url = doc.get("url", "")
        source = doc.get("source", "Unknown")
        content = doc.get("content", "")[:300]  # Truncate for readability
        lines.append(f"**{i}. {title}**")
        lines.append(f"   Source: {source}")
        if url:
            lines.append(f"   URL: {url}")
        if content:
            lines.append(f"   Preview: {content}...")
        lines.append("")
    return "\n".join(lines)


def _normalize_doc(raw: Dict[str, Any], connector: str) -> Dict[str, Any]:
    title = raw.get("title") or raw.get("name") or "Untitled"
    url = raw.get("url") or raw.get("link") or ""
    body = (
        raw.get("content")
        or raw.get("snippet")
        or raw.get("text")
        or raw.get("abstract")
        or ""
    )
    return {
        "title": str(title)[:500],
        "url": str(url)[:2000],
        "content": str(body)[:4000],
        "source": connector,
        "authors": str(raw.get("authors") or raw.get("author") or "")[:500],
        "year": raw.get("year") or raw.get("pubdate") or 0,
        "doi": raw.get("doi"),
        "pmid": str(raw.get("pmid") or raw.get("PMID") or "") or None,
    }


def merge_and_deduplicate(*lists: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    merged: List[Dict[str, Any]] = []
    for source_list in lists:
        for item in source_list:
            key = str(
                item.get("url")
                or item.get("pmid")
                or item.get("title")
                or id(item)
            )
            if key not in seen:
                seen.add(key)
                merged.append(item)
    return merged


async def _generate_embedding(
    text: str,
    embed_url: str,
    client: httpx.AsyncClient,
) -> List[float]:
    try:
        resp = await client.post(
            f"{embed_url.rstrip('/')}/api/embeddings",
            json={"model": _EMBEDDING_MODEL, "prompt": text[:_EMBED_MAX_CHARS]},
            headers={"Content-Type": "application/json"},
            timeout=15.0,
        )
        resp.raise_for_status()
        emb = resp.json().get("embedding", [])
        if emb:
            return emb
    except Exception as exc:
        logger.warning("embedding_fallback: %s", exc)
    return [0.0] * _EMBEDDING_DIM


async def query_meilisearch(
    query: str,
    settings: ResearchSettings,
    client: httpx.AsyncClient,
    limit: int,
) -> List[Dict[str, Any]]:
    base = (settings.RESEARCH_MEILISEARCH_URL or "").strip()
    if not base:
        return []
    key = settings.RESEARCH_MEILISEARCH_KEY or ""
    try:
        resp = await client.post(
            f"{base.rstrip('/')}/indexes/medical_search/search",
            json={"q": query, "limit": limit},
            headers={
                "X-Meili-API-Key": key,
                "Content-Type": "application/json",
            },
            timeout=12.0,
        )
        if resp.status_code == 200:
            hits = resp.json().get("hits", [])
            return [_normalize_doc(h, "meilisearch") for h in hits]
    except Exception as exc:
        logger.warning("meilisearch_error: %s", exc)
    return []


async def query_qdrant(
    query: str,
    settings: ResearchSettings,
    client: httpx.AsyncClient,
    limit: int,
    embed_url: str,
) -> List[Dict[str, Any]]:
    qurl = (settings.RESEARCH_QDRANT_URL or "").strip()
    if not qurl:
        return []
    col = settings.RESEARCH_QDRANT_COLLECTION or "medical_documents"
    try:
        emb = await _generate_embedding(query, embed_url, client)
        resp = await client.post(
            f"{qurl.rstrip('/')}/collections/{col}/points/search",
            json={"vector": emb, "limit": limit, "with_payload": True},
            headers={"Content-Type": "application/json"},
            timeout=20.0,
        )
        if resp.status_code == 200:
            points = resp.json().get("result", [])
            out = []
            for p in points:
                payload = p.get("payload") or {}
                out.append(_normalize_doc(payload, "qdrant"))
            return out
    except Exception as exc:
        logger.warning("qdrant_error: %s", exc)
    return []


async def query_perplexica(
    query: str,
    settings: ResearchSettings,
    optimization_mode: str,
    timeout: float,
) -> List[Dict[str, Any]]:
    purl = (
        (settings.RESEARCH_PERPLEXICA_URL or getattr(settings, "PERPLEXICA_URL", None) or "")
        .strip()
    )
    if not purl:
        return []
    try:
        async with httpx.AsyncClient(timeout=timeout) as pc:
            resp = await pc.post(
                f"{purl.rstrip('/')}/api/search",
                json={
                    "query": query,
                    "focusMode": "webSearch",
                    "optimizationMode": optimization_mode,
                },
            )
            if resp.status_code != 200:
                return []
            data = resp.json()
            srcs = data.get("sources") or []
            return [_normalize_doc(s, "perplexica") for s in srcs if isinstance(s, dict)]
    except Exception as exc:
        logger.warning("perplexica_error: %s", exc)
    return []


async def fetch_searxng_general(
    query: str,
    searxng_url: str,
    client: httpx.AsyncClient,
    limit: int,
) -> List[Dict[str, Any]]:
    params = {"q": query, "category": "general", "format": "json"}
    try:
        resp = await client.get(f"{searxng_url.rstrip('/')}/search", params=params, timeout=12.0)
        if resp.status_code == 200:
            results = resp.json().get("results", []) or []
            out = []
            for r in results[:limit]:
                if isinstance(r, dict):
                    out.append(
                        _normalize_doc(
                            {
                                "title": r.get("title"),
                                "url": r.get("url"),
                                "content": r.get("content", ""),
                            },
                            "searxng",
                        )
                    )
            return out
    except Exception as exc:
        logger.warning("searxng_general_error: %s", exc)
    return []


async def fetch_searxng_scoped(
    query: str,
    site_fragment: str,
    searxng_url: str,
    client: httpx.AsyncClient,
    limit: int,
) -> List[Dict[str, Any]]:
    q = f"{query} {site_fragment}".strip()
    params = {"q": q, "format": "json"}
    try:
        resp = await client.get(f"{searxng_url.rstrip('/')}/search", params=params, timeout=12.0)
        if resp.status_code == 200:
            results = resp.json().get("results", []) or []
            out = []
            for r in results[:limit]:
                if isinstance(r, dict):
                    out.append(
                        _normalize_doc(
                            {
                                "title": r.get("title"),
                                "url": r.get("url"),
                                "content": r.get("content", ""),
                            },
                            f"searxng:{site_fragment[:24]}",
                        )
                    )
            return out
    except Exception as exc:
        logger.warning("searxng_scoped_error: %s", exc)
    return []


async def query_pubmed(
    query: str,
    client: httpx.AsyncClient,
    max_results: int,
    api_key: str = "",
) -> List[Dict[str, Any]]:
    """NCBI E-utilities: esearch + esummary."""
    base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
    try:
        esearch_params = {
            "db": "pubmed",
            "term": query,
            "retmax": max_results,
            "retmode": "json",
        }
        if api_key:
            esearch_params["api_key"] = api_key
        r1 = await client.get(f"{base}/esearch.fcgi", params=esearch_params, timeout=15.0)
        if r1.status_code != 200:
            return []
        id_list = r1.json().get("esearchresult", {}).get("idlist") or []
        if not id_list:
            return []
        ids = ",".join(id_list[:max_results])
        esum_params = {"db": "pubmed", "id": ids, "retmode": "json"}
        if api_key:
            esum_params["api_key"] = api_key
        r2 = await client.get(f"{base}/esummary.fcgi", params=esum_params, timeout=15.0)
        if r2.status_code != 200:
            return []
        result = r2.json().get("result", {})
        uids = result.get("uids") or []
        out: List[Dict[str, Any]] = []
        for uid in uids:
            art = result.get(uid) or {}
            authors = ""
            if art.get("authors"):
                alist = art["authors"]
                if isinstance(alist, list) and alist:
                    authors = ", ".join(
                        a.get("name", "") for a in alist[:5] if isinstance(a, dict)
                    )
            title = art.get("title") or "Untitled"
            journal = art.get("fulljournalname") or art.get("source") or ""
            year = 0
            try:
                pubdate = art.get("pubdate") or ""
                m = re.search(r"(19|20)\d{2}", pubdate)
                if m:
                    year = int(m.group(0))
            except Exception:
                pass
            pmid = str(uid)
            url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}/"
            out.append(
                _normalize_doc(
                    {
                        "title": title,
                        "url": url,
                        "content": (art.get("elocationid") or "") + " " + journal,
                        "authors": authors,
                        "year": year,
                        "pmid": pmid,
                        "source": "PubMed",
                    },
                    "pubmed",
                )
            )
        return out
    except Exception as exc:
        logger.warning("pubmed_error: %s", exc)
    return []


async def query_clinical_trials(
    query: str,
    client: httpx.AsyncClient,
    max_results: int,
) -> List[Dict[str, Any]]:
    """ClinicalTrials.gov API v2."""
    try:
        params = {"query.term": query, "pageSize": max_results, "format": "json"}
        resp = await client.get(
            "https://clinicaltrials.gov/api/v2/studies",
            params=params,
            timeout=20.0,
        )
        if resp.status_code != 200:
            return []
        data = resp.json()
        studies = data.get("studies") or []
        out: List[Dict[str, Any]] = []
        for st in studies[:max_results]:
            if not isinstance(st, dict):
                continue
            proto = st.get("protocolSection") or {}
            ids = proto.get("identificationModule") or {}
            nct = ids.get("nctId") or ""
            title = ids.get("briefTitle") or "Clinical trial"
            status = (proto.get("statusModule") or {}).get("overallStatus") or ""
            url = f"https://clinicaltrials.gov/study/{nct}" if nct else ""
            out.append(
                _normalize_doc(
                    {
                        "title": title,
                        "url": url,
                        "content": f"Status: {status}. NCT: {nct}",
                        "authors": "ClinicalTrials.gov",
                        "year": 0,
                        "source": "ClinicalTrials.gov",
                    },
                    "clinicaltrials",
                )
            )
        return out
    except Exception as exc:
        logger.warning("clinicaltrials_error: %s", exc)
    return []


def _should_run_optional(sources: List[str], pill: str) -> bool:
    """If user selected no sources, enable all optional connectors (max coverage)."""
    if not sources:
        return True
    return pill in sources


def _sections_json_template(intent: str, output_format: str) -> str:
    if output_format == "summary":
        return SECTIONS_JSON_SUMMARY_ONLY
    if output_format == "bullets":
        return SECTIONS_JSON_BULLETS_ONLY
    if intent == "thesis":
        return SECTIONS_JSON_THESIS
    if intent == "systematic-review":
        return SECTIONS_JSON_PRISMA
    if intent == "case-report":
        return SECTIONS_JSON_CASE
    return SECTIONS_JSON_STRUCTURED


def _structured_output_instruction(intent: str) -> str:
    """Human-readable section contract for structured output (aligned with JSON template)."""
    key = (intent or "clinical").lower().strip()
    return STRUCTURED_FORMAT_BY_INTENT.get(key, STRUCTURED_FORMAT_BY_INTENT["clinical"])


def build_deep_research_prompt(
    question: str,
    domains: List[str],
    subdomains: List[str],
    subdomain_map: Dict[str, List[str]],
    intent: str,
    depth: str,
    context_text: str,
    sources_block: str,
    output_format: str,
    citation_style: str,
    lang: str,
    memory_block: str = "",
) -> Tuple[str, str]:
    """Returns (system_prompt, user_prompt)."""
    intent_key = (intent or "clinical").lower().strip()
    modifier = INTENT_MODIFIERS.get(intent_key, INTENT_MODIFIERS["clinical"])
    of = (output_format or "structured").lower().strip()
    if of == "structured":
        out_inst = _structured_output_instruction(intent_key)
    else:
        out_inst = OUTPUT_FORMAT_INSTRUCTIONS.get(of, OUTPUT_FORMAT_INSTRUCTIONS["structured"])
    style_key = (citation_style or "vancouver").lower().strip()
    cite_inst = CITATION_STYLE_INSTRUCTIONS.get(style_key, CITATION_STYLE_INSTRUCTIONS["vancouver"])
    sections_template = _sections_json_template(intent_key, of)

    sub_ctx = format_subdomain_context(domains, subdomain_map, subdomains)

    memory_section = ""
    if memory_block.strip():
        memory_section = f"\n\n## Research Memory\n{memory_block.strip()}"

    system_prompt = f"""You are Manthana Deep Research — a medical AI that synthesizes evidence across medical traditions.

Intent guidance:
{modifier}

Output format:
{out_inst}

Citation / referencing:
{cite_inst}

Language for prose: {lang or "en"}
{memory_section}

Respond with VALID JSON only — no markdown fences, no commentary outside JSON."""

    user_prompt = f"""Research question:
{question}

Selected domains: {", ".join(domains) or "general"}
{sub_ctx}
Research depth: {depth}

=== Retrieved evidence ===
{context_text}

=== Source index (cite as [1], [2], …) ===
{sources_block}

Produce a JSON object with this structure ONLY:
{sections_template}

Additionally include at the **top level** of the JSON object:
  "followup_questions": [ "question 1", "question 2", "question 3" ]
(exactly three short, specific follow-up questions a researcher might ask next, in language: {lang or "en"}.)

Rules:
- Use markdown inside each content string where helpful.
- Use numeric citation markers [1], [2] matching the source index above.
- If a section is not applicable, include it with a brief note.
- The output must be one JSON object with both "sections" and "followup_questions" keys."""

    return system_prompt, user_prompt


def parse_deep_research_sections(raw_answer: str) -> List[Dict[str, Any]]:
    try:
        parsed = json.loads(raw_answer)
        raw_sections = parsed.get("sections") or []
        sections: List[Dict[str, Any]] = []
        for s in raw_sections:
            if not isinstance(s, dict):
                continue
            title = s.get("title", "")
            content = s.get("content", "")
            if not content:
                continue
            sections.append(
                {
                    "id": s.get("id") or title.lower().replace(" ", "-") or "section",
                    "title": title or "Section",
                    "content": content,
                }
            )
        if sections:
            return sections
    except (json.JSONDecodeError, AttributeError, TypeError):
        pass
    # strip markdown code fence
    text = raw_answer.strip()
    if text.startswith("```"):
        text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
        text = re.sub(r"\n?```$", "", text)
        return parse_deep_research_sections(text)
    return [{"id": "summary", "title": "Research Summary", "content": raw_answer}]


def parse_full_research_response(raw_answer: str) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Parse LLM JSON with sections + followup_questions."""
    followup: List[str] = []
    try:
        text = raw_answer.strip()
        if text.startswith("```"):
            text = re.sub(r"^```[a-zA-Z]*\n?", "", text)
            text = re.sub(r"\n?```$", "", text)
        parsed = json.loads(text)
        raw_sections = parsed.get("sections") or []
        sections: List[Dict[str, Any]] = []
        for s in raw_sections:
            if not isinstance(s, dict):
                continue
            title = s.get("title", "")
            content = s.get("content", "")
            if not content:
                continue
            sections.append(
                {
                    "id": s.get("id") or title.lower().replace(" ", "-") or "section",
                    "title": title or "Section",
                    "content": content,
                }
            )
        fu = parsed.get("followup_questions")
        if isinstance(fu, list):
            followup = [str(x).strip() for x in fu if str(x).strip()][:3]
        if sections:
            return sections, followup
    except (json.JSONDecodeError, AttributeError, TypeError, ValueError):
        pass
    sec = parse_deep_research_sections(raw_answer)
    return sec, followup


def build_citations(docs: List[Dict[str, Any]], limit: int) -> List[Dict[str, Any]]:
    citations: List[Dict[str, Any]] = []
    for idx, doc in enumerate(docs[:limit], start=1):
        year = doc.get("year")
        try:
            y = int(year) if year else 0
        except (TypeError, ValueError):
            y = 0
        citations.append(
            {
                "id": idx,
                "authors": doc.get("authors") or "",
                "title": doc.get("title") or "Untitled",
                "journal": doc.get("source") or "",
                "year": y,
                "doi": doc.get("doi"),
                "pmid": doc.get("pmid"),
                "url": doc.get("url"),
            }
        )
    return citations


async def _retrieve_single(
    question_for_core: str,
    question_for_pubmed: str,
    question_for_scoped: str,
    settings: ResearchSettings,
    client: httpx.AsyncClient,
    budget: Dict[str, Any],
    effective_sources: List[str],
) -> List[Dict[str, Any]]:
    """One parallel retrieval round: core connectors use domain-rewritten query; PubMed raw; scoped SearXNG uses original."""
    per_n = int(budget["per_connector"])
    plex_mode = str(budget["perplexica_mode"])
    op_timeout = float(budget["timeout"])
    searx_limit = int(budget["searxng_limit"])
    embed_url = (settings.RESEARCH_EMBED_URL or "http://ollama:11434").strip()
    searxng = settings.SEARXNG_URL

    async def _meilisearch_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_meilisearch_circuit.call(
                query_meilisearch, question_for_core, settings, client, per_n
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: meilisearch skipped")
            return []

    async def _qdrant_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_qdrant_circuit.call(
                query_qdrant, question_for_core, settings, client, per_n, embed_url
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: qdrant skipped")
            return []

    async def _perplexica_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_perplexica_circuit.call(
                query_perplexica, question_for_core, settings, plex_mode, min(op_timeout, 30.0)
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: perplexica skipped")
            return []

    async def _searxng_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_searxng_circuit.call(
                fetch_searxng_general, question_for_core, searxng, client, searx_limit
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: searxng skipped")
            return []

    async def _pubmed_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_pubmed_circuit.call(
                query_pubmed, question_for_pubmed, client, min(per_n, 8), settings.RESEARCH_NCBI_API_KEY or ""
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: pubmed skipped")
            return []

    async def _clinicaltrials_wrapped() -> List[Dict[str, Any]]:
        try:
            return await research_clinicaltrials_circuit.call(
                query_clinical_trials, question_for_pubmed, client, min(per_n, 8)
            )
        except CircuitBreakerError:
            logger.warning("circuit_breaker_open: clinicaltrials skipped")
            return []

    core_tasks: List[Any] = [
        _meilisearch_wrapped(),
        _qdrant_wrapped(),
        _perplexica_wrapped(),
        _searxng_wrapped(),
    ]
    optional_tasks: List[Any] = []
    if _should_run_optional(effective_sources, "pubmed"):
        optional_tasks.append(_pubmed_wrapped())
    if _should_run_optional(effective_sources, "clinicaltrials"):
        optional_tasks.append(_clinicaltrials_wrapped())

    site_tasks: List[Any] = [
        fetch_searxng_scoped(question_for_scoped, frag, searxng, client, max(2, per_n // 2))
        for pill, frag in SOURCE_SITE_FRAGMENT.items()
        if _should_run_optional(effective_sources, pill)
    ]

    all_results = await asyncio.gather(
        *core_tasks,
        *optional_tasks,
        *site_tasks,
        return_exceptions=True,
    )

    parts: List[List[Dict[str, Any]]] = []
    for r in all_results:
        if isinstance(r, list):
            parts.append(r)
        elif isinstance(r, Exception):
            logger.debug("connector_exc: %s", r)

    return merge_and_deduplicate(*parts) if parts else []


async def retrieve_merged_sources(
    question: str,
    settings: ResearchSettings,
    client: httpx.AsyncClient,
    budget: Dict[str, Any],
    sources_filter: List[str],
    domains: Optional[List[str]] = None,
    subdomain_map: Optional[Dict[str, List[str]]] = None,
    depth: str = "comprehensive",
    intent: str = "clinical",
    use_decomposition: bool = True,
    original_question: Optional[str] = None,
    log_callback: Optional[Callable[[str], None]] = None,
    use_deep: bool = True,
) -> List[Dict[str, Any]]:
    """Parallel retrieval + merge + cap (shared by sync and streaming).

    Universal Search: empty ``sources_filter`` → auto-select pills from ``domains``.
    ``subdomain_map`` is reserved for domain-aware rewriting (Gap 7); currently
    influences query via ``domains`` only.
    """
    _ = subdomain_map  # explicit for future subdomain-specific retrieval

    dom = domains or []
    oq = (original_question or question).strip()

    def _log(msg: str) -> None:
        if log_callback:
            log_callback(msg)

    effective_sources = sources_filter
    if not sources_filter and dom:
        effective_sources = get_sources_for_domains(dom)
        logger.debug(
            "universal_search_auto_sources",
            extra={"domains": dom, "auto_sources": effective_sources},
        )

    core_q = build_domain_query(question, dom)
    _log(f"Domain-rewritten query: '{core_q[:100]}{'...' if len(core_q) > 100 else ''}'")

    decompose_ok = (
        use_deep
        and use_decomposition
        and (depth or "").lower() != "focused"
        and len(question.split()) > 6
    )

    if decompose_ok:
        _log("Decomposing research question into sub-queries…")
        sub_questions = await decompose_query(question, dom, intent, settings)
        round_parts: List[List[Dict[str, Any]]] = []
        for sq in sub_questions:
            cq = build_domain_query(sq, dom)
            one = await _retrieve_single(
                cq,
                sq,
                oq,
                settings,
                client,
                budget,
                effective_sources,
            )
            round_parts.append(one)
        merged = merge_and_deduplicate(*round_parts) if round_parts else []
    else:
        merged = await _retrieve_single(
            core_q,
            question,
            oq,
            settings,
            client,
            budget,
            effective_sources,
        )

    return merged


def _apply_scoring_and_cap(
    merged: List[Dict[str, Any]],
    question: str,
    domains: List[str],
    use_deep: bool,
    total_cap: int,
) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    """Re-rank by quality when ``use_deep``; cap to depth budget."""
    if not use_deep:
        return merged[:total_cap], None
    scored = score_sources(merged, question, domains)
    top3 = ", ".join(str(d.get("source", "?")) for d in scored[:3])
    msg = f"Scored {len(scored)} sources — top sources: {top3}"
    trimmed = filter_low_quality(scored)[:total_cap]
    return trimmed, msg


async def synthesize_research_report(
    question: str,
    domains: List[str],
    subdomains: List[str],
    subdomain_map: Dict[str, List[str]],
    intent: str,
    depth: str,
    merged: List[Dict[str, Any]],
    output_format: str,
    citation_style: str,
    lang: str,
    settings: ResearchSettings,
    request_id: str,
    use_deep: bool = True,
    log_callback: Optional[Callable[[str], None]] = None,
) -> Tuple[List[Dict[str, Any]], List[str], List[Dict[str, Any]], str]:
    """Build context, call LLM chain, parse sections + follow-up + grounded citations."""
    ctx_parts: List[str] = []
    for doc in merged:
        title = doc.get("title") or ""
        snip = doc.get("content") or ""
        ctx_parts.append(f"{title}: {snip[:_RAG_SNIPPET_CHARS]}")
    context_text = (
        "\n\n".join(ctx_parts)
        if ctx_parts
        else "(No retrieved snippets — answer conservatively and avoid fabricating references.)"
    )

    numbered: List[str] = []
    for idx, doc in enumerate(merged, 1):
        t = doc.get("title") or "Untitled"
        s = doc.get("source") or ""
        u = doc.get("url") or ""
        numbered.append(f"{idx}. {t} ({s}) {u}".strip())

    sources_block = "\n".join(numbered) if numbered else "(none)"

    lessons = load_lessons(domains, intent)
    memory_block = format_lessons_for_prompt(lessons)

    system_prompt, user_prompt = build_deep_research_prompt(
        question,
        domains,
        subdomains,
        subdomain_map,
        intent,
        depth,
        context_text,
        sources_block,
        output_format,
        citation_style,
        lang,
        memory_block=memory_block,
    )

    followup_questions: List[str] = []
    provider_used = ""

    if not _any_llm_configured(settings):
        sections = [
            {
                "id": "summary",
                "title": "Research Summary",
                "content": (
                    "LLM not configured (set OPENROUTER_API_KEY or RESEARCH_OLLAMA_URL). "
                    "Below is a compact view of retrieved sources.\n\n"
                    + context_text[:6000]
                ),
            }
        ]
        citations = build_citations(merged, settings.RESEARCH_MAX_CITATIONS)
        return sections, followup_questions, citations, provider_used

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_prompt},
    ]

    def _log(msg: str) -> None:
        if log_callback:
            log_callback(msg)

    try:
        raw_content, provider_used = await llm_with_fallback(
            messages,
            4096,
            0.25,
            settings,
            log_fn=_log,
        )
        sections, followup_questions = parse_full_research_response(raw_content)
    except Exception as exc:
        logger.error("llm_research_error: %s", exc, extra={"request_id": request_id})
        sections = [
            {
                "id": "error",
                "title": "Synthesis error",
                "content": f"Failed to generate synthesis: {exc!s}",
            }
        ]

    cited_indices = extract_cited_indices(sections)
    citations, old_to_new = build_grounded_citations(
        merged,
        cited_indices,
        citation_style or "vancouver",
        settings.RESEARCH_MAX_CITATIONS,
    )
    sections = apply_grounded_citations_to_sections(sections, old_to_new)

    return sections, followup_questions, citations, provider_used


async def run_research(
    body: Any,
    settings: ResearchSettings,
    request_id: str,
) -> Dict[str, Any]:
    """
    Main entry: gather sources → Groq → sections + citations.
    `body` must have question_text (DeepResearchRequest).
    """
    if not isinstance(body, DeepResearchRequest):
        body = DeepResearchRequest.model_validate(body)

    question = body.question_text
    if not question:
        cs = (body.citation_style or "vancouver").lower()
        return {
            "query": "",
            "domains_consulted": [],
            "subdomains_consulted": [],
            "intent": body.intent or "clinical",
            "sections": [{"id": "error", "title": "Invalid request", "content": "Missing query text."}],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": 0,
            "generated_at": "",
            "integrative_mode": False,
            "followup_questions": [],
            "citation_style": cs,
            "provider_used": "",
        }

    if not settings.RESEARCH_USE_LEGACY_RAG:
        from hybrid_research import run_hybrid_research

        return await run_hybrid_research(body, settings, request_id)

    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    subdomain_map = dict(body.subdomain_map or {})
    intent = (body.intent or "clinical").strip()
    depth = (body.depth or "comprehensive").strip()
    dpt = depth.lower().strip()
    use_deep = False if dpt == "focused" else (body.deep if body.deep is not None else True)
    sources_filter = list(body.sources or [])
    output_format = (body.output_format or "structured").lower()
    citation_style = (body.citation_style or "vancouver").lower()
    lang = (body.lang or "en").strip()

    budget = _depth_config(depth)
    target_sec = getattr(body, "target_seconds", None)
    timeout_sec = _effective_total_timeout(budget, target_sec)
    t0 = time.monotonic()

    async def _pipeline() -> Dict[str, Any]:
        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
            merged = await retrieve_merged_sources(
                question,
                settings,
                client,
                budget,
                sources_filter,
                domains,
                subdomain_map=subdomain_map,
                depth=depth,
                intent=intent,
                use_decomposition=use_deep,
                original_question=question,
                use_deep=use_deep,
            )

        connector_stats: Dict[str, int] = {}
        for doc in merged:
            src = str(doc.get("source") or "unknown")
            connector_stats[src] = connector_stats.get(src, 0) + 1
        outcome = "no_results" if not merged else ("degraded" if len(merged) < 5 else "good")
        record_lesson(domains, intent, question[:200], outcome, connector_stats)

        total_cap = int(budget["total_cap"])
        merged, _score_log = _apply_scoring_and_cap(
            merged, question, domains, use_deep, total_cap
        )

        sections, followup_questions, citations, provider_used = await synthesize_research_report(
            question,
            domains,
            subdomains,
            subdomain_map,
            intent,
            depth,
            merged,
            output_format,
            citation_style,
            lang,
            settings,
            request_id,
            use_deep=use_deep,
            log_callback=None,
        )

        elapsed_inner = time.monotonic() - t0
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": sections,
            "citations": citations,
            "sources_searched": len(merged),
            "time_taken_seconds": int(elapsed_inner),
            "generated_at": datetime.now(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": followup_questions,
            "citation_style": citation_style,
            "provider_used": provider_used,
        }

    try:
        return await asyncio.wait_for(_pipeline(), timeout=timeout_sec)
    except asyncio.TimeoutError:
        logger.warning("research_timeout", extra={"request_id": request_id, "cap_sec": timeout_sec})
        return {
            "query": question,
            "domains_consulted": domains,
            "subdomains_consulted": subdomains,
            "intent": intent,
            "sections": [
                {
                    "id": "timeout",
                    "title": "Time limit reached",
                    "content": (
                        f"Research exceeded the time budget ({timeout_sec:.0f}s). "
                        "Try a narrower question, fewer sources, or increase target time."
                    ),
                }
            ],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": datetime.now(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": [],
            "citation_style": citation_style,
            "provider_used": "",
        }


async def stream_research_events(
    body: Any,
    settings: ResearchSettings,
    request_id: str,
) -> AsyncIterator[Dict[str, Any]]:
    """
    SSE event stream for POST /deep-research/stream.
    Events: log, section, citations, followup, done | error.
    """
    if not isinstance(body, DeepResearchRequest):
        body = DeepResearchRequest.model_validate(body)

    question = body.question_text
    citation_style = (body.citation_style or "vancouver").lower()
    if not question:
        yield {"type": "error", "message": "Missing query text."}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": 0,
                "integrative_mode": False,
                "citation_style": citation_style,
                "provider_used": "",
            },
        }
        return

    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    subdomain_map = dict(body.subdomain_map or {})
    intent = (body.intent or "clinical").strip()
    depth = (body.depth or "comprehensive").strip()
    dpt = depth.lower().strip()
    use_deep = False if dpt == "focused" else (body.deep if body.deep is not None else True)
    sources_filter = list(body.sources or [])
    output_format = (body.output_format or "structured").lower()
    lang = (body.lang or "en").strip()

    budget = _depth_config(depth)
    target_sec = getattr(body, "target_seconds", None)
    timeout_sec = _effective_total_timeout(budget, target_sec)
    deadline = time.monotonic() + timeout_sec
    t0 = time.monotonic()

    if not settings.RESEARCH_USE_LEGACY_RAG:
        from hybrid_research import hybrid_pipeline_timeout, stream_hybrid_research_events

        hto = hybrid_pipeline_timeout(settings, body)
        async for ev in stream_hybrid_research_events(body, settings, request_id, hto):
            yield ev
        return

    def _check_deadline() -> None:
        if time.monotonic() > deadline:
            raise asyncio.TimeoutError()

    try:
        yield {"type": "log", "text": "Starting Manthana Deep Research pipeline…"}
        _check_deadline()

        yield {
            "type": "log",
            "text": "Searching Meilisearch, Qdrant, Perplexica, and SearXNG (parallel retrieval)…",
        }
        r_logs: List[str] = []

        def rlog(msg: str) -> None:
            r_logs.append(msg)

        async with httpx.AsyncClient(timeout=httpx.Timeout(90.0, connect=10.0)) as client:
            _check_deadline()
            merged = await retrieve_merged_sources(
                question,
                settings,
                client,
                budget,
                sources_filter,
                domains,
                subdomain_map=subdomain_map,
                depth=depth,
                intent=intent,
                use_decomposition=use_deep,
                original_question=question,
                log_callback=rlog,
                use_deep=use_deep,
            )
        for t in r_logs:
            yield {"type": "log", "text": t}
        _check_deadline()

        yield {
            "type": "log",
            "text": f"Merged {len(merged)} unique sources after deduplication.",
        }
        if _should_run_optional(sources_filter, "pubmed"):
            yield {
                "type": "log",
                "text": f"PubMed connector was included in this run (query: “{question[:72]}…”).",
            }
        if _should_run_optional(sources_filter, "clinicaltrials"):
            yield {
                "type": "log",
                "text": "ClinicalTrials.gov connector was included in this run.",
            }

        connector_stats: Dict[str, int] = {}
        for doc in merged:
            src = str(doc.get("source") or "unknown")
            connector_stats[src] = connector_stats.get(src, 0) + 1
        outcome = "no_results" if not merged else ("degraded" if len(merged) < 5 else "good")
        record_lesson(domains, intent, question[:200], outcome, connector_stats)

        total_cap = int(budget["total_cap"])
        merged, score_log = _apply_scoring_and_cap(
            merged, question, domains, use_deep, total_cap
        )
        if score_log:
            yield {"type": "log", "text": score_log}

        synth_logs: List[str] = []

        def slog(msg: str) -> None:
            synth_logs.append(msg)

        yield {"type": "log", "text": "Synthesizing with LLM (multi-provider fallback)…"}
        _check_deadline()

        sections, followup_questions, citations, provider_used = await synthesize_research_report(
            question,
            domains,
            subdomains,
            subdomain_map,
            intent,
            depth,
            merged,
            output_format,
            citation_style,
            lang,
            settings,
            request_id,
            use_deep=use_deep,
            log_callback=slog,
        )
        for t in synth_logs:
            yield {"type": "log", "text": t}

        for sec in sections:
            yield {
                "type": "section",
                "id": sec.get("id", "section"),
                "title": sec.get("title", "Section"),
                "content": sec.get("content", ""),
            }

        yield {"type": "citations", "data": citations}
        yield {"type": "followup", "questions": followup_questions}

        elapsed = time.monotonic() - t0
        yield {
            "type": "done",
            "meta": {
                "sources_searched": len(merged),
                "time_taken_seconds": int(elapsed),
                "integrative_mode": len(domains) >= 2,
                "request_id": request_id,
                "citation_style": citation_style,
                "provider_used": provider_used,
            },
        }
    except asyncio.TimeoutError:
        logger.warning(
            "research_stream_timeout",
            extra={"request_id": request_id, "cap_sec": timeout_sec},
        )
        yield {
            "type": "error",
            "message": f"Research exceeded time budget ({timeout_sec:.0f}s).",
        }
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
        logger.exception("research_stream_error", extra={"request_id": request_id})
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
