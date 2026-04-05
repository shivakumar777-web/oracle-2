"""
search.py — Web Search Router
=============================
Medical web search endpoint with result aggregation,
trust scoring, and related questions generation.
Pure search - NO LLM synthesis. NO AI.
"""

from __future__ import annotations

import asyncio
import time
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from config import WebSettings, get_web_settings

# Shared imports
import sys
PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.circuit_breaker import web_searxng_circuit, CircuitBreakerError
from services.shared.envelopes import create_web_response, WebSearchData

from clients.meilisearch import fetch_meilisearch
from clients.clinical_trials import fetch_clinical_trials
from clients.guidelines import fetch_guidelines
from cache import get_cached, set_cached
from routers.paper_sources import engine_implies_peer, is_paper_candidate

import logging
logger = logging.getLogger("manthana.web.search")


# ── Trust Scoring ─────────────────────────────────────────────────────

TRUST_SCORES = {
    "pubmed.ncbi.nlm.nih.gov": 95,
    "ncbi.nlm.nih.gov": 95,
    "who.int": 93,
    "cdc.gov": 92,
    "fda.gov": 90,
    "ema.europa.eu": 90,
    "cochrane.org": 92,
    "nejm.org": 88,
    "thelancet.com": 88,
    "jamanetwork.com": 87,
    "bmj.com": 87,
    "nature.com": 85,
    "sciencedirect.com": 82,
    "springer.com": 80,
    "wiley.com": 80,
    "academic.oup.com": 80,
    "mayoclinic.org": 78,
    "webmd.com": 65,
    "healthline.com": 60,
    "medicalnewstoday.com": 60,
    "wikipedia.org": 55,
    "reddit.com": 40,
    "quora.com": 35,
}

PEER_REVIEWED_DOMAINS = {
    # Core medical & research
    "pubmed.ncbi.nlm.nih.gov",
    "ncbi.nlm.nih.gov",
    "who.int",
    "cdc.gov",
    "nejm.org",
    "thelancet.com",
    "jamanetwork.com",
    "bmj.com",
    "nature.com",
    "sciencedirect.com",
    "springer.com",
    "wiley.com",
    "academic.oup.com",
    "cochrane.org",
    # Additional peer-reviewed
    "europepmc.org",
    "plos.org",
    "journals.plos.org",
    "frontiersin.org",
    "mdpi.com",
    "hindawi.com",
    "biomedcentral.com",
    "pmc.ncbi.nlm.nih.gov",
    "annals.org",
    "cell.com",
    "aafp.org",
    "ahajournals.org",
    "diabetesjournals.org",
    "ema.europa.eu",
    "fda.gov",
    # Ayurveda peer-reviewed
    "ijapr.in",
    "ayurvedjournal.com",
    "jaims.in",
    "ancientscienceoflife.org",
    "ijrap.net",
    # Indian medical
    "ijmr.org.in",
    "japi.org",
    "indianjmedsci.org",
}


