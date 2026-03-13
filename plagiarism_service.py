import asyncio
import datetime
from typing import Any, Dict, List, Optional

import httpx
import numpy as np
from sentence_transformers import SentenceTransformer
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity


_model: Optional[SentenceTransformer] = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        _model = SentenceTransformer("all-MiniLM-L6-v2")
    return _model


def split_into_sentences(text: str) -> List[str]:
    raw = []
    current = []
    for ch in text:
        current.append(ch)
        if ch in ".!?":
            segment = "".join(current).strip()
            if segment:
                raw.append(segment)
            current = []
    if current:
        tail = "".join(current).strip()
        if tail:
            raw.append(tail)

    sentences: List[str] = []
    for s in raw:
        normalized = " ".join(s.split())
        words = normalized.split()
        if len(words) < 10:
            continue
        lowered = normalized.lower()
        if lowered.endswith(":") or lowered.endswith(" -"):
            continue
        if lowered.startswith("figure ") or lowered.startswith("table "):
            continue
        if lowered.startswith("[") and lowered.endswith("]"):
            continue
        if lowered.startswith("doi:") or lowered.startswith("pmid:"):
            continue
        sentences.append(normalized)
    return sentences


def extract_fingerprint_sentences(text: str, top_n: int = 5) -> List[str]:
    sentences = split_into_sentences(text)
    if not sentences:
        return []
    if len(sentences) <= top_n:
        return sentences

    try:
        vectorizer = TfidfVectorizer(
            ngram_range=(1, 2),
            stop_words="english",
        )
        tfidf = vectorizer.fit_transform(sentences)
        scores = np.asarray(tfidf.sum(axis=1)).ravel()
        top_idx = np.argsort(scores)[::-1][:top_n]
        return [sentences[i] for i in top_idx]
    except Exception:
        return sentences[:top_n]


def compute_text_overlap(text_a: str, text_b: str) -> float:
    tokens_a = {t for t in text_a.lower().split() if t}
    tokens_b = {t for t in text_b.lower().split() if t}
    if not tokens_a or not tokens_b:
        return 0.0
    inter = tokens_a & tokens_b
    union = tokens_a | tokens_b
    return float(len(inter) / len(union)) if union else 0.0


def compute_self_similarity(sentences: List[str]) -> float:
    if len(sentences) < 2:
        return 0.0
    try:
        model = _get_model()
        embeddings = model.encode(sentences, convert_to_numpy=True, show_progress_bar=False)
        if embeddings.ndim != 2 or embeddings.shape[0] < 2:
            return 0.0
        sim_matrix = cosine_similarity(embeddings)
        n = sim_matrix.shape[0]
        if n <= 1:
            return 0.0
        off_diag_sum = sim_matrix.sum() - np.trace(sim_matrix)
        off_diag_count = n * n - n
        return float(off_diag_sum / off_diag_count) if off_diag_count > 0 else 0.0
    except Exception:
        return 0.0


def is_likely_citation(sentence: str, url: str) -> bool:
    lower = sentence.lower()
    url_lower = (url or "").lower()
    if "[1]" in sentence or "[2]" in sentence or "[3]" in sentence:
        return True
    if "et al." in sentence:
        return True
    if "(" in sentence and ")" in sentence and "," in sentence:
        # crude (Author, Year) detector
        if any(year in sentence for year in ["2020", "2021", "2022", "2023", "2024", "2025", "2026"]):
            return True
    scholarly_hosts = [
        "pubmed",
        "doi.org",
        "cochranelibrary",
        "radiopaedia",
        "acr.org",
        "rsna.org",
        "ncbi",
    ]
    if any(host in url_lower for host in scholarly_hosts):
        return True
    return False


