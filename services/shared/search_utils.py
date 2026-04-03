"""
search_utils.py — Manthana Web Search Helpers
==============================================
Pure functions + async helpers for the /search route.
No LLM calls.  No AI.  Pure medical intelligence.

Responsibilities:
  • Domain trust-scoring (80+ medical domains, 5-tier hierarchy)
  • Result enrichment with badges (peer-reviewed, official, open-access)
  • Composite credibility ranking
  • Near-duplicate removal (URL + title fingerprint)
  • Deterministic related-question generation (zero LLM cost)
  • SearXNG fetch with Redis caching and retry
  • Meilisearch own-index search

Shared by ai-router and (future) orchestrator.
"""

from __future__ import annotations

import hashlib
import json
import logging
import re
from typing import Any, Dict, FrozenSet, List, Optional, Set, Tuple
from urllib.parse import urlparse

import httpx

logger = logging.getLogger("manthana.search")

# ═══════════════════════════════════════════════════════════════════════
#  TRUST SCORING — 5-tier domain registry
# ═══════════════════════════════════════════════════════════════════════
# Scores are 0-100.  Unknown domains start at 45.
# .gov / .edu / .gov.in / .nic.in / .ac.in get a floor boost.

TRUST_SCORES: Dict[str, int] = {
    # ── Tier 1 (95-99): Gold-standard research & government ───────────
    "pubmed.ncbi.nlm.nih.gov": 99,
    "ncbi.nlm.nih.gov":        95,
    "cochranelibrary.com":      98,
    "nejm.org":                 97,
    "who.int":                  97,
    "europe.who.int":           96,
    "emro.who.int":             93,
    "nih.gov":                  96,
    "lancet.com":               96,
    "thelancet.com":            96,
    "bmj.com":                  95,
    "jama.jamanetwork.com":     95,
    "jamanetwork.com":          94,
    "nature.com":               94,
    "cell.com":                 93,
    "journals.plos.org":        92,
    "bmjopen.bmj.com":          91,
    "annals.org":               92,
    "clinicaltrials.gov":       93,

    # ── Tier 2 (90-96): Indian government medical sources ─────────────
    "icmr.gov.in":    96,
    "mohfw.gov.in":   95,
    "ayush.gov.in":   95,
    "cdsco.gov.in":   95,
    "ccras.nic.in":   94,
    "ccrh.gov.in":    94,
    "ccrum.net":      94,
    "ccsiddha.nic.in": 94,
    "ctri.nic.in":    93,
    "aiims.edu":      93,
    "nmpb.nic.in":    92,
    "niimh.nic.in":   92,
    "ccryn.gov.in":   91,
    "pgimer.edu.in":  90,
    "nimhans.ac.in":  90,
    "jipmer.edu.in":  90,
    "ipc.gov.in":     89,

    # ── Tier 3 (80-93): High-quality medical resources ────────────────
    "europepmc.org":       93,
    "semanticscholar.org": 92,
    "core.ac.uk":          91,
    "scholar.google.com":  90,
    "cdc.gov":             90,
    "fda.gov":             89,
    "ema.europa.eu":       89,
    "uptodate.com":        88,
    "radiopaedia.org":     88,
    "unpaywall.org":       88,
    "acr.org":             88,
    "doaj.org":            87,
    "statpearls.com":      87,
    "medlineplus.gov":     85,
    "medscape.com":        82,
    "drugs.com":           80,
    "springer.com":        85,
    "link.springer.com":   85,
    "wiley.com":           84,
    "onlinelibrary.wiley.com": 84,
    "sciencedirect.com":   86,
    "academic.oup.com":    85,
    "frontiersin.org":     83,
    "mdpi.com":            78,
    "biorxiv.org":         80,
    "medrxiv.org":         80,

    # ── Tier 3b: Indian medical systems (Ayurveda/Siddha/Unani/Homoeopathy)
    "dharaonline.org":     82,
    "iamj.in":             78,
    "jaims.in":            78,
    "ijrap.net":           75,
    "nhp.gov.in":          85,
    "tkdl.res.in":         88,

    # ── Tier 4 (50-79): General educational / consumer health ─────────
    "mayoclinic.org":        78,
    "rxlist.com":            79,
    "medicalnewstoday.com":  60,
    "healthline.com":        62,
    "webmd.com":             58,
    "wikipedia.org":         55,
    "everydayhealth.com":    50,
    "verywellhealth.com":    58,
    "patient.info":          65,
    "nhs.uk":                82,
}

# ── Domain classification sets ────────────────────────────────────────

