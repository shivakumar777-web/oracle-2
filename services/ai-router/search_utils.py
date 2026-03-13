"""
search_utils.py — Manthana Web Search Helpers
All pure functions + async helpers for the /search route.
No LLM calls. No AI. Pure medical intelligence.
"""

from __future__ import annotations

import hashlib
import json
import logging
import random
from typing import Any, Optional
from urllib.parse import urlparse

import httpx

log = logging.getLogger("manthana-search")

# ═══════════════════════════════════════════════════════════════════════
# TRUST SCORING
# ═══════════════════════════════════════════════════════════════════════

TRUST_SCORES: dict[str, int] = {
    # ── Tier 1: Gold-standard medical journals ─────────────────────────
    "pubmed.ncbi.nlm.nih.gov": 99,
    "cochranelibrary.com": 98,
    "nejm.org": 97,
    "who.int": 97,
    "nih.gov": 96,
    "lancet.com": 96,
    "thelancet.com": 96,
    "bmj.com": 95,
    "jama.jamanetwork.com": 95,
    "nature.com": 94,
    "cell.com": 93,
    "journals.plos.org": 92,
    "bmjopen.bmj.com": 91,
    "annals.org": 92,
    "jamanetwork.com": 94,

    # ── Tier 2: Indian government medical sources ──────────────────────
    "icmr.gov.in": 96,
    "mohfw.gov.in": 95,
    "ayush.gov.in": 95,
    "cdsco.gov.in": 95,
    "ccras.nic.in": 94,
    "ccrh.gov.in": 94,
    "ccrum.net": 94,
    "ccsiddha.nic.in": 94,
    "ctri.nic.in": 93,
    "nmpb.nic.in": 92,
    "niimh.nic.in": 92,
    "ccryn.gov.in": 91,
    "pgimer.edu.in": 90,
    "aiims.edu": 93,

    # ── Tier 3: High-quality medical resources ─────────────────────────
    "europepmc.org": 93,
    "semanticscholar.org": 92,
    "core.ac.uk": 91,
    "clinicaltrials.gov": 93,
    "scholar.google.com": 90,
    "uptodate.com": 88,
    "medscape.com": 82,
    "radiopaedia.org": 88,
    "statpearls.com": 87,
    "drugs.com": 80,
    "medlineplus.gov": 85,
    "cdc.gov": 90,
    "acr.org": 88,
    "rxlist.com": 79,
    "ncbi.nlm.nih.gov": 95,
    "unpaywall.org": 88,
    "doaj.org": 87,
    "europe.who.int": 96,
    "emro.who.int": 93,

    # ── Tier 4: General educational ────────────────────────────────────
    "mayoclinic.org": 78,
    "wikipedia.org": 55,
    "healthline.com": 62,
    "webmd.com": 58,
    "everydayhealth.com": 50,
    "medicalnewstoday.com": 60,
}

PEER_REVIEWED_DOMAINS: set[str] = {
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "cochranelibrary.com",
    "nejm.org",
    "lancet.com",
    "thelancet.com",
    "bmj.com",
    "jama.jamanetwork.com",
    "jamanetwork.com",
    "nature.com",
    "cell.com",
    "europepmc.org",
    "semanticscholar.org",
    "journals.plos.org",
    "bmjopen.bmj.com",
    "annals.org",
}

OFFICIAL_DOMAINS: set[str] = {
    "who.int",
    "europe.who.int",
    "emro.who.int",
    "nih.gov",
    "cdc.gov",
    "icmr.gov.in",
    "mohfw.gov.in",
    "ayush.gov.in",
    "cdsco.gov.in",
    "ccras.nic.in",
    "ccrh.gov.in",
    "ccrum.net",
    "ccsiddha.nic.in",
    "ctri.nic.in",
    "nmpb.nic.in",
    "niimh.nic.in",
    "ccryn.gov.in",
    "clinicaltrials.gov",
    "aiims.edu",
}

OPEN_ACCESS_DOMAINS: set[str] = {
    "europepmc.org",
    "core.ac.uk",
    "unpaywall.org",
    "doaj.org",
    "journals.plos.org",
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
}

