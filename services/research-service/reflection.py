"""
Source quality scoring — prefer credible connectors and domain-relevant hits.
"""

from __future__ import annotations

from typing import Any, Dict, List

SOURCE_CREDIBILITY: Dict[str, float] = {
    "pubmed": 1.00,
    "clinicaltrials": 0.95,
    "meilisearch": 0.85,
    "qdrant": 0.85,
    "searxng:ayush": 0.80,
    "searxng:siddha": 0.80,
    "searxng:unani": 0.80,
    "searxng:homeopathy": 0.75,
    "perplexica": 0.70,
    "searxng": 0.55,
}

DOMAIN_BOOST: Dict[str, List[str]] = {
    "allopathy": ["pubmed", "clinicaltrials", "meilisearch"],
    "ayurveda": ["searxng:ayush", "meilisearch"],
    "unani": ["searxng:unani", "meilisearch"],
    "siddha": ["searxng:siddha", "meilisearch"],
    "homeopathy": ["searxng:homeopathy", "meilisearch"],
}


def _cred_for_source(source_key: str) -> float:
    """Best prefix match against SOURCE_CREDIBILITY keys (longest first)."""
    sk = source_key or ""
    best = 0.50
    for k, v in sorted(SOURCE_CREDIBILITY.items(), key=lambda x: -len(x[0])):
        if sk.startswith(k):
            best = max(best, v)
    return best


def _domain_boost_for_source(source_key: str, domains: List[str]) -> float:
    sk = source_key or ""
    for domain in domains:
        for pref in DOMAIN_BOOST.get(domain, []):
            if sk.startswith(pref) or pref in sk:
                return 0.10
    return 0.0


def score_sources(
    docs: List[Dict[str, Any]],
    question: str,
    domains: List[str],
) -> List[Dict[str, Any]]:
    query_tokens = set(question.lower().split())

    for doc in docs:
        source_key = str(doc.get("source") or "")
        cred = _cred_for_source(source_key)
        domain_boost = _domain_boost_for_source(source_key, domains)
        doc_text = (
            (doc.get("title") or "")
            + " "
            + (doc.get("snippet") or doc.get("content") or "")
        ).lower()
        doc_tokens = set(doc_text.split())
        overlap = len(query_tokens & doc_tokens)
        relevance = min(overlap / max(len(query_tokens), 1), 1.0)
        year = doc.get("year") or doc.get("publication_year")
        recency_boost = 0.05 if year and str(year) >= "2020" else 0.0
        doc["_score"] = cred * 0.50 + relevance * 0.30 + domain_boost + recency_boost
    return sorted(docs, key=lambda d: d.get("_score", 0), reverse=True)


def filter_low_quality(docs: List[Dict[str, Any]], min_score: float = 0.30) -> List[Dict[str, Any]]:
    """Drop low _score items; if that leaves fewer than 5, keep top 5 from scored ordering."""
    filtered = [d for d in docs if d.get("_score", 1.0) >= min_score]
    if len(filtered) < 5 and len(docs) >= 5:
        return docs[:5]
    if len(filtered) < 5:
        return docs
    return filtered