PEER_REVIEWED_DOMAINS: FrozenSet[str] = frozenset({
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
    "springer.com",
    "link.springer.com",
    "wiley.com",
    "onlinelibrary.wiley.com",
    "sciencedirect.com",
    "academic.oup.com",
    "frontiersin.org",
    "biorxiv.org",
    "medrxiv.org",
})

OFFICIAL_DOMAINS: FrozenSet[str] = frozenset({
    "who.int",
    "europe.who.int",
    "emro.who.int",
    "nih.gov",
    "cdc.gov",
    "fda.gov",
    "ema.europa.eu",
    "nhs.uk",
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
    "nhp.gov.in",
    "ipc.gov.in",
    "tkdl.res.in",
})

OPEN_ACCESS_DOMAINS: FrozenSet[str] = frozenset({
    "europepmc.org",
    "core.ac.uk",
    "unpaywall.org",
    "doaj.org",
    "journals.plos.org",
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "biorxiv.org",
    "medrxiv.org",
    "frontiersin.org",
    "mdpi.com",
})

# Domains that should be penalised in medical ranking
_GENERIC_HEALTH_DOMAINS: FrozenSet[str] = frozenset({
    "wikipedia.org",
    "webmd.com",
    "healthline.com",
    "everydayhealth.com",
    "medicalnewstoday.com",
    "verywellhealth.com",
})

# ── Human-readable source labels ───────────────────────────────────────

SOURCE_LABELS: Dict[str, str] = {
    "pubmed.ncbi.nlm.nih.gov": "PubMed",
    "ncbi.nlm.nih.gov":        "NCBI",
    "cochranelibrary.com":      "Cochrane",
    "who.int":                  "WHO",
    "europe.who.int":           "WHO Europe",
    "emro.who.int":             "WHO EMRO",
    "nih.gov":                  "NIH",
    "cdc.gov":                  "CDC",
    "fda.gov":                  "FDA",
    "ema.europa.eu":            "EMA",
    "nhs.uk":                   "NHS",
    "nejm.org":                 "NEJM",
    "bmj.com":                  "BMJ",
    "lancet.com":               "Lancet",
    "thelancet.com":            "Lancet",
    "jama.jamanetwork.com":     "JAMA",
    "jamanetwork.com":          "JAMA Network",
    "nature.com":               "Nature",
    "cell.com":                 "Cell",
    "icmr.gov.in":              "ICMR",
    "mohfw.gov.in":             "MoHFW India",
    "ayush.gov.in":             "AYUSH",
    "cdsco.gov.in":             "CDSCO",
    "ccras.nic.in":             "CCRAS",
    "ccrh.gov.in":              "CCRH",
    "ccrum.net":                "CCRUM",
    "ccsiddha.nic.in":          "CCSIDDHA",
    "ctri.nic.in":              "CTRI India",
    "nmpb.nic.in":              "NMPB",
    "niimh.nic.in":             "NIIMH",
    "ccryn.gov.in":             "CCRYN",
    "aiims.edu":                "AIIMS",
    "pgimer.edu.in":            "PGIMER",
    "nimhans.ac.in":            "NIMHANS",
    "jipmer.edu.in":            "JIPMER",
    "ipc.gov.in":               "IPC India",
    "nhp.gov.in":               "NHP India",
    "tkdl.res.in":              "TKDL",
    "clinicaltrials.gov":       "ClinicalTrials.gov",
    "semanticscholar.org":      "Semantic Scholar",
    "europepmc.org":            "Europe PMC",
    "core.ac.uk":               "CORE",
    "scholar.google.com":       "Google Scholar",
    "medscape.com":             "Medscape",
    "radiopaedia.org":          "Radiopaedia",
    "uptodate.com":             "UpToDate",
    "medlineplus.gov":          "MedlinePlus",
    "statpearls.com":           "StatPearls",
    "drugs.com":                "Drugs.com",
    "rxlist.com":               "RxList",
    "wikipedia.org":            "Wikipedia",
    "mayoclinic.org":           "Mayo Clinic",
    "healthline.com":           "Healthline",
    "webmd.com":                "WebMD",
    "journals.plos.org":        "PLOS",
    "bmjopen.bmj.com":          "BMJ Open",
    "unpaywall.org":            "Unpaywall",
    "doaj.org":                 "DOAJ",
    "springer.com":             "Springer",
    "link.springer.com":        "Springer",
    "wiley.com":                "Wiley",
    "onlinelibrary.wiley.com":  "Wiley Online",
    "sciencedirect.com":        "ScienceDirect",
    "academic.oup.com":         "Oxford Academic",
    "frontiersin.org":          "Frontiers",
    "mdpi.com":                 "MDPI",
    "biorxiv.org":              "bioRxiv",
    "medrxiv.org":              "medRxiv",
    "dharaonline.org":          "DHARA",
    "iamj.in":                  "IAMJ",
    "jaims.in":                 "JAIMS",
    "ijrap.net":                "IJRAP",
    "nhs.uk":                   "NHS UK",
    "verywellhealth.com":       "Verywell Health",
    "patient.info":             "Patient.info",
}

