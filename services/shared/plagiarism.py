"""
plagiarism.py — Manthana Originality & Plagiarism Detection
=============================================================
Three-layer originality analysis pipeline:

  Layer 1 — SearXNG web search (exact phrase matching)
  Layer 2 — Qdrant vector similarity (semantic matching)
  Layer 3 — Internal self-similarity (internal repetition penalty)

All async.  Gracefully degrades when external services are unavailable.
Zero LLM calls — pure NLP + embeddings.
"""

from __future__ import annotations

import asyncio
import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

logger = logging.getLogger("manthana.plagiarism")

# ═══════════════════════════════════════════════════════════════════════
#  CONSTANTS
# ═══════════════════════════════════════════════════════════════════════

_EMBED_MODEL_NAME = "all-MiniLM-L6-v2"
_EMBED_DIM = 384  # dimension for all-MiniLM-L6-v2

# Minimum sentence length (words) to be considered for analysis
_MIN_SENTENCE_WORDS = 10
# Maximum sentence length to pass to SearXNG (avoids HTTP 414)
_MAX_SEARCH_SENTENCE_LEN = 200
# Overlap threshold above which a web result is flagged
_WEB_OVERLAP_THRESHOLD = 0.72
# Qdrant score threshold
_QDRANT_SCORE_THRESHOLD = 0.70
# Maximum matches returned to caller
_MAX_MATCHES_RETURNED = 10
# Max concurrent SearXNG requests (avoid hammering the instance)
_SEARXNG_CONCURRENCY = 4
# Seconds above which internal self-similarity is penalised
_INTERNAL_SIM_THRESHOLD = 0.30
_INTERNAL_SIM_PENALTY_FACTOR = 50.0

# Scholarly domains whose matches are considered citations (not plagiarism)
_SCHOLARLY_CITATION_HOSTS: Tuple[str, ...] = (
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

# Regex patterns for citation detection
_CITATION_BRACKET_RE = re.compile(r"\[\d+\]")
_CITATION_YEAR_RE = re.compile(
    r"\(\s*[A-Z][a-zA-Z]+(?:\s+et\s+al\.)?\s*,\s*(19|20)\d{2}\s*\)"
)
_DOI_RE = re.compile(r"\b10\.\d{4,9}/\S+", re.IGNORECASE)

# Sentence boundary terminators (handles Mrs., Dr., etc. by requiring >= _MIN_SENTENCE_WORDS)
_TERMINATORS = frozenset(".!?")


# ═══════════════════════════════════════════════════════════════════════
#  EMBEDDING MODEL — lazy-loaded singleton, thread-safe via asyncio.Lock
# ═══════════════════════════════════════════════════════════════════════

_model: Optional[SentenceTransformer] = None
_model_lock = asyncio.Lock()


async def _get_model() -> SentenceTransformer:
    """Lazily load the SentenceTransformer model.

    Uses asyncio.Lock to ensure the model is only loaded once even under
    concurrent requests.
    """
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
            logger.info("[PLAGIARISM] Loaded embedding model: %s", _EMBED_MODEL_NAME)
    return _model


def _encode_sync(model: SentenceTransformer, texts: List[str]) -> np.ndarray:
    """Encode texts synchronously (called in executor)."""
    return model.encode(texts, convert_to_numpy=True, show_progress_bar=False)


# ═══════════════════════════════════════════════════════════════════════
#  SENTENCE SPLITTING
# ═══════════════════════════════════════════════════════════════════════

# Lines to discard regardless of length
_DISCARD_PREFIXES = ("figure ", "table ", "doi:", "pmid:", "http", "https")
_DISCARD_PATTERNS = re.compile(
    r"^\[.+\]$|^\(.*\)$|^[\d\.]+$",
    re.IGNORECASE,
)


def split_into_sentences(text: str) -> List[str]:
    """Split a medical text into meaningful sentences.

    Filters out references, figure captions, table labels, DOI lines,
    and very short fragments.
    """
    raw: List[str] = []
    buf: List[str] = []

    for ch in text:
        buf.append(ch)
        if ch in _TERMINATORS:
            segment = "".join(buf).strip()
            if segment:
                raw.append(segment)
            buf = []
    if buf:
        tail = "".join(buf).strip()
        if tail:
            raw.append(tail)

    sentences: List[str] = []
    for s in raw:
        normalized = " ".join(s.split())
        words = normalized.split()

        if len(words) < _MIN_SENTENCE_WORDS:
            continue

        lowered = normalized.lower()
        if lowered.endswith(":") or lowered.endswith(" -"):
            continue
        if lowered.startswith(_DISCARD_PREFIXES):
            continue
        if _DISCARD_PATTERNS.match(normalized):
            continue
        if _DOI_RE.search(normalized):
            continue

        sentences.append(normalized)

    return sentences


# ═══════════════════════════════════════════════════════════════════════
#  FINGERPRINT EXTRACTION — TF-IDF top sentences
# ═══════════════════════════════════════════════════════════════════════

def extract_fingerprint_sentences(text: str, top_n: int = 5) -> List[str]:
    """Extract the ``top_n`` most distinctive sentences via TF-IDF.

    Falls back to the first ``top_n`` sentences on failure.
    """
    sentences = split_into_sentences(text)
    if not sentences:
        return []
    if len(sentences) <= top_n:
        return sentences

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
            sublinear_tf=True,
        )
        tfidf = vectorizer.fit_transform(sentences)
        scores = np.asarray(tfidf.sum(axis=1)).ravel()
        top_idx = np.argsort(scores)[::-1][:top_n]
        return [sentences[i] for i in sorted(top_idx)]
    except Exception as exc:
        logger.debug("[PLAGIARISM] TF-IDF failed, using slice: %s", exc)
        return sentences[:top_n]


