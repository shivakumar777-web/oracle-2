"""
Single source of truth for Universal Search domain → source pills and SearXNG site fragments.
Mirrors legacy orchestrator definitions; imported by research-service and exposed via GET /v1/config/domain-sources.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

# Source ids in DOMAIN_AUTO_SOURCES that have no SOURCE_SITE_FRAGMENT entry.
# Used to build OpenRouter web_search allowed_domains (hostnames / path-scoped hosts).
SOURCE_ID_ALLOW_DOMAIN_FALLBACK: Dict[str, List[str]] = {
    "pubmed": ["pubmed.ncbi.nlm.nih.gov"],
    "clinicaltrials": ["clinicaltrials.gov"],
}

_SITE_TOKEN_RE = re.compile(r"site:([^\s)]+)", re.IGNORECASE)

# Site-scoped SearXNG helpers (source pill id → query fragment).
SOURCE_SITE_FRAGMENT: Dict[str, str] = {
    "cochrane": "site:cochranelibrary.com",
    "who": "site:who.int",
    "ayush-formulary": "(site:ccras.nic.in OR site:ayush.gov.in)",
    "ccrum": "(site:ccrum.net OR site:ccrum.res.in)",
    "ccrs": "site:ccrs.gov.in",
    "homeopathy-research": "site:hri-research.org",
    "embase": "site:embase.com",
    "radiopaedia": "site:radiopaedia.org",
    "uptodate": "site:uptodate.com",
    "doaj": "site:doaj.org",
    "indian-journals": "(site:ijam.co.in OR site:ayujournal.org)",
    "ncbi-books": "site:ncbi.nlm.nih.gov/books",
    "ctri-india": "site:ctri.nic.in",
    "who-iris": "site:iris.who.int",
    "europe-pmc": "site:europepmc.org",
    "who-gim": "site:globalindexmedicus.net",
    "indmed": "site:indmed.nic.in",
    "cdsco": "site:cdsco.gov.in",
    "icmr": "site:icmr.gov.in",
    "nice": "site:nice.org.uk",
    "nccih": "site:nccih.nih.gov",
    "ecam": "site:hindawi.com/journals/ecam",
    "ccras": "site:ccras.nic.in",
    "ayush-portal": "site:ayushresearch.gov.in",
    "pcimh": "site:pcimh.gov.in",
    "pharmacopoeia-ayush": "(site:pharmacopoeia.ayush.gov.in OR site:pcimh.gov.in)",
    "shodhganga": "site:shodhganga.inflibnet.ac.in",
    "niimh": "site:niimh.nic.in",
    "tkdl": "site:tkdl.res.in",
    "imppat": "site:cb.imsc.res.in",
    "nmpb": "site:nmpb.nic.in",
    "frlht-medplant": "site:frlht.org",
    "jaim": "site:jaim.in",
    "ccrh": "site:ccrhindia.nic.in",
    "core-hom": "site:carstens-stiftung.de",
    "nis-chennai": "site:nischennai.org",
    "tnmgrmu": "site:tnmgrmu.ac.in",
    "nium": "site:nium.in",
    "hamdard-medicus": "site:hamdard.edu.pk",
    "who-emro": "(site:emro.who.int OR site:applications.emro.who.int)",
    "imemr": "site:applications.emro.who.int/imemr",
    "jamia-hamdard": "site:jhamdard.edu",
    "amu-unani": "site:amu.ac.in",
}

DOMAIN_AUTO_SOURCES: Dict[str, List[str]] = {
    "allopathy": [
        "pubmed",
        "clinicaltrials",
        "cochrane",
        "who",
        "embase",
        "radiopaedia",
        "uptodate",
        "ctri-india",
        "who-iris",
        "europe-pmc",
        "who-gim",
        "indmed",
        "cdsco",
        "icmr",
        "nice",
        "nccih",
    ],
    "ayurveda": [
        "ccras",
        "ayush-formulary",
        "ayush-portal",
        "pcimh",
        "pharmacopoeia-ayush",
        "shodhganga",
        "niimh",
        "tkdl",
        "imppat",
        "nmpb",
        "frlht-medplant",
        "jaim",
        "pubmed",
        "cochrane",
        "doaj",
        "indian-journals",
        "nccih",
    ],
    "homeopathy": [
        "ccrh",
        "pcimh",
        "core-hom",
        "homeopathy-research",
        "pubmed",
        "cochrane",
        "doaj",
        "nccih",
    ],
    "siddha": [
        "ccrs",
        "pcimh",
        "shodhganga",
        "nis-chennai",
        "tnmgrmu",
        "pubmed",
        "doaj",
        "indian-journals",
        "ayush-formulary",
        "niimh",
    ],
    "unani": [
        "ccrum",
        "pcimh",
        "shodhganga",
        "nium",
        "hamdard-medicus",
        "who-emro",
        "imemr",
        "jamia-hamdard",
        "amu-unani",
        "pubmed",
        "doaj",
        "indian-journals",
    ],
}

INTEGRATIVE_CROSS_DOMAIN_CORE: List[str] = [
    "europe-pmc",
    "ctri-india",
    "who-iris",
    "ayush-portal",
    "shodhganga",
    "pcimh",
    "nccih",
    "who-gim",
    "ecam",
    "pubmed",
    "doaj",
    "cochrane",
]


def openrouter_allowed_domains_for_ui_domain(
    domain_key: str,
    *,
    query: str = "",
    max_domains: int = 12,
    max_source_ids_scan: int = 24,
) -> List[str]:
    """
    Hostnames (and path-scoped entries like ncbi.nlm.nih.gov/books) for OpenRouter
    ``openrouter:web_search`` ``allowed_domains``, derived from DOMAIN_AUTO_SOURCES
    and SOURCE_SITE_FRAGMENT (plus SOURCE_ID_ALLOW_DOMAIN_FALLBACK).

    Source pill order is metadata-ranked (``domain_sources_meta.rank_sources``) when
    ``query`` is provided or empty (still applies evidence/access/freshness weights).
    """
    from services.shared.domain_sources_meta import rank_sources

    candidates = DOMAIN_AUTO_SOURCES.get(domain_key, [])[:max_source_ids_scan]
    ranked_ids = [sid for sid, _ in rank_sources(list(candidates), query or "", [domain_key])]

    out: List[str] = []
    seen: set[str] = set()
    for sid in ranked_ids:
        frag = SOURCE_SITE_FRAGMENT.get(sid)
        if frag:
            for m in _SITE_TOKEN_RE.finditer(frag):
                host = m.group(1).strip().rstrip("/")
                if not host:
                    continue
                if host not in seen:
                    seen.add(host)
                    out.append(host)
                    if len(out) >= max_domains:
                        return out
        else:
            for host in SOURCE_ID_ALLOW_DOMAIN_FALLBACK.get(sid, []):
                if host not in seen:
                    seen.add(host)
                    out.append(host)
                    if len(out) >= max_domains:
                        return out
    return out


def ranked_search_priority_entries(
    domain_key: str,
    query: str = "",
    *,
    top_k: int = 6,
    max_source_ids_scan: int = 24,
) -> List[Dict[str, Any]]:
    """
    Top ranked sources with human-readable labels (SOURCE_META) and site hints
    for LLM SEARCH PRIORITIES prompts.
    """
    from services.shared.domain_sources_meta import SOURCE_META, rank_sources

    candidates = DOMAIN_AUTO_SOURCES.get(domain_key, [])[:max_source_ids_scan]
    ranked_ids = [sid for sid, _ in rank_sources(list(candidates), query or "", [domain_key])]
    entries: List[Dict[str, Any]] = []
    for sid in ranked_ids:
        if len(entries) >= top_k:
            break
        frag = SOURCE_SITE_FRAGMENT.get(sid)
        fallback_hosts = SOURCE_ID_ALLOW_DOMAIN_FALLBACK.get(sid)
        if not frag and not fallback_hosts:
            continue
        meta = SOURCE_META.get(sid)
        if frag:
            site_clean = frag.replace("(", "").replace(")", "").replace(" OR ", ", ")
        else:
            site_clean = ", ".join(h for h in (fallback_hosts or []))
        entries.append(
            {
                "id": sid,
                "short_name": meta.short_name if meta else sid,
                "display_name": meta.display_name if meta else sid,
                "site_hint": site_clean,
            }
        )
    return entries


def build_openrouter_web_search_parameters(
    domain_key: str,
    *,
    query: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Parameters for OpenRouter ``openrouter:web_search`` server tool (Chat Completions API).

    Uses Exa when we have ``allowed_domains`` (reliable domain filtering per OpenRouter docs);
    otherwise ``engine: auto`` for a broad search.
    """
    allowed = openrouter_allowed_domains_for_ui_domain(domain_key, query=query or "")
    params: Dict[str, Any] = {
        "max_results": 5,
        "max_total_results": 20,
    }
    if allowed:
        params["engine"] = "exa"
        params["allowed_domains"] = allowed
        params["search_context_size"] = "medium"
    else:
        params["engine"] = "auto"
    return params


def get_sources_for_domains(domains: List[str]) -> List[str]:
    """Auto-select all relevant source pill ids for chosen medical traditions."""
    sources: set[str] = set()
    for d in domains:
        for s in DOMAIN_AUTO_SOURCES.get(d, []):
            sources.add(s)
    if len(domains) >= 2:
        for s in INTEGRATIVE_CROSS_DOMAIN_CORE:
            sources.add(s)
    return sorted(sources)