def get_trust_score(url: str) -> int:
    """Get trust score for a URL based on domain reputation."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return TRUST_SCORES.get(domain, 45)
    except Exception:
        return 45


def is_peer_reviewed(url: str) -> bool:
    """Check if URL is from a peer-reviewed source."""
    try:
        from urllib.parse import urlparse
        domain = urlparse(url).netloc.lower()
        if domain.startswith("www."):
            domain = domain[4:]
        return domain in PEER_REVIEWED_DOMAINS
    except Exception:
        return False


# ── Result Enrichment ────────────────────────────────────────────────

# URL substrings that indicate peer-reviewed sources (broader than PEER_REVIEWED_DOMAINS)
PEER_REVIEWED_URL_PATTERNS = (
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
)


def enrich_result(result: Dict[str, Any], category: str = "medical") -> Dict[str, Any]:
    """Enrich search result with trust scoring and metadata.
    Preserves upstream type from dedicated clients (trials, guidelines).
    Uses heuristics only for SearXNG/MeiliSearch results.
    """
    url = result.get("url", "")
    url_lower = url.lower()
    trust_score = get_trust_score(url)
    is_peer = is_peer_reviewed(url)

    # Preserve upstream type if already set by a dedicated client
    # (ClinicalTrials.gov sets "trial", guidelines client sets "guideline")
    existing_type = (result.get("type") or "").strip().lower()
    if existing_type in ("trial", "guideline", "pdf", "video"):
        result_type = existing_type
    else:
        # Heuristic detection for SearXNG/MeiliSearch results
        title = (result.get("title") or "").lower()
        content = (result.get("content", "") or result.get("snippet", "")).lower()
        url_lower = url.lower()
        source = (result.get("source") or "").lower()

        result_type = "article"
        # PDF: URL, title, or query params
        if (
            ".pdf" in url_lower
            or url_lower.endswith(".pdf")
            or "filetype=pdf" in url_lower
            or "filetype%3Dpdf" in url_lower
            or title.endswith(".pdf")
            or "/pdf/" in url_lower
        ):
            result_type = "pdf"
        # Video: URL domains or title keywords
        elif any(
            d in url_lower
            for d in ["youtube.com", "vimeo.com", "dailymotion.com", "bitchute.com"]
        ):
            result_type = "video"
        elif any(x in title for x in ["video", "youtube", "vimeo"]):
            result_type = "video"
        # Trial: URL or title
        elif "clinicaltrials.gov" in url_lower or "ctri.nic.in" in url_lower:
            result_type = "trial"
        elif source in ("clinicaltrials.gov", "clinicaltrials.gov api"):
            result_type = "trial"
        elif any(
            x in title
            for x in [
                "clinical trial",
                "nct0",
                "nct1",
                "nct2",
                "nct3",
                "nct4",
                "nct5",
                "nct6",
                "nct7",
                "nct8",
                "nct9",
            ]
        ):
            result_type = "trial"
        # Guideline: URL patterns or content
        elif any(
            d in url_lower
            for d in [
                "who.int/publications",
                "nice.org.uk/guidance",
                "guidelines.gov",
                "cdc.gov/guidelines",
                "heart.org/guidelines",
            ]
        ):
            result_type = "guideline"
        elif any(
            x in content
            for x in ["guideline", "protocol", "clinical recommendation", "consensus"]
        ):
            result_type = "guideline"

    # Broader isPeerReviewed: SearXNG engine names + URL patterns (Premium plan)
    engine = (result.get("engine") or "").lower()
    if not is_peer:
        is_peer = engine in ("pubmed", "semantic scholar", "google scholar")
    if not is_peer:
        is_peer = engine_implies_peer(engine)
    if not is_peer:
        is_peer = any(p in url_lower for p in PEER_REVIEWED_URL_PATTERNS)

    return {
        "title": result.get("title", ""),
        "url": url,
        "snippet": result.get("content", result.get("snippet", ""))[:300],
        "source": result.get("source", "Web"),
        "domain": result.get("source", ""),
        "engine": result.get("engine", "SearXNG"),
        "publishedDate": result.get("publishedDate"),
        "trustScore": trust_score,
        "isPeerReviewed": is_peer,
        "isOfficial": trust_score >= 80,
        "isOpenAccess": True,
        "thumbnail": result.get("img_src"),
        "type": result_type,
    }


def deduplicate_results(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Remove duplicate results based on URL."""
    seen = set()
    unique = []
    for r in results:
        url = r.get("url", "")
        if url and url not in seen:
            seen.add(url)
            unique.append(r)
    return unique