# ═══════════════════════════════════════════════════════════════════════
#  TEXT OVERLAP (Jaccard — token level)
# ═══════════════════════════════════════════════════════════════════════

def compute_text_overlap(text_a: str, text_b: str) -> float:
    """Compute Jaccard token overlap between two text strings."""
    tokens_a: Set[str] = {t.lower() for t in re.findall(r"\b\w+\b", text_a) if t}
    tokens_b: Set[str] = {t.lower() for t in re.findall(r"\b\w+\b", text_b) if t}
    if not tokens_a or not tokens_b:
        return 0.0
    union = tokens_a | tokens_b
    if not union:
        return 0.0
    return float(len(tokens_a & tokens_b) / len(union))


# ═══════════════════════════════════════════════════════════════════════
#  CITATION DETECTION
# ═══════════════════════════════════════════════════════════════════════

def is_likely_citation(sentence: str, url: str) -> bool:
    """Return True when a match is likely an intentional citation.

    Criteria (any one sufficient):
      • Bracket citation like [1], [2]
      • (Author, Year) pattern
      • Source is a known scholarly host
      • Contains a DOI
    """
    url_lower = (url or "").lower()

    if _CITATION_BRACKET_RE.search(sentence):
        return True
    if _CITATION_YEAR_RE.search(sentence):
        return True
    if "et al." in sentence.lower():
        return True
    if _DOI_RE.search(sentence):
        return True
    if any(host in url_lower for host in _SCHOLARLY_CITATION_HOSTS):
        return True

    return False


# ═══════════════════════════════════════════════════════════════════════
#  INTERNAL SELF-SIMILARITY
# ═══════════════════════════════════════════════════════════════════════

async def compute_self_similarity(sentences: List[str]) -> float:
    """Compute the average pairwise semantic similarity of all sentences.

    Runs in executor to avoid blocking the event loop.
    Returns 0.0 on failure or when fewer than 2 sentences are provided.
    """
    if len(sentences) < 2:
        return 0.0

    try:
        model = await _get_model()
        loop = asyncio.get_running_loop()
        embeddings: np.ndarray = await loop.run_in_executor(
            None, _encode_sync, model, sentences,
        )

        if embeddings.ndim != 2 or embeddings.shape[0] < 2:
            return 0.0

        sim_matrix = cosine_similarity(embeddings)
        n = sim_matrix.shape[0]
        off_diag_sum = float(sim_matrix.sum() - np.trace(sim_matrix))
        off_diag_count = n * n - n
        return float(off_diag_sum / off_diag_count) if off_diag_count > 0 else 0.0

    except Exception as exc:
        logger.warning("[PLAGIARISM] Self-similarity failed: %s", exc)
        return 0.0


# ═══════════════════════════════════════════════════════════════════════
#  LAYER 1: SEARXNG WEB SEARCH
# ═══════════════════════════════════════════════════════════════════════

