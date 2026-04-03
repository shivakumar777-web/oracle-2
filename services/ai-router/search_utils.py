"""
Backward-compat re-export from services.shared.search_utils.
Prefer: from services.shared.search_utils import ...
"""
import os
import sys

_project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

from services.shared.search_utils import (
    TRUST_SCORES,
    PEER_REVIEWED_DOMAINS,
    _make_cache_key,
    deduplicate_results,
    detect_result_type,
    enrich_result,
    extract_domain,
    fetch_searxng,
    generate_related_questions,
    get_trust_score,
    search_own_index_async,
    sort_by_trust,
)

__all__ = [
    "TRUST_SCORES",
    "PEER_REVIEWED_DOMAINS",
    "_make_cache_key",
    "deduplicate_results",
    "detect_result_type",
    "enrich_result",
    "extract_domain",
    "fetch_searxng",
    "generate_related_questions",
    "get_trust_score",
    "search_own_index_async",
    "sort_by_trust",
]