# ═══════════════════════════════════════════════════════════════════════
#  RELATED QUESTION TEMPLATES
# ═══════════════════════════════════════════════════════════════════════

MEDICAL_QUESTION_TEMPLATES: List[str] = [
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
    "What is the prognosis for {topic}?",
    "Preventive measures for {topic}",
    "Diagnostic criteria for {topic}",
    "First-line treatment for {topic}",
    "{topic} in pediatric patients",
    "Pathophysiology of {topic}",
]


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN UTILITIES
# ═══════════════════════════════════════════════════════════════════════

def extract_domain(url: str) -> str:
    """Extract bare domain (no www.) from a URL.  Never raises."""
    try:
        netloc = urlparse(url).netloc
        if not netloc:
            return ""
        return netloc.replace("www.", "").lower()
    except Exception:
        return ""


def get_trust_score(url: str) -> int:
    """Return trust score 0-100 for a URL.

    Lookup order:
      1. Exact match in TRUST_SCORES
      2. Suffix match (e.g. 'pmc.ncbi.nlm.nih.gov' matches 'nih.gov')
      3. TLD-based floor for .gov/.edu/.gov.in/.nic.in/.ac.in
      4. Default: 45
    """
    domain = extract_domain(url)
    if not domain:
        return 45

    # Fast path: exact match
    exact = TRUST_SCORES.get(domain)
    if exact is not None:
        return exact

    # Suffix match — catches sub-domains like pmc.ncbi.nlm.nih.gov → nih.gov
    for registered_domain, score in TRUST_SCORES.items():
        if domain.endswith(f".{registered_domain}") or domain == registered_domain:
            return score

    # TLD-based floor
    if domain.endswith((".gov.in", ".nic.in")):
        return 80
    if domain.endswith(".ac.in"):
        return 75
    if domain.endswith(".gov"):
        return 72
    if domain.endswith(".edu") or domain.endswith(".edu.in"):
        return 70
    if domain.endswith(".org"):
        return 55

    return 45


# ═══════════════════════════════════════════════════════════════════════
#  RESULT TYPE DETECTION
# ═══════════════════════════════════════════════════════════════════════

# Pre-compiled patterns for speed
_VIDEO_PATTERNS = re.compile(
    r"youtube\.com|youtu\.be|vimeo\.com|dailymotion\.com|/video/|/watch",
    re.IGNORECASE,
)
_PDF_PATTERNS = re.compile(r"\.pdf|/pdf/|/download/", re.IGNORECASE)
_TRIAL_PATTERNS = re.compile(
    r"clinicaltrials\.gov|ctri\.nic\.in|/trial/|/clinical-trial",
    re.IGNORECASE,
)
_GUIDELINE_PATTERNS = re.compile(
    r"guideline|guidance|protocol|recommendation|consensus|position.?statement",
    re.IGNORECASE,
)
_PREPRINT_PATTERNS = re.compile(
    r"biorxiv\.org|medrxiv\.org|arxiv\.org|preprint",
    re.IGNORECASE,
)


def detect_result_type(url: str, raw: Dict[str, Any]) -> str:
    """Classify a search result into a content type.

    Returns one of: article, video, image, pdf, trial, guideline, preprint.
    """
    if _VIDEO_PATTERNS.search(url):
        return "video"
    if raw.get("img_src") and not raw.get("content"):
        return "image"
    if _PDF_PATTERNS.search(url):
        return "pdf"
    if _TRIAL_PATTERNS.search(url):
        return "trial"
    if _GUIDELINE_PATTERNS.search(url):
        return "guideline"
    if _PREPRINT_PATTERNS.search(url):
        return "preprint"
    return "article"


# ═══════════════════════════════════════════════════════════════════════
#  RESULT ENRICHMENT
# ═══════════════════════════════════════════════════════════════════════