async def _check_one_sentence(
    sentence: str,
    client: httpx.AsyncClient,
    searxng_url: str,
) -> List[Dict[str, Any]]:
    """Check a single sentence against SearXNG (exact phrase search)."""
    matches: List[Dict[str, Any]] = []
    query_text = sentence[:_MAX_SEARCH_SENTENCE_LEN]

    try:
        resp = await client.get(
            f"{searxng_url.rstrip('/')}/search",
            params={
                "q": f'"{query_text}"',
                "format": "json",
                "engines": "google,bing",
            },
        )
        if resp.status_code != 200:
            return matches

        results = resp.json().get("results", [])
        for r in results:
            url = r.get("url") or ""
            title = r.get("title") or r.get("url") or "Unknown source"
            content = r.get("content") or ""
            overlap = compute_text_overlap(query_text, content or title)
            if overlap > _WEB_OVERLAP_THRESHOLD:
                matches.append({
                    "matchedSentence": query_text,
                    "source": title,
                    "url": url,
                    "matchPercent": round(overlap * 100, 1),
                    "isCitation": is_likely_citation(query_text, url),
                    "layer": "webSearch",
                })
    except httpx.TimeoutException:
        logger.debug("[PLAGIARISM] SearXNG timeout for sentence: %s...", sentence[:40])
    except Exception as exc:
        logger.debug("[PLAGIARISM] SearXNG error: %s", exc)

    return matches


