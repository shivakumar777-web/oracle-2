"""
plagiarism_service.py — Backward-compatible re-export
======================================================
Import from services.shared.plagiarism for new code.
"""
from services.shared.plagiarism import (
    check_originality,
    compute_self_similarity,
    compute_text_overlap,
    extract_fingerprint_sentences,
    is_likely_citation,
    qdrant_similarity_check,
    searxng_check,
    split_into_sentences,
)

__all__ = [
    "check_originality",
    "compute_self_similarity",
    "compute_text_overlap",
    "extract_fingerprint_sentences",
    "is_likely_citation",
    "qdrant_similarity_check",
    "searxng_check",
    "split_into_sentences",
]