SOURCE_LABELS: dict[str, str] = {
    "pubmed.ncbi.nlm.nih.gov": "PubMed",
    "ncbi.nlm.nih.gov": "NCBI",
    "cochranelibrary.com": "Cochrane",
    "who.int": "WHO",
    "nih.gov": "NIH",
    "cdc.gov": "CDC",
    "nejm.org": "NEJM",
    "bmj.com": "BMJ",
    "lancet.com": "Lancet",
    "thelancet.com": "Lancet",
    "jama.jamanetwork.com": "JAMA",
    "jamanetwork.com": "JAMA Network",
    "nature.com": "Nature",
    "cell.com": "Cell",
    "icmr.gov.in": "ICMR",
    "mohfw.gov.in": "MoHFW",
    "ayush.gov.in": "AYUSH",
    "cdsco.gov.in": "CDSCO",
    "ccras.nic.in": "CCRAS",
    "ccrh.gov.in": "CCRH",
    "ccrum.net": "CCRUM",
    "ccsiddha.nic.in": "CCSIDDHA",
    "ctri.nic.in": "CTRI India",
    "nmpb.nic.in": "NMPB",
    "niimh.nic.in": "NIIMH",
    "ccryn.gov.in": "CCRYN",
    "aiims.edu": "AIIMS",
    "clinicaltrials.gov": "ClinicalTrials",
    "semanticscholar.org": "Semantic Scholar",
    "europepmc.org": "Europe PMC",
    "core.ac.uk": "CORE",
    "medscape.com": "Medscape",
    "radiopaedia.org": "Radiopaedia",
    "uptodate.com": "UpToDate",
    "medlineplus.gov": "MedlinePlus",
    "statpearls.com": "StatPearls",
    "drugs.com": "Drugs.com",
    "rxlist.com": "RxList",
    "wikipedia.org": "Wikipedia",
    "mayoclinic.org": "Mayo Clinic",
    "healthline.com": "Healthline",
    "webmd.com": "WebMD",
    "journals.plos.org": "PLOS",
    "bmjopen.bmj.com": "BMJ Open",
    "unpaywall.org": "Unpaywall",
    "doaj.org": "DOAJ",
}

MEDICAL_QUESTION_TEMPLATES: list[str] = [
    "What is the dosage of {topic}?",
    "What are the side effects of {topic}?",
    "Is {topic} safe during pregnancy?",
    "What are the contraindications of {topic}?",
    "How does {topic} work mechanistically?",
    "What is the clinical evidence for {topic}?",
    "What are effective alternatives to {topic}?",
    "{topic} — Ayurveda vs Allopathy comparison",
    "Latest clinical trials for {topic}",
    "ICD-10 codes related to {topic}",
    "WHO guidelines on {topic}",
    "Drug interactions involving {topic}",
]


# ═══════════════════════════════════════════════════════════════════════
# DOMAIN UTILITIES
# ═══════════════════════════════════════════════════════════════════════

def extract_domain(url: str) -> str:
    """Extract bare domain (no www) from URL."""
    try:
        return urlparse(url).netloc.replace("www.", "").lower()
    except Exception:
        return ""


def get_trust_score(url: str) -> int:
    """Return trust score 0-100 for a URL, 45 for unknown sources."""
    domain = extract_domain(url)
    for key, score in TRUST_SCORES.items():
        if key in domain:
            return score
    # Slight boost for .gov and .edu domains we don't know yet
    if domain.endswith(".gov.in") or domain.endswith(".nic.in"):
        return 80
    if domain.endswith(".gov") or domain.endswith(".edu"):
        return 72
    return 45


def detect_result_type(url: str, raw: dict[str, Any]) -> str:
    """Classify result as article / video / image / pdf / trial / guideline."""
    url_lower = url.lower()
    if any(x in url_lower for x in ["youtube.com", "vimeo.com", "/video/"]):
        return "video"
    if raw.get("img_src") and not raw.get("content"):
        return "image"
    if any(x in url_lower for x in ["/pdf", ".pdf", "download"]):
        return "pdf"
    if "clinicaltrials.gov" in url_lower or "ctri.nic.in" in url_lower:
        return "trial"
    if any(x in url_lower for x in ["guideline", "guidance", "protocol", "recommendations"]):
        return "guideline"
    return "article"


def enrich_result(raw: dict[str, Any], category: str) -> dict[str, Any]:
    """Enrich a raw SearxNG result with trust data, badges, and type."""
    url: str = raw.get("url", "")
    domain = extract_domain(url)
    trust = get_trust_score(url)
    source = SOURCE_LABELS.get(domain, domain or raw.get("engine", "Web"))

    return {
        "title": raw.get("title", ""),
        "url": url,
        "snippet": raw.get("content", raw.get("snippet", "")),
        "source": source,
        "domain": domain,
        "engine": raw.get("engine", ""),
        "publishedDate": raw.get("publishedDate", None),
        "trustScore": trust,
        "isPeerReviewed": domain in PEER_REVIEWED_DOMAINS,
        "isOfficial": domain in OFFICIAL_DOMAINS,
        "isOpenAccess": domain in OPEN_ACCESS_DOMAINS,
        "thumbnail": raw.get("thumbnail", None),
        "type": detect_result_type(url, raw),
    }