async def searxng_check(
    sentences: List[str],
    searxng_url: str,
) -> List[Dict[str, Any]]:
    """Run all sentences against SearXNG with bounded concurrency.

    Uses a semaphore to limit parallel requests to ``_SEARXNG_CONCURRENCY``.
    """
    if not sentences:
        return []

    all_matches: List[Dict[str, Any]] = []
    sem = asyncio.Semaphore(_SEARXNG_CONCURRENCY)
    timeout = httpx.Timeout(10.0, connect=5.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        async def _guarded(s: str) -> List[Dict[str, Any]]:
            async with sem:
                return await _check_one_sentence(s, client, searxng_url)

        results = await asyncio.gather(
            *(_guarded(s) for s in sentences),
            return_exceptions=True,
        )

    for res in results:
        if isinstance(res, list):
            all_matches.extend(res)
        elif isinstance(res, Exception):
            logger.debug("[PLAGIARISM] Sentence check exception: %s", res)

    return all_matches


# ═══════════════════════════════════════════════════════════════════════
#  LAYER 2: QDRANT VECTOR SIMILARITY
# ═══════════════════════════════════════════════════════════════════════

async def qdrant_similarity_check(
    report_text: str,
    qdrant_client: Any,
    collection: str = "medical_papers",
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Search Qdrant for semantically similar existing documents.

    Returns an empty list without raising if the client is ``None`` or
    the service is unavailable.
    """
    if not qdrant_client:
        return []

    text = (report_text or "").strip()[:2000]
    if not text:
        return []

    try:
        model = await _get_model()
        loop = asyncio.get_running_loop()
        vector_arr: np.ndarray = await loop.run_in_executor(
            None, _encode_sync, model, [text],
        )
        vector = vector_arr[0].tolist()

        search_result = await qdrant_client.search(
            collection_name=collection,
            query_vector=vector,
            limit=top_k,
            score_threshold=_QDRANT_SCORE_THRESHOLD,
        )

        matches: List[Dict[str, Any]] = []
        for point in search_result:
            payload: Dict[str, Any] = getattr(point, "payload", None) or {}
            title = payload.get("title") or "Unknown source"
            url = payload.get("url") or ""
            score = float(getattr(point, "score", None) or payload.get("score", 0.0))
            matches.append({
                "matchedSentence": text[:200],
                "source": title,
                "url": url,
                "matchPercent": round(score * 100, 1),
                "isCitation": is_likely_citation(text, url),
                "layer": "vectorDB",
            })
        return matches

    except Exception as exc:
        logger.warning("[PLAGIARISM] Qdrant check failed: %s", exc)
        return []


# ═══════════════════════════════════════════════════════════════════════
#  DEDUPLICATION
# ═══════════════════════════════════════════════════════════════════════

def _deduplicate_matches(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate by URL or source, keeping the highest-scoring match."""
    best: Dict[str, Dict[str, Any]] = {}
    for m in matches:
        key = m.get("url") or m.get("source") or m.get("matchedSentence")
        if not key:
            continue
        existing = best.get(key)
        if existing is None or m.get("matchPercent", 0) > existing.get("matchPercent", 0):
            best[key] = m
    return list(best.values())


# ═══════════════════════════════════════════════════════════════════════
#  SCORING
# ═══════════════════════════════════════════════════════════════════════

def _compute_originality_score(
    matches: List[Dict[str, Any]],
    sentences: List[str],
    internal_similarity: float,
) -> Tuple[int, float]:
    """Compute the originality score (0-100) and matched percent.

    Returns (originality_score, matched_percent).

    Deductions:
      • Similarity penalty: proportion of non-citation matches to total sentences
      • Internal penalty: repetition within the document itself
    """
    non_citation = [m for m in matches if not m.get("isCitation")]
    matched_count = len(non_citation)
    total_sentences = max(1, len(sentences))
    similarity_penalty = (matched_count / total_sentences) * 100.0

    internal_penalty = max(
        0.0,
        (internal_similarity - _INTERNAL_SIM_THRESHOLD) * _INTERNAL_SIM_PENALTY_FACTOR,
    )

    raw_score = 100.0 - similarity_penalty - internal_penalty
    originality_score = max(0, min(100, int(round(raw_score))))
    matched_percent = max(0.0, min(100.0, 100.0 - float(originality_score)))

    return originality_score, matched_percent


# ═══════════════════════════════════════════════════════════════════════
#  PUBLIC API
# ═══════════════════════════════════════════════════════════════════════

async def check_originality(
    report_text: str,
    qdrant_client: Any = None,
    searxng_url: str = "http://searxng:8080",
) -> Dict[str, Any]:
    """Run the full three-layer originality analysis.

    Parameters
    ----------
    report_text : str
        Full text to analyse (medical report, research summary, etc.)
    qdrant_client : Any, optional
        Qdrant async client (``None`` to skip vector layer).
    searxng_url : str
        Base URL of the SearXNG instance.

    Returns
    -------
    dict
        {
          originalityScore: int,       # 0-100 (higher = more original)
          matchedPercent: float,
          matches: list[dict],
          sentencesAnalysed: int,
          sourcesSearched: int,
          layers: { webSearch: int, vectorDB: int },
          internalSimilarity: float,
          scanDate: str,               # ISO 8601 UTC
          note: str,
        }
    """
    if not report_text or not report_text.strip():
        return {
            "originalityScore": 100,
            "matchedPercent": 0.0,
            "matches": [],
            "sentencesAnalysed": 0,
            "sourcesSearched": 0,
            "layers": {"webSearch": 0, "vectorDB": 0},
            "internalSimilarity": 0.0,
            "scanDate": datetime.datetime.utcnow().isoformat() + "Z",
            "note": "No content provided for analysis.",
        }

    sentences = split_into_sentences(report_text)
    fingerprints = extract_fingerprint_sentences(report_text, top_n=5)

    # Run all three layers concurrently
    try:
        web_matches, vector_matches, internal_similarity = await asyncio.gather(
            searxng_check(fingerprints, searxng_url),
            qdrant_similarity_check(report_text, qdrant_client),
            compute_self_similarity(sentences),
            return_exceptions=False,
        )
    except Exception as exc:
        logger.error("[PLAGIARISM] Pipeline error: %s", exc)
        web_matches, vector_matches, internal_similarity = [], [], 0.0

    # Deduplicate and cap results
    all_matches = _deduplicate_matches(web_matches + vector_matches)
    top_matches = sorted(
        all_matches,
        key=lambda m: m.get("matchPercent", 0),
        reverse=True,
    )[:_MAX_MATCHES_RETURNED]

    originality_score, matched_percent = _compute_originality_score(
        top_matches, sentences, internal_similarity,
    )

    return {
        "originalityScore": originality_score,
        "matchedPercent": round(matched_percent, 1),
        "matches": top_matches,
        "sentencesAnalysed": len(sentences),
        "sourcesSearched": len(top_matches),
        "layers": {
            "webSearch": len([m for m in top_matches if m.get("layer") == "webSearch"]),
            "vectorDB": len([m for m in top_matches if m.get("layer") == "vectorDB"]),
        },
        "internalSimilarity": round(internal_similarity, 4),
        "scanDate": datetime.datetime.utcnow().isoformat() + "Z",
        "note": (
            "This originality score is computed using local TF-IDF fingerprinting, "
            "SearXNG phrase search, and Qdrant semantic similarity. "
            "It is not a certified plagiarism detection system."
        ),
    }
