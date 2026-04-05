"""
plagiarism.py — Plagiarism Router
==================================
Originality analysis with web search and vector similarity.
"""

from __future__ import annotations

import asyncio
import datetime
import logging
import re
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from config import ResearchSettings, get_research_settings

logger = logging.getLogger("manthana.research.plagiarism")


def _embed_helper():
    from orchestrator import _generate_embedding

    return _generate_embedding


# ── Models ───────────────────────────────────────────────────────────

class PlagiarismCheckRequest(BaseModel):
    text: str
    scanId: Optional[str] = None


class PlagiarismMatch(BaseModel):
    matchedSentence: str
    source: str
    url: str
    matchPercent: float
    isCitation: bool


class PlagiarismResult(BaseModel):
    originalityScore: float
    matchedPercent: float
    matches: List[PlagiarismMatch]
    sentencesAnalysed: int
    sourcesSearched: int
    layers: Dict[str, int]
    scanDate: str
    note: str


# ── Constants ─────────────────────────────────────────────────────────

_EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_EMBED_DIM = 384
_MIN_SENTENCE_WORDS = 10
_MAX_SEARCH_SENTENCE_LEN = 200
_WEB_OVERLAP_THRESHOLD = 0.72
_MAX_MATCHES_RETURNED = 10
_SEARXNG_CONCURRENCY = 4

_SCHOLARLY_CITATION_HOSTS = (
    "pubmed",
    "doi.org",
    "cochranelibrary",
    "radiopaedia",
    "acr.org",
    "rsna.org",
    "ncbi",
    "semanticscholar",
    "europepmc",
    "biorxiv",
    "medrxiv",
)

_CITATION_BRACKET_RE = re.compile(r"\[\d+\]")
_CITATION_YEAR_RE = re.compile(
    r"\(\s*[A-Z][a-zA-Z]+(?:\s+et\s+al\.)?\s*,\s*(19|20)\d{2}\s*\)"
)

# ═══════════════════════════════════════════════════════════════════════
#  EMBEDDING MODEL — lazy-loaded singleton
# ═══════════════════════════════════════════════════════════════════════

_model: Optional[SentenceTransformer] = None
_model_lock = asyncio.Lock()


async def _get_model() -> SentenceTransformer:
    """Lazily load the SentenceTransformer model."""
    global _model
    if _model is not None:
        return _model
    async with _model_lock:
        if _model is None:
            loop = asyncio.get_running_loop()
            _model = await loop.run_in_executor(
                None,
                lambda: SentenceTransformer(_EMBED_MODEL_NAME),
            )
            logger.info(f"Loaded embedding model: {_EMBED_MODEL_NAME}")
    return _model


# ═══════════════════════════════════════════════════════════════════════
#  SENTENCE PROCESSING
# ═══════════════════════════════════════════════════════════════════════

def _extract_sentences(text: str) -> List[str]:
    """Extract sentences from text."""
    # Simple sentence splitting
    sentences = re.split(r'(?<=[.!?])\s+', text)
    result = []
    for s in sentences:
        words = s.split()
        if len(words) >= _MIN_SENTENCE_WORDS:
            result.append(s.strip())
    return result


def _is_likely_citation(sentence: str) -> bool:
    """Check if sentence appears to be a citation."""
    lower = sentence.lower()
    if _CITATION_BRACKET_RE.search(sentence):
        return True
    if _CITATION_YEAR_RE.search(sentence):
        return True
    if any(h in lower for h in _SCHOLARLY_CITATION_HOSTS):
        return True
    return False


# ═══════════════════════════════════════════════════════════════════════
#  WEB SEARCH LAYER
# ═══════════════════════════════════════════════════════════════════════