def enrich_result(raw: Dict[str, Any], category: str) -> Dict[str, Any]:
    """Enrich a raw SearXNG result with trust data, badges, and type.

    This is a pure function — no I/O, no side effects.
    """
    url: str = raw.get("url", "")
    domain = extract_domain(url)
    trust = get_trust_score(url)
    source = SOURCE_LABELS.get(domain, domain or raw.get("engine", "Web"))

    return {
        "title":          raw.get("title", ""),
        "url":            url,
        "snippet":        raw.get("content", "") or raw.get("snippet", ""),
        "source":         source,
        "domain":         domain,
        "engine":         raw.get("engine", ""),
        "publishedDate":  raw.get("publishedDate") or None,
        "trustScore":     trust,
        "isPeerReviewed": domain in PEER_REVIEWED_DOMAINS,
        "isOfficial":     domain in OFFICIAL_DOMAINS,
        "isOpenAccess":   domain in OPEN_ACCESS_DOMAINS,
        "thumbnail":      raw.get("thumbnail") or None,
        "type":           detect_result_type(url, raw),
    }


# ═══════════════════════════════════════════════════════════════════════
#  DEDUPLICATION
# ═══════════════════════════════════════════════════════════════════════

def deduplicate_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate URLs and near-identical titles (first 50 chars).

    When a duplicate is encountered the version with the **higher**
    trustScore is kept.
    """
    seen_urls: Set[str] = set()
    seen_titles: Set[str] = set()
    unique: List[Dict[str, Any]] = []

    for r in results:
        url_key = (r.get("url") or "").rstrip("/").lower()
        title_key = (r.get("title") or "")[:50].lower().strip()

        if url_key in seen_urls:
            continue
        if title_key and title_key in seen_titles:
            continue

        seen_urls.add(url_key)
        if title_key:
            seen_titles.add(title_key)
        unique.append(r)

    return unique


# ═══════════════════════════════════════════════════════════════════════
#  RANKING
# ═══════════════════════════════════════════════════════════════════════

def sort_by_trust(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort results by composite medical credibility score.

    Scoring bonuses / penalties:
      +20  official government / WHO source
      +15  peer-reviewed journal
      +10  preprint from recognised server
      +8   clinical trial or guideline
      +5   open access
      −20  generic consumer health blog
    """

    def _composite(r: Dict[str, Any]) -> float:
        score = float(r.get("trustScore", 45))
        if r.get("isOfficial"):
            score += 20.0
        if r.get("isPeerReviewed"):
            score += 15.0
        if r.get("type") == "preprint":
            score += 10.0
        if r.get("type") in ("trial", "guideline"):
            score += 8.0
        if r.get("isOpenAccess"):
            score += 5.0
        if r.get("domain", "") in _GENERIC_HEALTH_DOMAINS:
            score -= 20.0
        return score

    return sorted(results, key=_composite, reverse=True)


# ═══════════════════════════════════════════════════════════════════════
#  RELATED QUESTIONS (deterministic, zero LLM)
# ═══════════════════════════════════════════════════════════════════════

_STOP_WORDS: FrozenSet[str] = frozenset({
    "in", "for", "of", "the", "a", "an", "and", "or", "with",
    "vs", "versus", "treatment", "management", "therapy", "use",
    "using", "what", "how", "why", "when", "is", "are", "does",
    "can", "do", "to", "on", "at", "by", "about", "from",
})


def generate_related_questions(
    query: str,
    top_results: List[Dict[str, Any]],
    count: int = 5,
) -> List[str]:
    """Generate `count` related medical questions without any LLM.

    Uses a stable hash of the query to select templates deterministically,
    so the same query always produces the same questions (cache-friendly).
    """
    words = [w for w in query.lower().split() if w not in _STOP_WORDS and len(w) > 1]
    topic = " ".join(words[:4]) if words else query.strip()

    if not topic:
        return []

    # Deterministic selection seeded by query hash
    seed = int(hashlib.md5(query.lower().strip().encode()).hexdigest(), 16)
    pool = list(MEDICAL_QUESTION_TEMPLATES)
    selected: List[str] = []
    used_indices: Set[int] = set()

    for i in range(min(count, len(pool))):
        idx = (seed + i * 7) % len(pool)
        # Linear probe to avoid collisions
        attempts = 0
        while idx in used_indices and attempts < len(pool):
            idx = (idx + 1) % len(pool)
            attempts += 1
        if idx in used_indices:
            break
        used_indices.add(idx)
        selected.append(pool[idx].format(topic=topic))

    return selected


# ═══════════════════════════════════════════════════════════════════════
#  SEARXNG FETCH (with Redis caching + retry)
# ═══════════════════════════════════════════════════════════════════════

