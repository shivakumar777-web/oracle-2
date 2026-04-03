"""
source_router.py — Source Strategy Router for Oracle Chat (Phase 2)
===================================================================
Determines which retrieval sources to query based on query intent,
evidence mode, and user flags. No I/O — pure routing logic.
"""

from __future__ import annotations

from enum import Enum
from typing import List

from query_intelligence import QueryType


class SourceStrategy(str, Enum):
    """Retrieval source identifiers."""

    MEILISEARCH = "meilisearch"
    QDRANT = "qdrant"
    SEARXNG = "searxng"
    PUBMED = "pubmed"
    CLINICAL_TRIALS = "clinical_trials"


def route_sources(
    query_type: QueryType,
    evidence: str,
    enable_web: bool,
    enable_trials: bool,
) -> List[SourceStrategy]:
    """Determine which sources to query for a given chat request.

    Args:
        query_type: From classify_query()
        evidence: auto | gold | all | guidelines | trials
        enable_web: User flag for SearXNG web search
        enable_trials: User flag for ClinicalTrials.gov

    Returns:
        Ordered list of strategies. Always includes MEILISEARCH and QDRANT first.
        Phase 4: Emergency queries use fast-track (RAG only, no external APIs).
    """
    strategies: List[SourceStrategy] = [
        SourceStrategy.MEILISEARCH,
        SourceStrategy.QDRANT,
    ]

    # Phase 4: Emergency fast-track — skip slow external sources for safety-critical queries
    if query_type == QueryType.EMERGENCY:
        return strategies

    # Clinical trials: when user wants trials, or query is trial-focused
    if enable_trials or evidence == "trials" or query_type == QueryType.CLINICAL_TRIAL:
        strategies.append(SourceStrategy.CLINICAL_TRIALS)

    # PubMed: for gold-standard or broad evidence
    if evidence in ("gold", "all", "trials"):
        strategies.append(SourceStrategy.PUBMED)

    # SearXNG: when web enabled, or general query needing fresh info
    if enable_web:
        strategies.append(SourceStrategy.SEARXNG)

    return strategies
