"""
reranker.py — Heuristic Re-ranking for Oracle Chat (Phase 2)
============================================================
Lightweight relevance re-ranking without cross-encoder model.
Scores documents by query-term overlap (title + content).
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Tuple


def _tokenize(text: str) -> List[str]:
    """Extract lowercase word tokens."""
    if not text:
        return []
    cleaned = re.sub(r"[^\w\s]", " ", str(text).lower())
    return [w for w in cleaned.split() if len(w) > 1]


def _score_doc(doc: Dict[str, Any], query_tokens: List[str]) -> float:
    """Score a document by query-term overlap. Title matches weighted higher."""
    title = doc.get("title", "") or ""
    content = doc.get("content", "") or doc.get("snippet", "") or ""
    title_tokens = set(_tokenize(title))
    content_tokens = set(_tokenize(content))

    score = 0.0
    for t in query_tokens:
        if t in title_tokens:
            score += 3.0  # Title match
        elif t in content_tokens:
            score += 1.0  # Content match
    return score


def rerank_by_relevance(
    docs: List[Dict[str, Any]],
    query: str,
    top_k: int = 10,
) -> List[Dict[str, Any]]:
    """Re-rank documents by heuristic relevance to query.

    Uses simple term-overlap scoring. Title matches weighted 3x content.
    Preserves original order as tiebreaker.
    """
    if not docs or not query:
        return docs[:top_k]

    query_tokens = _tokenize(query)
    if not query_tokens:
        return docs[:top_k]

    scored: List[Tuple[float, int, Dict[str, Any]]] = []
    for i, doc in enumerate(docs):
        s = _score_doc(doc, query_tokens)
        scored.append((s, -i, doc))  # -i for stable tiebreak (earlier = better)

    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return [doc for _, _, doc in scored[:top_k]]