def sort_by_trust(results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sort results by trust score (descending)."""
    return sorted(results, key=lambda x: x.get("trustScore", 0), reverse=True)


def generate_related_questions(query: str, results: List[Dict[str, Any]]) -> List[str]:
    """Generate related questions based on query and results."""
    questions = []
    lower_q = query.lower()

    if "symptom" in lower_q or "cause" in lower_q:
        questions.append(f"What are the treatments for {query}?")
        questions.append(f"How is {query} diagnosed?")
    elif "treatment" in lower_q or "cure" in lower_q:
        questions.append(f"What causes {query}?")
        questions.append(f"Are there alternative treatments for {query}?")
    else:
        questions.append(f"What are the symptoms of {query}?")
        questions.append(f"How is {query} treated?")
        questions.append(f"What causes {query}?")

    for r in results[:2]:
        title = r.get("title", "")
        if "clinical trial" in title.lower():
            questions.append(f"Are there clinical trials for {query}?")
        if "side effects" in title.lower():
            questions.append(f"What are the side effects of {query}?")

    return questions[:5]


def apply_filters(
    results: List[Dict[str, Any]],
    result_type: Optional[str] = None,
    peer_reviewed: bool = False,
) -> List[Dict[str, Any]]:
    """Apply optional filters to results."""
    filtered = results
    if result_type:
        filtered = [r for r in filtered if (r.get("type") or "article") == result_type]
    if peer_reviewed:
        filtered = [r for r in filtered if r.get("isPeerReviewed")]
    return filtered


def merge_results(
    searxng_results: List[Dict[str, Any]],
    meili_results: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """Merge and deduplicate results from multiple sources."""
    seen_urls = set()
    merged = []
    for r in searxng_results + meili_results:
        url = r.get("url", "")
        if url and url not in seen_urls:
            seen_urls.add(url)
            merged.append(r)
    return merged


# ── Search Implementation ─────────────────────────────────────────────

async def _fetch_searxng_call(
    query: str,
    category: str,
    format_type: str,
    page: int,
    searxng_url: str,
    timeout: float = 8.0,
) -> Dict[str, Any]:
    """Actual SearXNG call (wrapped by circuit breaker)."""
    params = {
        "q": query,
        "category": category,
        "format": format_type,
        "pageno": page,
    }
    async with httpx.AsyncClient(timeout=timeout) as client:
        resp = await client.get(f"{searxng_url}/search", params=params)
        if resp.status_code == 200:
            return resp.json()
        return {"results": [], "images": [], "videos": []}


async def fetch_searxng(
    query: str,
    category: str,
    format_type: str,
    page: int,
    searxng_url: str,
    timeout: float = 8.0,
) -> Dict[str, Any]:
    """Fetch results from SearXNG with circuit breaker protection."""
    try:
        return await web_searxng_circuit.call(
            _fetch_searxng_call,
            query,
            category,
            format_type,
            page,
            searxng_url,
            timeout,
        )
    except CircuitBreakerError:
        logger.warning("SearXNG circuit open - returning empty results")
        return {"results": [], "images": [], "videos": [], "circuit_open": True}
    except Exception as exc:
        logger.warning(f"SearXNG error: {exc}")
        return {"results": [], "images": [], "videos": []}


# ── SearXNG JSON: images/videos often live in `results`, not top-level `images`/`videos`
# See https://docs.searxng.org/dev/search_api.html

_VIDEO_HOST_HINTS = (
    "youtube.com",
    "youtu.be",
    "vimeo.com",
    "dailymotion.com",
    "bing.com/videos",
    "piped.video",
    "bilibili.com",
)


def searxng_collect_image_rows(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build image rows compatible with downstream mapping (img_src, url, thumbnail_src).
    Merges optional `images` list with `results` rows that contain img_src/thumbnail.
    """
    merged: List[Dict[str, Any]] = []
    seen: set = set()

    def push(row: Dict[str, Any]) -> None:
        img_src = (row.get("img_src") or row.get("thumbnail") or "").strip()
        if not img_src:
            return
        if img_src in seen:
            return
        seen.add(img_src)
        page = (row.get("url") or "").strip() or img_src
        thumb = (row.get("thumbnail_src") or row.get("thumbnail") or img_src).strip()
        merged.append({
            "img_src": img_src,
            "url": page,
            "title": row.get("title", ""),
            "source": row.get("source") or row.get("engine", ""),
            "thumbnail_src": thumb,
        })

    for row in data.get("images") or []:
        if isinstance(row, dict):
            push(row)
    for row in data.get("results") or []:
        if not isinstance(row, dict):
            continue
        if row.get("img_src") or row.get("thumbnail") or row.get("thumbnail_src"):
            push(row)

    return merged


def _video_url_score(url: str) -> int:
    u = (url or "").lower()
    if any(h in u for h in _VIDEO_HOST_HINTS):
        return 0
    return 1


def _looks_like_video_row(r: Dict[str, Any]) -> bool:
    """True if a mixed SERP row is likely a real video (not a generic medical page)."""
    url = (r.get("url") or "").lower()
    if any(h in url for h in _VIDEO_HOST_HINTS):
        return True
    eng = (r.get("engine") or "").lower()
    if any(x in eng for x in ("youtube", "vimeo", "piped", "dailymotion", "google videos", "bing video")):
        return True
    tpl = (r.get("template") or "").lower()
    return "video" in tpl


def searxng_collect_video_rows(data: Dict[str, Any]) -> List[Dict[str, Any]]:
    """
    Build video rows from `videos` and `results`. Prefer known video hosts (YouTube, etc.).
    """
    merged: List[Dict[str, Any]] = []
    seen: set = set()

    def push(row: Dict[str, Any]) -> None:
        url = (row.get("url") or "").strip()
        if not url or url in seen:
            return
        seen.add(url)
        merged.append({
            "url": url,
            "title": row.get("title", ""),
            "thumbnail": row.get("thumbnail", "") or row.get("img_src", ""),
            "source": row.get("source") or row.get("engine", ""),
            "publishedDate": row.get("publishedDate", "") or row.get("pubdate", ""),
        })

    for row in data.get("videos") or []:
        if isinstance(row, dict):
            push(row)
    for row in data.get("results") or []:
        if isinstance(row, dict):
            push(row)

    merged.sort(key=lambda r: _video_url_score(r.get("url", "")))
    return merged


def merge_image_rows(*batches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Dedupe by img_src across multiple collect_* outputs."""
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for batch in batches:
        for row in batch:
            key = (row.get("img_src") or row.get("url") or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(row)
    return out


def merge_video_rows(*batches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    seen: set = set()
    out: List[Dict[str, Any]] = []
    for batch in batches:
        for row in batch:
            key = (row.get("url") or "").strip()
            if not key or key in seen:
                continue
            seen.add(key)
            out.append(row)
    out.sort(key=lambda r: _video_url_score(r.get("url", "")))
    return out


# ── Router Factory ───────────────────────────────────────────────────

def create_search_router(limiter) -> APIRouter:
    """Create the search router."""
    router = APIRouter(tags=["search"])

    @router.get("/search")
    @limiter.limit("200/minute")
    async def search(
        request: Request,
        q: str = Query(..., description="Search query"),
        category: str = Query(default="medical", description="Search category"),
        page: int = Query(default=1, ge=1, description="Page number"),
        lang: Optional[str] = Query(default="en", description="Language code"),
        result_type: Optional[str] = Query(
            default=None,
            description="Filter by type: article, pdf, video, trial, guideline",
        ),
        peer_reviewed: bool = Query(default=False, description="Only peer-reviewed"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Medical web search with trust scoring. Pure search — NO AI."""
        rid = getattr(request.state, "request_id", "unknown")
        if settings.WEB_FEATURE_LOCKED:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "locked",
                    "message": (
                        "Manthana Web search is paused while we refine multi-source medical search."
                    ),
                },
            )
        start_time = time.time()

        redis_client = getattr(request.app.state, "redis", None)
        db = getattr(request.app.state, "db", None)

        # Try cache first
        cached = await get_cached(q, category, page, redis_client, db)
        if cached:
            elapsed = int((time.time() - start_time) * 1000)
            total = cached.get("total", len(cached.get("results", [])))
            per_page = 20
            total_pages = max(1, (total + per_page - 1) // per_page)

            results = cached.get("results", [])
            results_for_counts = results
            if result_type or peer_reviewed:
                results = apply_filters(results, result_type, peer_reviewed)

            images_cached = cached.get("images", [])
            videos_cached = cached.get("videos", [])

            search_data = WebSearchData(
                query=q,
                category=category,
                total=len(results),
                page=page,
                results=results[:20],
                images=images_cached,
                videos=videos_cached,
                related_questions=cached.get("related_questions", []),
                engines_used=cached.get("engines_used", ["SearXNG"]),
                local_results=[],
                elapsed_ms=elapsed,
                synthesis=None,
            )
            data = search_data.model_dump()
            data["relatedQuestions"] = data.get("related_questions", [])
            data["enginesUsed"] = data.get("engines_used", [])
            data["localResults"] = data.get("local_results", [])
            data["elapsed"] = elapsed
            data["totalPages"] = total_pages
            data["hasNextPage"] = page < total_pages
            data["hasPrevPage"] = page > 1
            data["tabCounts"] = {
                "all": total,
                "papers": sum(
                    1 for r in results_for_counts
                    if r.get("isPeerReviewed") or is_paper_candidate(r)
                ),
                "guidelines": sum(1 for r in results_for_counts if (r.get("type") or "") == "guideline"),
                "trials": sum(1 for r in results_for_counts if (r.get("type") or "") == "trial"),
                "images": len(images_cached),
                "videos": len(videos_cached),
                "pdfs": sum(1 for r in results_for_counts if (r.get("type") or "") == "pdf"),
                "articles": sum(1 for r in results_for_counts if (r.get("type") or "article") == "article"),
            }
            return JSONResponse(
                status_code=200,
                content=create_web_response(data, rid),
            )

        # Page 1: parallel image + video category searches (Premium: fill All-tab strips)
        img_preview_data: Dict[str, Any] = {}
        vid_preview_data: Dict[str, Any] = {}
        if page == 1:
            preview_tasks: List = []
            if settings.WEB_ENABLE_IMAGES:
                preview_tasks.append(
                    fetch_searxng(
                        q, "images", "json", 1,
                        settings.WEB_SEARXNG_URL,
                        settings.WEB_SEARXNG_TIMEOUT,
                    )
                )
            if settings.WEB_ENABLE_VIDEOS:
                preview_tasks.append(
                    fetch_searxng(
                        q, "videos", "json", 1,
                        settings.WEB_SEARXNG_URL,
                        settings.WEB_SEARXNG_TIMEOUT,
                    )
                )
            if preview_tasks:
                pg = await asyncio.gather(*preview_tasks, return_exceptions=True)
                pi = 0
                if settings.WEB_ENABLE_IMAGES and pi < len(pg):
                    img_preview_data = pg[pi] if not isinstance(pg[pi], Exception) else {}
                    pi += 1
                if settings.WEB_ENABLE_VIDEOS and pi < len(pg):
                    vid_preview_data = pg[pi] if not isinstance(pg[pi], Exception) else {}

        # Fetch from SearXNG (main category)
        searxng_task = fetch_searxng(
            q, category, "json", page,
            settings.WEB_SEARXNG_URL,
            settings.WEB_SEARXNG_TIMEOUT,
        )

        # Optionally fetch from MeiliSearch
        meili_task = None
        if settings.WEB_MEILISEARCH_URL and settings.WEB_ENABLE_LOCAL_INDEX:
            meili_task = fetch_meilisearch(
                q,
                settings.WEB_MEILISEARCH_INDEX,
                settings.WEB_MEILISEARCH_URL,
                settings.WEB_MEILISEARCH_KEY,
                limit=20,
                offset=(page - 1) * 20,
            )

        # Optionally fetch from ClinicalTrials.gov (page 1 only for trials)
        trials_task = fetch_clinical_trials(q, limit=5) if getattr(settings, "WEB_ENABLE_TRIALS", True) and page == 1 else None

        # Optionally fetch from guidelines index (page 1 only)
        guidelines_task = None
        if (
            getattr(settings, "WEB_ENABLE_GUIDELINES", False)
            and settings.WEB_MEILISEARCH_URL
            and page == 1
        ):
            guidelines_task = fetch_guidelines(
                q,
                getattr(settings, "WEB_MEILISEARCH_GUIDELINES_INDEX", "guidelines"),
                settings.WEB_MEILISEARCH_URL,
                settings.WEB_MEILISEARCH_KEY,
                limit=5,
            )

        tasks = [searxng_task]
        if meili_task is not None:
            tasks.append(meili_task)
        if trials_task is not None:
            tasks.append(trials_task)
        if guidelines_task is not None:
            tasks.append(guidelines_task)

        gathered = await asyncio.gather(*tasks, return_exceptions=True)
        searxng_data = gathered[0]
        if isinstance(searxng_data, Exception):
            searxng_data = {"results": [], "images": [], "videos": []}

        raw_results = list(searxng_data.get("results", []))
        engines_used = ["SearXNG"]

        idx = 1
        if meili_task is not None:
            r = gathered[idx]
            idx += 1
            if not isinstance(r, Exception) and r:
                raw_results = merge_results(raw_results, r)
                engines_used.append("MeiliSearch")

        if trials_task is not None:
            r = gathered[idx]
            idx += 1
            if not isinstance(r, Exception) and r:
                trials_list = r[0] if isinstance(r, tuple) else r
                if trials_list:
                    raw_results = merge_results(raw_results, trials_list)
                    engines_used.append("ClinicalTrials.gov")

        if guidelines_task is not None:
            r = gathered[idx]
            if not isinstance(r, Exception) and r:
                raw_results = merge_results(raw_results, r)
                engines_used.append("Guidelines")

        enriched_results = [enrich_result(r, category) for r in raw_results]
        enriched_results = deduplicate_results(enriched_results)
        enriched_results = sort_by_trust(enriched_results)

        if result_type or peer_reviewed:
            enriched_results = apply_filters(
                enriched_results, result_type, peer_reviewed
            )

        images = []
        videos = []
        # Images: main SearXNG response + page-1 images category preview (see searxng_collect_image_rows)
        img_batches = [searxng_collect_image_rows(searxng_data)]
        if img_preview_data:
            img_batches.append(searxng_collect_image_rows(img_preview_data))
        img_sources = merge_image_rows(*img_batches)
        seen_img = set()
        if settings.WEB_ENABLE_IMAGES:
            for img in img_sources[:35]:
                u = img.get("img_src") or img.get("url") or ""
                if u and u not in seen_img:
                    seen_img.add(u)
                    images.append({
                        "url": img.get("img_src", img.get("url", "")),
                        "title": img.get("title", ""),
                        "source": img.get("source", ""),
                        "sourceUrl": img.get("url", ""),
                        "thumbnail": img.get("thumbnail_src", img.get("img_src", "")),
                    })
        # Videos: dedicated videos-category preview + optional real video rows on mixed medical SERP
        # (Do not treat every medical `results[]` URL as a video — those are usually web articles.)
        filtered_mixed = {
            "videos": searxng_data.get("videos") or [],
            "results": [
                r for r in (searxng_data.get("results") or [])
                if isinstance(r, dict) and _looks_like_video_row(r)
            ],
        }
        vid_batches = [searxng_collect_video_rows(filtered_mixed)]
        if vid_preview_data:
            vid_batches.append(searxng_collect_video_rows(vid_preview_data))
        vid_sources = merge_video_rows(*vid_batches)
        seen_vid = set()
        if settings.WEB_ENABLE_VIDEOS:
            for vid in vid_sources[:25]:
                u = vid.get("url", "")
                if u and u not in seen_vid:
                    seen_vid.add(u)
                    videos.append({
                        "url": vid.get("url", ""),
                        "title": vid.get("title", ""),
                        "thumbnail": vid.get("thumbnail", ""),
                        "source": vid.get("source", ""),
                        "publishedDate": vid.get("publishedDate", ""),
                    })

        related = []
        if settings.WEB_ENABLE_RELATED_QUESTIONS:
            related = generate_related_questions(q, enriched_results)

        elapsed = int((time.time() - start_time) * 1000)
        total = len(enriched_results)
        per_page = 20
        total_pages = max(1, (total + per_page - 1) // per_page)

        cache_data = {
            "results": enriched_results[:20],
            "images": images,
            "videos": videos,
            "related_questions": related,
            "engines_used": engines_used,
            "total": total,
        }
        await set_cached(
            q, category, page, cache_data,
            redis_client, db,
            settings.WEB_CACHE_TTL,
        )

        if db and db.available:
            user_id = getattr(request.state, "user_id", None)
            await db.record_search(user_id, q, category)

        search_data = WebSearchData(
            query=q,
            category=category,
            total=total,
            page=page,
            results=enriched_results[:20],
            images=images,
            videos=videos,
            related_questions=related,
            engines_used=engines_used,
            local_results=[],
            elapsed_ms=elapsed,
            synthesis=None,
        )
        data = search_data.model_dump()
        data["relatedQuestions"] = data.get("related_questions", [])
        data["enginesUsed"] = data.get("engines_used", [])
        data["localResults"] = data.get("local_results", [])
        data["elapsed"] = elapsed
        data["totalPages"] = total_pages
        data["hasNextPage"] = page < total_pages
        data["hasPrevPage"] = page > 1

        # Tab counts for filter tabs (aligned with Research Papers tab logic)
        results_all = enriched_results
        data["tabCounts"] = {
            "all": total,
            "papers": sum(
                1 for r in results_all
                if r.get("isPeerReviewed") or is_paper_candidate(r)
            ),
            "guidelines": sum(1 for r in results_all if (r.get("type") or "") == "guideline"),
            "trials": sum(1 for r in results_all if (r.get("type") or "") == "trial"),
            "images": len(images),
            "videos": len(videos),
            "pdfs": sum(1 for r in results_all if (r.get("type") or "") == "pdf"),
            "articles": sum(1 for r in results_all if (r.get("type") or "article") == "article"),
        }

        return JSONResponse(
            status_code=200,
            content=create_web_response(data, rid),
        )

    @router.get("/search/images")
    @limiter.limit("200/minute")
    async def search_images(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Image search — SearXNG category=images."""
        if not settings.WEB_ENABLE_IMAGES:
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "images": [], "total": 0, "page": page},
                    getattr(request.state, "request_id", "unknown"),
                ),
            )
        try:
            data = await fetch_searxng(
                q, "images", "json", page,
                settings.WEB_SEARXNG_URL,
                settings.WEB_SEARXNG_TIMEOUT,
            )
            images = []
            for img in searxng_collect_image_rows(data)[:30]:
                images.append({
                    "url": img.get("img_src", img.get("url", "")),
                    "title": img.get("title", ""),
                    "source": img.get("source", ""),
                    "sourceUrl": img.get("url", ""),
                    "thumbnail": img.get("thumbnail_src", img.get("img_src", "")),
                })
            total = len(images)
            total_pages = max(1, (total + 29) // 30)
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {
                        "query": q,
                        "images": images,
                        "total": total,
                        "page": page,
                        "totalPages": total_pages,
                        "hasNextPage": page < total_pages,
                        "hasPrevPage": page > 1,
                    },
                    getattr(request.state, "request_id", "unknown"),
                ),
            )
        except Exception as exc:
            logger.warning(f"Image search error: {exc}")
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "images": [], "total": 0, "page": page},
                    getattr(request.state, "request_id", "unknown"),
                ),
            )

    @router.get("/search/videos")
    @limiter.limit("200/minute")
    async def search_videos(
        request: Request,
        q: str = Query(..., description="Search query"),
        page: int = Query(default=1, ge=1, description="Page number"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Video search — SearXNG category=videos (YouTube, Bing, Google Videos)."""
        if not settings.WEB_ENABLE_VIDEOS:
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "videos": [], "total": 0, "page": page},
                    getattr(request.state, "request_id", "unknown"),
                ),
            )
        try:
            # Use category=videos to hit YouTube, Bing Videos, Google Videos engines
            data = await fetch_searxng(
                q, "videos", "json", page,
                settings.WEB_SEARXNG_URL,
                settings.WEB_SEARXNG_TIMEOUT,
            )
            videos = []
            for vid in searxng_collect_video_rows(data)[:20]:
                videos.append({
                    "url": vid.get("url", ""),
                    "title": vid.get("title", ""),
                    "thumbnail": vid.get("thumbnail", ""),
                    "source": vid.get("source", ""),
                    "publishedDate": vid.get("publishedDate", ""),
                })
            total = len(videos)
            total_pages = max(1, (total + 19) // 20)
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {
                        "query": q,
                        "videos": videos,
                        "total": total,
                        "page": page,
                        "totalPages": total_pages,
                        "hasNextPage": page < total_pages,
                        "hasPrevPage": page > 1,
                    },
                    getattr(request.state, "request_id", "unknown"),
                ),
            )
        except Exception as exc:
            logger.warning(f"Video search error: {exc}")
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {"query": q, "videos": [], "total": 0, "page": page},
                    getattr(request.state, "request_id", "unknown"),
                ),
            )

    return router