async def _search_sentence_web(
    sentence: str,
    searxng_url: str,
) -> Optional[Dict[str, Any]]:
    """Search a single sentence via SearXNG."""
    # Truncate long sentences
    query = sentence[:_MAX_SEARCH_SENTENCE_LEN]
    params = {"q": f'"{query}"', "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(f"{searxng_url}/search", params=params)
            if resp.status_code == 200:
                data = resp.json()
                results = data.get("results", [])
                if results:
                    # Return first result with high relevance
                    top = results[0]
                    return {
                        "title": top.get("title", ""),
                        "url": top.get("url", ""),
                        "snippet": top.get("content", ""),
                    }
    except Exception as exc:
        logger.debug(f"Web search error: {exc}")
    return None


async def _web_layer_check(
    sentences: List[str],
    searxng_url: str,
) -> tuple[List[PlagiarismMatch], int]:
    """Layer 1: Web search for exact matches."""
    matches = []
    sources_searched = 0

    sem = asyncio.Semaphore(_SEARXNG_CONCURRENCY)

    async def check_one(sentence: str) -> Optional[PlagiarismMatch]:
        nonlocal sources_searched
        async with sem:
            result = await _search_sentence_web(sentence, searxng_url)
            sources_searched += 1
            if result:
                # Calculate overlap (simplified)
                snippet = result.get("snippet", "")
                overlap = len(set(sentence.lower().split()) & set(snippet.lower().split())) / len(set(sentence.lower().split()))
                if overlap >= _WEB_OVERLAP_THRESHOLD:
                    return PlagiarismMatch(
                        matchedSentence=sentence[:200],
                        source=result.get("title", "Web Source"),
                        url=result.get("url", ""),
                        matchPercent=round(overlap * 100, 1),
                        isCitation=_is_likely_citation(sentence),
                    )
            return None

    tasks = [check_one(s) for s in sentences[:20]]  # Check first 20 sentences
    results = await asyncio.gather(*tasks)
    matches = [r for r in results if r is not None][:10]

    return matches, sources_searched


# ═══════════════════════════════════════════════════════════════════════
#  VECTOR SIMILARITY LAYER
# ═══════════════════════════════════════════════════════════════════════

async def _vector_layer_check(
    sentences: List[str],
) -> tuple[List[PlagiarismMatch], int]:
    """Layer 2: Vector similarity check (self-similarity)."""
    if len(sentences) < 2:
        return [], 0

    model = await _get_model()

    # Get embeddings
    loop = asyncio.get_running_loop()
    embeddings = await loop.run_in_executor(None, lambda: model.encode(sentences))

    # Calculate similarity matrix
    similarities = cosine_similarity(embeddings)

    matches = []
    for i in range(len(sentences)):
        for j in range(i + 1, len(sentences)):
            sim = similarities[i][j]
            if sim >= 0.85:  # High similarity threshold
                matches.append(PlagiarismMatch(
                    matchedSentence=sentences[i][:200],
                    source=f"Internal repetition (sentence {j+1})",
                    url="",
                    matchPercent=round(sim * 100, 1),
                    isCitation=False,
                ))

    return matches[:5], len(sentences)  # Limit internal matches


# ═══════════════════════════════════════════════════════════════════════
#  QDRANT CORPUS LAYER (Layer 3)
# ═══════════════════════════════════════════════════════════════════════

async def _qdrant_corpus_layer(
    sentences: List[str],
    settings: ResearchSettings,
) -> tuple[List[PlagiarismMatch], int]:
    """
    Compare sentence embeddings against Qdrant medical_documents.
    High similarity suggests overlap with indexed literature.
    """
    qurl = (settings.RESEARCH_QDRANT_URL or "").strip()
    embed_url = (settings.RESEARCH_EMBED_URL or "http://ollama:11434").strip()
    if not qurl:
        return [], 0

    col = settings.RESEARCH_QDRANT_COLLECTION or "medical_documents"
    threshold = float(getattr(settings, "RESEARCH_PLAGIARISM_QDRANT_THRESHOLD", 0.82))
    gen_emb = _embed_helper()
    matches: List[PlagiarismMatch] = []
    checked = 0

    async with httpx.AsyncClient(timeout=25.0) as client:
        for sent in sentences[:10]:
            if len(sent.split()) < _MIN_SENTENCE_WORDS:
                continue
            try:
                emb = await gen_emb(sent, embed_url, client)
                resp = await client.post(
                    f"{qurl.rstrip('/')}/collections/{col}/points/search",
                    json={"vector": emb, "limit": 2, "with_payload": True},
                    headers={"Content-Type": "application/json"},
                    timeout=20.0,
                )
                checked += 1
                if resp.status_code != 200:
                    continue
                for hit in resp.json().get("result", []) or []:
                    score = float(hit.get("score", 0) or 0)
                    if score < threshold:
                        continue
                    payload = hit.get("payload") or {}
                    title = str(payload.get("title") or payload.get("name") or "Indexed document")[:200]
                    url = str(payload.get("url") or "")[:500]
                    matches.append(
                        PlagiarismMatch(
                            matchedSentence=sent[:200],
                            source=f"Corpus: {title}",
                            url=url or "qdrant://corpus",
                            matchPercent=round(min(score * 100, 99.9), 1),
                            isCitation=_is_likely_citation(sent),
                        )
                    )
                    break
            except Exception as exc:
                logger.debug("qdrant_plagiarism_skip: %s", exc)

    return matches[:8], checked


# ═══════════════════════════════════════════════════════════════════════
#  MAIN PLAGIARISM CHECK
# ═══════════════════════════════════════════════════════════════════════

async def check_originality(
    report_text: str,
    settings: ResearchSettings,
) -> Dict[str, Any]:
    """Run full originality analysis."""
    sentences = _extract_sentences(report_text)
    total_sentences = len(sentences)

    if total_sentences == 0:
        return {
            "originalityScore": 100.0,
            "matchedPercent": 0.0,
            "matches": [],
            "sentencesAnalysed": 0,
            "sourcesSearched": 0,
            "layers": {
                "webSearch": 0,
                "internal": 0,
                "vectorDB": 0,
                "qdrantCorpus": 0,
                "qdrantScans": 0,
            },
            "scanDate": datetime.datetime.utcnow().isoformat(),
            "note": "No sentences long enough to analyze.",
        }

    searxng_url = settings.SEARXNG_URL

    # Layer 1: Web search
    web_matches, web_searched = await _web_layer_check(sentences, searxng_url)

    # Layer 2: Vector self-similarity
    vector_matches, _ = await _vector_layer_check(sentences)

    # Layer 3: Qdrant corpus similarity (optional)
    if settings.RESEARCH_PLAGIARISM_USE_QDRANT:
        q_matches, q_checked = await _qdrant_corpus_layer(sentences, settings)
    else:
        q_matches, q_checked = [], 0

    # Combine matches
    all_matches = web_matches + vector_matches + q_matches
    all_matches = all_matches[:_MAX_MATCHES_RETURNED]

    # Calculate originality score
    matched_sentences = len(set(m.matchedSentence for m in all_matches))
    matched_percent = (matched_sentences / total_sentences) * 100 if total_sentences > 0 else 0
    originality_score = max(0, 100 - matched_percent)

    return {
        "originalityScore": round(originality_score, 1),
        "matchedPercent": round(matched_percent, 1),
        "matches": [m.dict() for m in all_matches],
        "sentencesAnalysed": total_sentences,
        "sourcesSearched": web_searched,
        "layers": {
            "webSearch": len(web_matches),
            "internal": len(vector_matches),
            "vectorDB": len(vector_matches),
            "qdrantCorpus": len(q_matches),
            "qdrantScans": q_checked,
        },
        "scanDate": datetime.datetime.utcnow().isoformat(),
        "note": f"Analyzed {total_sentences} sentences. Found {len(all_matches)} potential matches.",
    }


# ═══════════════════════════════════════════════════════════════════════
#  ROUTER FACTORY
# ═══════════════════════════════════════════════════════════════════════

def create_plagiarism_router(limiter) -> APIRouter:
    """Create the plagiarism router."""
    router = APIRouter(tags=["plagiarism"])

    @router.post("/plagiarism/check")
    @limiter.limit("60/minute")
    async def plagiarism_check(
        request: Request,
        body: PlagiarismCheckRequest,
        settings: ResearchSettings = Depends(get_research_settings),
    ):
        """Check originality of clinical or research text."""
        rid = getattr(request.state, "request_id", "unknown")
        scan_id = body.scanId or ""

        if not settings.RESEARCH_ENABLE_PLAGIARISM:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "service": "research",
                    "error": "Plagiarism checking disabled",
                    "request_id": rid,
                },
            )

        try:
            result = await check_originality(
                report_text=body.text,
                settings=settings,
            )

            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "service": "research",
                    "data": result,
                    "error": None,
                    "request_id": rid,
                },
            )

        except Exception as exc:
            logger.error(f"Plagiarism check failed: {exc}", extra={"request_id": rid})
            return JSONResponse(
                status_code=500,
                content={
                    "status": "error",
                    "service": "research",
                    "error": f"Plagiarism check failed: {str(exc)}",
                    "request_id": rid,
                },
            )

    @router.get("/plagiarism/health")
    async def plagiarism_health():
        """Health check for plagiarism engine."""
        return {
            "status": "ok",
            "layers": ["sentence-transformers", "searxng", "qdrant-corpus"],
            "cost": "₹0",
        }

    return router