def deduplicate_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Remove duplicate URLs and near-identical titles (first 50 chars)."""
    seen_urls: set[str] = set()
    seen_titles: set[str] = set()
    unique: list[dict[str, Any]] = []
    for r in results:
        url_key = r.get("url", "").rstrip("/").lower()
        title_key = r.get("title", "")[:50].lower().strip()
        if url_key not in seen_urls and title_key not in seen_titles:
            seen_urls.add(url_key)
            if title_key:
                seen_titles.add(title_key)
            unique.append(r)
    return unique


def sort_by_trust(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Sort results by composite medical credibility score.
    Official + peer-reviewed sources float to the top.
    Wikipedia / generic health blogs sink to the bottom.
    """
    generic_domains = {"wikipedia.org", "webmd.com", "healthline.com",
                       "everydayhealth.com", "medicalnewstoday.com"}

    def sort_key(r: dict[str, Any]) -> int:
        score = r.get("trustScore", 45)
        if r.get("isOfficial"):
            score += 20
        if r.get("isPeerReviewed"):
            score += 15
        if r.get("isOpenAccess"):
            score += 5
        if r.get("type") in ("trial", "guideline"):
            score += 8
        if r.get("domain", "") in generic_domains:
            score -= 20
        return -score  # negative → descending sort

    return sorted(results, key=sort_key)


# ═══════════════════════════════════════════════════════════════════════
# RELATED QUESTIONS (pure NLP, zero LLM cost)
# ═══════════════════════════════════════════════════════════════════════

_STOP_WORDS: set[str] = {
    "in", "for", "of", "the", "a", "an", "and", "or", "with",
    "vs", "versus", "treatment", "management", "therapy", "use",
    "using", "what", "how", "why", "when", "is", "are", "does",
}


def generate_related_questions(query: str, top_results: list[dict[str, Any]]) -> list[str]:
    """
    Generate 5 related medical questions without any LLM.
    Extracts main topic from query + uses medical templates.
    """
    words = [w for w in query.lower().split() if w not in _STOP_WORDS]
    topic = " ".join(words[:3]) if words else query

    templates = random.sample(MEDICAL_QUESTION_TEMPLATES,
                               min(5, len(MEDICAL_QUESTION_TEMPLATES)))
    return [t.format(topic=topic) for t in templates]


# ═══════════════════════════════════════════════════════════════════════
# SEARXNG FETCH (with Redis caching)
# ═══════════════════════════════════════════════════════════════════════

async def fetch_searxng(
    query: str,
    category: str,
    fmt: str = "json",
    page: int = 1,
    searxng_url: str = "http://searxng:8080",
    redis_client: Optional[Any] = None,
) -> dict[str, Any]:
    """
    Fetch results from SearxNG with optional Redis caching.
    Cache TTL: 300 seconds. Falls back gracefully on any error.
    """
    cache_key = (
        f"searxng:{hashlib.sha256(f'{query}{category}{page}'.encode()).hexdigest()[:20]}"
    )

    # ── Check Redis cache first ────────────────────────────────────────
    if redis_client is not None:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                log.info(f"[CACHE HIT] {cache_key}")
                return json.loads(cached)
        except Exception as e:
            log.warning(f"[REDIS] Read failed: {e}")

    # ── Query SearxNG ──────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(timeout=8.0) as client:
            res = await client.get(
                f"{searxng_url}/search",
                params={
                    "q": query,
                    "format": fmt,
                    "categories": category,
                    "language": "en",
                    "pageno": page,
                },
            )
            res.raise_for_status()
            data: dict[str, Any] = res.json()

            # ── Cache successful response ───────────────────────────────
            if redis_client is not None and data.get("results"):
                try:
                    await redis_client.setex(cache_key, 300, json.dumps(data))
                except Exception as e:
                    log.warning(f"[REDIS] Write failed: {e}")

            return data
    except Exception as e:
        log.warning(f"[SEARXNG] fetch failed (category={category}): {e}")
        return {"results": [], "number_of_results": 0}


# ═══════════════════════════════════════════════════════════════════════
# OWN INDEX SEARCH (Meilisearch — previously indexed content)
# ═══════════════════════════════════════════════════════════════════════

async def search_own_index_async(
    query: str,
    category: str,
    meilisearch_url: str = "http://meilisearch:7700",
    meilisearch_key: str = "masterKey",
) -> list[dict[str, Any]]:
    """
    Fast search (<50ms) over Manthana's own indexed content in Meilisearch.
    Returns up to 5 previously indexed, enriched results.
    """
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            body: dict[str, Any] = {
                "q": query,
                "limit": 5,
                "attributesToHighlight": ["title", "content"],
            }
            if category and category != "medical":
                body["filter"] = f'category = "{category}"'

            res = await client.post(
                f"{meilisearch_url}/indexes/medical_search/search",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {meilisearch_key}",
                },
            )
            if res.status_code == 200:
                return res.json().get("hits", [])
    except Exception as e:
        log.debug(f"[OWN INDEX] search failed: {e}")
    return []