_SEARXNG_TIMEOUT = 8.0
_SEARXNG_CACHE_TTL = 300  # seconds
_SEARXNG_MAX_RETRIES = 2


def _make_cache_key(query: str, category: str, page: int) -> str:
    """Build a compact, collision-resistant cache key."""
    raw = f"searxng:v2:{query.lower().strip()}:{category}:{page}"
    return f"searxng:{hashlib.sha256(raw.encode()).hexdigest()[:24]}"


async def fetch_searxng(
    query: str,
    category: str,
    fmt: str = "json",
    page: int = 1,
    searxng_url: str = "http://searxng:8080",
    redis_client: Optional[Any] = None,
) -> Dict[str, Any]:
    """Fetch results from SearXNG with optional Redis caching.

    • Cache TTL: 300 s
    • Retries once on transient failures
    • Returns ``{"results": [], "number_of_results": 0}`` on total failure
    """
    empty: Dict[str, Any] = {"results": [], "number_of_results": 0}
    cache_key = _make_cache_key(query, category, page)

    # ── Check Redis cache ─────────────────────────────────────────────
    if redis_client is not None:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                logger.debug("Cache HIT for %s", cache_key)
                return json.loads(cached)
        except Exception as exc:
            logger.warning("Redis read failed: %s", exc)

    # ── Query SearXNG (with retry) ────────────────────────────────────
    params = {
        "q": query,
        "format": fmt,
        "categories": category,
        "language": "en",
        "pageno": page,
    }
    last_exc: Optional[Exception] = None

    for attempt in range(_SEARXNG_MAX_RETRIES):
        try:
            async with httpx.AsyncClient(timeout=_SEARXNG_TIMEOUT) as client:
                resp = await client.get(f"{searxng_url}/search", params=params)
                resp.raise_for_status()
                data: Dict[str, Any] = resp.json()

                # Write to cache on success
                if redis_client is not None and data.get("results"):
                    try:
                        await redis_client.setex(
                            cache_key,
                            _SEARXNG_CACHE_TTL,
                            json.dumps(data, default=str),
                        )
                    except Exception as exc:
                        logger.warning("Redis write failed: %s", exc)

                return data
        except httpx.TimeoutException as exc:
            last_exc = exc
            logger.warning(
                "SearXNG timeout (attempt %d/%d, category=%s)",
                attempt + 1, _SEARXNG_MAX_RETRIES, category,
            )
        except Exception as exc:
            last_exc = exc
            logger.warning(
                "SearXNG fetch failed (attempt %d/%d, category=%s): %s",
                attempt + 1, _SEARXNG_MAX_RETRIES, category, exc,
            )
            break  # Non-timeout errors → don't retry

    logger.error("SearXNG all attempts exhausted (category=%s): %s", category, last_exc)
    return empty


# ═══════════════════════════════════════════════════════════════════════
#  OWN INDEX SEARCH (Meilisearch)
# ═══════════════════════════════════════════════════════════════════════

_MEILI_TIMEOUT = 3.0
_MEILI_RESULT_LIMIT = 5


async def search_own_index_async(
    query: str,
    category: str,
    meilisearch_url: str = "http://meilisearch:7700",
    meilisearch_key: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """Fast search (<50 ms) over Manthana's own indexed content.

    Uses the ``Authorization: Bearer`` header for Meilisearch >= 1.x
    and also sends ``X-Meili-API-Key`` for backward compatibility.

    meilisearch_key: Use Settings.MEILISEARCH_KEY in production. Default
    only for local dev; set MEILI_MASTER_KEY in .env for production.
    """
    key = meilisearch_key if meilisearch_key is not None else "masterKey"
    try:
        body: Dict[str, Any] = {
            "q": query,
            "limit": _MEILI_RESULT_LIMIT,
            "attributesToHighlight": ["title", "content"],
        }
        if category and category.lower() != "medical":
            body["filter"] = f'category = "{category}"'

        async with httpx.AsyncClient(timeout=_MEILI_TIMEOUT) as client:
            resp = await client.post(
                f"{meilisearch_url.rstrip('/')}/indexes/medical_search/search",
                json=body,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {key}",
                    "X-Meili-API-Key": key,
                },
            )
            if resp.status_code == 200:
                return resp.json().get("hits", [])
            logger.debug(
                "Meilisearch returned %d: %s",
                resp.status_code,
                resp.text[:200],
            )
    except Exception as exc:
        logger.debug("Own-index search failed: %s", exc)
    return []
