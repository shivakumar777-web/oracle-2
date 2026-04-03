"""
aggregator.py — Shared search aggregation helpers (Premium Web plan)
====================================================================
De-duplication, light categorization, and merge utilities used by tab routers.
"""

from __future__ import annotations

from typing import Any, Dict, List, Set


def merge_unique_by_url(*lists: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Merge result lists, deduplicating by URL (first wins)."""
    seen: Set[str] = set()
    merged: List[Dict[str, Any]] = []
    for lst in lists:
        for r in lst:
            url = (r.get("url") or "").strip()
            if not url or url in seen:
                continue
            seen.add(url)
            merged.append(r)
    return merged


def infer_medical_category(engine: str, url: str) -> str:
    """Coarse bucket for logging / future routing (general|science|guideline|trial)."""
    e = (engine or "").lower()
    u = (url or "").lower()
    if "clinicaltrials.gov" in u or "ctri.nic.in" in u:
        return "trial"
    if "guideline" in u or "who.int" in u or "nice.org" in u:
        return "guideline"
    if any(x in e for x in ("pubmed", "scholar", "arxiv", "crossref", "openalex", "core", "doaj")):
        return "science"
    return "general"