async def searxng_check(
    sentences: List[str],
    searxng_url: str,
) -> List[Dict[str, Any]]:
    if not sentences:
        return []

    matches: List[Dict[str, Any]] = []
    timeout = httpx.Timeout(10.0)

    async def fetch_sentence(s: str) -> None:
        nonlocal matches
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                params = {
                    "q": f"\"{s}\"",
                    "format": "json",
                    "engines": "google,bing",
                }
                resp = await client.get(f"{searxng_url.rstrip('/')}/search", params=params)
                if resp.status_code != 200:
                    return
                data = resp.json()
                results = data.get("results", [])
                for r in results:
                    url = r.get("url") or ""
                    title = r.get("title") or r.get("url") or "Unknown source"
                    content = r.get("content") or ""
                    overlap = compute_text_overlap(s, content or title)
                    if overlap > 0.75:
                        matches.append(
                            {
                                "matchedSentence": s[:200],
                                "source": title,
                                "url": url,
                                "matchPercent": round(overlap * 100, 1),
                                "isCitation": is_likely_citation(s, url),
                            }
                        )
        except Exception:
            # SearxNG down or unreachable — graceful degradation
            return

    await asyncio.gather(*(fetch_sentence(s) for s in sentences))
    return matches


async def qdrant_similarity_check(
    report_text: str,
    qdrant_client: Any,
    collection: str = "medical_papers",
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    if not qdrant_client:
        return []
    text = (report_text or "")[:2000]
    if not text.strip():
        return []
    try:
        model = _get_model()
        vector = model.encode([text], convert_to_numpy=True, show_progress_bar=False)[0]
        search_result = await qdrant_client.search(
            collection_name=collection,
            query_vector=vector.tolist(),
            limit=top_k,
            score_threshold=0.70,
        )
        matches: List[Dict[str, Any]] = []
        for point in search_result:
            payload = getattr(point, "payload", None) or {}
            title = payload.get("title") or "Unknown source"
            url = payload.get("url") or ""
            score = getattr(point, "score", None) or payload.get("score", 0.0)
            matches.append(
                {
                    "matchedSentence": text[:200],
                    "source": title,
                    "url": url,
                    "matchPercent": round(float(score) * 100, 1),
                    "isCitation": is_likely_citation(text, url),
                }
            )
        return matches
    except Exception:
        # Qdrant down or client not configured
        return []


async def check_originality(
    report_text: str,
    qdrant_client: Any = None,
    searxng_url: str = "http://searxng:8080",
) -> Dict[str, Any]:
    sentences = split_into_sentences(report_text)
    fingerprints = extract_fingerprint_sentences(report_text)

    try:
        web_matches_task = searxng_check(fingerprints, searxng_url)
        qdrant_matches_task = qdrant_similarity_check(report_text, qdrant_client)
        web_matches, vector_matches = await asyncio.gather(
            web_matches_task,
            qdrant_matches_task,
        )
    except Exception:
        web_matches, vector_matches = [], []

    all_matches = web_matches + vector_matches
    deduped: Dict[str, Dict[str, Any]] = {}
    for m in all_matches:
        key = m.get("url") or m.get("source") or m.get("matchedSentence")
        if not key:
            continue
        if key in deduped:
            existing = deduped[key]
            if m.get("matchPercent", 0) > existing.get("matchPercent", 0):
                deduped[key] = m
        else:
            deduped[key] = m
    matches = list(deduped.values())[:10]

    non_citation = [m for m in matches if not m.get("isCitation")]
    matched_sentences_count = len(non_citation)
    total_sentences = max(1, len(sentences))
    similarity_penalty = (matched_sentences_count / total_sentences) * 100.0

    internal_similarity = compute_self_similarity(sentences)
    internal_penalty = max(0.0, (internal_similarity - 0.3) * 50.0)

    originality_score = max(0, int(round(100.0 - similarity_penalty - internal_penalty)))

    result = {
        "originalityScore": originality_score,
        "matchedPercent": max(0, min(100, 100 - originality_score)),
        "matches": matches,
        "sentencesAnalysed": len(sentences),
        "sourcesSearched": len(matches),
        "layers": {
            "webSearch": len(web_matches),
            "vectorDB": len(vector_matches),
        },
        "scanDate": datetime.datetime.utcnow().isoformat() + "Z",
        "note": (
            "This originality score is an aid based on local embeddings, "
            "SearxNG web search, and Qdrant semantic similarity. It is not "
            "a certified plagiarism detection system."
        ),
    }
    return result

