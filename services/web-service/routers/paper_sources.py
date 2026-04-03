"""
paper_sources.py — Shared logic for “research paper” detection (Premium Web plan)
==================================================================================
Broad engine/URL heuristics so SearXNG science + medical results are not over-filtered.
"""

from __future__ import annotations

from typing import Any, Dict, List

# Substrings in SearXNG engine name → treat as academic / paper-like
ACADEMIC_ENGINE_TOKENS: tuple[str, ...] = (
    "pubmed",
    "scholar",
    "semantic",
    "arxiv",
    "cochrane",
    "plos",
    "bmj",
    "nejm",
    "springer",
    "wiley",
    "nature",
    "crossref",
    "core",
    "europe",
    "medline",
    "thelancet",
    "jamanetwork",
    "sciencedirect",
    "oup",
    "frontiersin",
    "mdpi",
    "hindawi",
    "biomedcentral",
    "unpaywall",
    "europe pmc",
    "google scholar",
    "statpearls",
    "openalex",
    "crossref",
    "doaj",
)

# URL substrings → likely research / institutional
ACADEMIC_URL_HINTS: tuple[str, ...] = (
    "pubmed",
    "ncbi.nlm",
    "doi.org",
    "europepmc.org",
    "cochrane",
    "nejm.org",
    "thelancet",
    "jamanetwork",
    "bmj.com",
    "nature.com",
    "sciencedirect",
    "springer",
    "wiley.com",
    "academic.oup",
    "plos.org",
    "frontiersin.org",
    "mdpi.com",
    "hindawi.com",
    "biomedcentral.com",
    "openalex.org",
    "arxiv.org",
    "biorxiv.org",
    "medrxiv.org",
    ".edu/",
    ".gov/",
    ".ac.uk/",
    "nih.gov",
    "fda.gov",
    "who.int",
)


def engine_implies_peer(engine: str) -> bool:
    """True if SearXNG engine name suggests an academic source."""
    e = (engine or "").lower().strip()
    if not e:
        return False
    return any(tok in e for tok in ACADEMIC_ENGINE_TOKENS)


def is_paper_candidate(result: Dict[str, Any]) -> bool:
    """True if this SearXNG-enriched row should appear in Research Papers tab."""
    if result.get("isPeerReviewed"):
        return True
    eng = (result.get("engine") or "").lower()
    if any(tok in eng for tok in ACADEMIC_ENGINE_TOKENS):
        return True
    url = (result.get("url") or "").lower()
    if any(h in url for h in ACADEMIC_URL_HINTS):
        return True
    return False


def tag_fallback_papers(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Mark general-web rows used as last-resort paper results."""
    for r in results:
        r.setdefault("paperFallback", True)
        r.setdefault("type", "article")
        r["trustScore"] = min(int(r.get("trustScore") or 50), 55)
    return results
