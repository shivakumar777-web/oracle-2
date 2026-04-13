"""
orchestrator.py — Manthana Search & Indexing Orchestrator
==========================================================
Core engine used by the ``manthana-api`` service (``api.py``).

Pipeline:
  1. Check own indexes first (Elasticsearch) → zero-cost local results
  2. Web search via SearXNG → ranked external results
  3. Crawl top URLs (Crawl4AI fast → Firecrawl deep fallback)
  4. Index crawled content into ES + Qdrant + Meilisearch
  5. AI synthesis via OpenRouter (see config/cloud_inference.yaml)

All functions are async. The module maintains a shared ``httpx.AsyncClient``
for connection pooling and a lazy-initialised Groq client.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from typing import Any, Dict, List, Optional

import httpx

# ── Logging ───────────────────────────────────────────────────────────
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("manthana.orchestrator")

# ── Backend URLs (env-overridable) ────────────────────────────────────
SEARXNG       = os.getenv("SEARXNG_URL",       "http://searxng:8080")
FIRECRAWL     = os.getenv("FIRECRAWL_URL",     "http://firecrawl-api:3002")
CRAWL4AI      = os.getenv("CRAWL4AI_URL",      "http://crawl4ai:11235")
OLLAMA        = os.getenv("OLLAMA_URL",         "http://ollama:11434")
QDRANT        = os.getenv("QDRANT_URL",         "http://qdrant:6333")
ELASTICSEARCH = os.getenv("ELASTICSEARCH_URL",  "http://elasticsearch:9200")
MEILISEARCH   = os.getenv("MEILISEARCH_URL",    "http://meilisearch:7700")
MEILI_KEY     = os.getenv("MEILI_MASTER_KEY",   "")
EMBED_MODEL   = os.getenv("EMBEDDING_MODEL",    "nomic-embed-text")
REDIS_URL     = os.getenv("REDIS_URL",          "redis://redis:6379")

# ── Index names ───────────────────────────────────────────────────────
ES_INDEX    = "manthana-medical"
QDRANT_COL  = "medical_documents"
MEILI_INDEX = "medical_search"

# ── Timeouts & limits ─────────────────────────────────────────────────
TIMEOUT         = 15
CRAWL_TIMEOUT   = 30
SYNTH_TIMEOUT   = 60
EMBED_DIM       = 768
MAX_CONTEXT     = 4_000
MAX_INDEX_CHARS = 5_000
MIN_CONTENT_LEN = 50

# ── Complexity keywords for AI trigger ────────────────────────────────
_COMPLEX_KEYWORDS = frozenset({
    "compare", "difference", "vs", "versus", "interaction",
    "side effect", "contraindication", "dosage", "protocol",
    "treatment plan", "mechanism", "treatment", "symptoms",
    "diagnosis", "cure", "medicine", "drug", "therapy",
    "remedy", "dose", "prescription", "prognosis", "pathophysiology",
    "differential", "evidence", "guideline", "meta-analysis",
})

# ═══════════════════════════════════════════════════════════════════════
#  Shared HTTP client (connection pooling) + optional Redis
# ═══════════════════════════════════════════════════════════════════════
_client: Optional[httpx.AsyncClient] = None

try:
    import redis.asyncio as aioredis  # type: ignore[import]
    _REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover - optional dependency
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

_redis_client = None


def _get_client() -> httpx.AsyncClient:
    """Lazy-create a shared async HTTP client with connection pooling."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            timeout=httpx.Timeout(TIMEOUT, connect=5.0),
            limits=httpx.Limits(max_connections=100, max_keepalive_connections=20),
        )
    return _client


async def _get_redis():
    """Lazy-create a Redis client for synthesis caching."""
    global _redis_client
    if not _REDIS_AVAILABLE or aioredis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis_client.ping()
            log.info("[REDIS] Connected for synthesis cache: %s", REDIS_URL)
        except Exception as exc:
            log.warning("[REDIS] Unavailable for synthesis cache: %s", exc)
            _redis_client = None
    return _redis_client


async def close_client() -> None:
    """Gracefully close the shared HTTP and Redis clients (call at shutdown)."""
    global _client, _redis_client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None
    if _redis_client is not None:
        try:
            await _redis_client.aclose()
        except Exception:
            pass
        _redis_client = None




# ═══════════════════════════════════════════════════════════════════════
#  Utility helpers
# ═══════════════════════════════════════════════════════════════════════

def doc_id(url: str) -> str:
    """Deterministic document ID from URL (MD5 hex)."""
    return hashlib.md5(url.encode()).hexdigest()


def _qdrant_point_id(url: str) -> int:
    """Deterministic 64-bit positive integer ID for Qdrant.

    Uses SHA-256 truncated to 63 bits to avoid collision issues
    with the old MD5 % 10^12 approach.
    """
    h = hashlib.sha256(url.encode()).hexdigest()
    return int(h[:15], 16)  # 60-bit positive integer


# ═══════════════════════════════════════════════════════════════════════
#  Safe HTTP wrappers (with better error context)
# ═══════════════════════════════════════════════════════════════════════

async def safe_post(
    url: str,
    payload: dict,
    timeout: int = TIMEOUT,
    headers: Optional[Dict[str, str]] = None,
) -> dict:
    """POST JSON, return parsed response or empty dict on failure."""
    try:
        resp = await _get_client().post(
            url, json=payload, headers=headers, timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.TimeoutException:
        log.warning("POST timeout: %s", url)
    except httpx.HTTPStatusError as exc:
        log.warning("POST %d from %s: %s", exc.response.status_code, url, exc)
    except Exception as exc:
        log.warning("POST failed %s: %s", url, exc)
    return {}


async def safe_get(
    url: str,
    params: Optional[dict] = None,
    timeout: int = TIMEOUT,
    headers: Optional[Dict[str, str]] = None,
) -> dict:
    """GET with params, return parsed response or empty dict on failure."""
    try:
        resp = await _get_client().get(
            url, params=params, headers=headers, timeout=timeout,
        )
        resp.raise_for_status()
        return resp.json()
    except httpx.TimeoutException:
        log.warning("GET timeout: %s", url)
    except httpx.HTTPStatusError as exc:
        log.warning("GET %d from %s: %s", exc.response.status_code, url, exc)
    except Exception as exc:
        log.warning("GET failed %s: %s", url, exc)
    return {}


# ═══════════════════════════════════════════════════════════════════════
#  SEARCH — SearXNG
# ═══════════════════════════════════════════════════════════════════════

async def search_web(query: str, category: str = "medical") -> List[dict]:
    """Search via SearXNG meta-search engine."""
    log.info("[SEARCH] Query: %s | Category: %s", query, category)
    data = await safe_get(
        f"{SEARXNG}/search",
        params={
            "q": query,
            "format": "json",
            "categories": category,
            "language": "en",
        },
    )
    results = data.get("results", [])
    log.info("[SEARCH] Found %d results", len(results))
    return results


# ═══════════════════════════════════════════════════════════════════════
#  CRAWLERS — Crawl4AI (fast) + Firecrawl (deep)
# ═══════════════════════════════════════════════════════════════════════

async def crawl_fast(url: str) -> str:
    """Fast crawl via Crawl4AI.  Returns extracted markdown."""
    log.info("[CRAWL4AI] Crawling: %s", url[:80])
    data = await safe_post(
        f"{CRAWL4AI}/crawl",
        {"urls": [url], "priority": 10},
        timeout=CRAWL_TIMEOUT,
    )
    results = data.get("results", [])
    if not results or not isinstance(results, list):
        return ""

    md = results[0].get("markdown", "")
    # Crawl4AI v0.5.x returns markdown as a dict
    if isinstance(md, dict):
        return (
            md.get("raw_markdown", "")
            or md.get("markdown_with_citations", "")
            or md.get("fit_markdown", "")
        )
    return md or ""


async def crawl_deep(url: str) -> str:
    """Deep crawl via Firecrawl.  Returns extracted markdown."""
    log.info("[FIRECRAWL] Deep crawling: %s", url[:80])
    data = await safe_post(
        f"{FIRECRAWL}/v1/scrape",
        {
            "url": url,
            "formats": ["markdown"],
            "onlyMainContent": True,
            "waitFor": 2000,
        },
        timeout=CRAWL_TIMEOUT,
    )
    return data.get("data", {}).get("markdown", "")


async def extract(url: str, deep: bool = False) -> str:
    """Extract page content — tries fast crawler first, falls back to deep.

    Parameters
    ----------
    url : str
        URL to crawl.
    deep : bool
        If ``True``, skip the fast crawler and go straight to Firecrawl.
    """
    content = await crawl_deep(url) if deep else await crawl_fast(url)
    if not content or len(content) < 100:
        if not deep:
            log.info("[EXTRACT] Fast crawl insufficient — falling back to deep: %s", url[:60])
            content = await crawl_deep(url)
    return content


# ═══════════════════════════════════════════════════════════════════════
#  INDEXING — Elasticsearch + Qdrant + Meilisearch
# ═══════════════════════════════════════════════════════════════════════

async def index_elasticsearch(
    url: str, content: str, title: str = "", engine: str = "",
) -> None:
    """Upsert a document into Elasticsearch."""
    did = doc_id(url)
    log.info("[ES] Indexing: %s", url[:60])
    try:
        resp = await _get_client().put(
            f"{ELASTICSEARCH}/{ES_INDEX}/_doc/{did}",
            json={
                "url": url,
                "title": title,
                "content": content[:MAX_INDEX_CHARS],
                "engine": engine,
                "indexed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
    except Exception as exc:
        log.warning("[ES] Index failed: %s", exc)


async def get_embedding(text: str) -> List[float]:
    """Generate an embedding via Ollama using the configured embedding model."""
    data = await safe_post(
        f"{OLLAMA}/api/embeddings",
        {"model": EMBED_MODEL, "prompt": text[:2000]},
    )
    return data.get("embedding", [])


async def index_qdrant(url: str, content: str, title: str = "") -> None:
    """Embed and upsert a document into Qdrant."""
    log.info("[QDRANT] Embedding: %s", url[:60])
    vector = await get_embedding(content[:2000])
    if not vector:
        log.warning("[QDRANT] Empty embedding — skipping %s", url[:60])
        return

    point_id = _qdrant_point_id(url)
    await safe_post(
        f"{QDRANT}/collections/{QDRANT_COL}/points",
        {
            "points": [
                {
                    "id": point_id,
                    "vector": vector,
                    "payload": {
                        "url": url,
                        "title": title,
                        "snippet": content[:500],
                    },
                }
            ]
        },
    )


async def index_meilisearch(url: str, content: str, title: str = "") -> None:
    """Add a document to the Meilisearch index."""
    log.info("[MEILI] Indexing: %s", url[:60])
    did = doc_id(url)
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if MEILI_KEY:
        headers["Authorization"] = f"Bearer {MEILI_KEY}"
        headers["X-Meili-API-Key"] = MEILI_KEY

    try:
        resp = await _get_client().post(
            f"{MEILISEARCH}/indexes/{MEILI_INDEX}/documents",
            json=[{
                "id": did,
                "url": url,
                "title": title,
                "content": content[:MAX_INDEX_CHARS],
            }],
            headers=headers,
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
    except Exception as exc:
        log.warning("[MEILI] Index failed: %s", exc)


async def index_all(
    url: str, content: str, title: str = "", engine: str = "",
) -> None:
    """Index a document into all three stores in parallel.

    Skips indexing if content is shorter than ``MIN_CONTENT_LEN`` chars.
    """
    if not content or len(content) < MIN_CONTENT_LEN:
        log.warning("[INDEX] Skipping empty/short content: %s", url[:60])
        return

    results = await asyncio.gather(
        index_elasticsearch(url, content, title, engine),
        index_qdrant(url, content, title),
        index_meilisearch(url, content, title),
        return_exceptions=True,
    )
    # Log any individual failures without crashing
    for idx, res in enumerate(results):
        if isinstance(res, Exception):
            store = ["ES", "Qdrant", "Meili"][idx]
            log.warning("[INDEX] %s indexing failed for %s: %s", store, url[:60], res)

    log.info("[INDEX] ✅ Indexing complete: %s", url[:60])


# ═══════════════════════════════════════════════════════════════════════
#  OWN INDEX QUERY — Elasticsearch
# ═══════════════════════════════════════════════════════════════════════

async def search_own_index(query: str) -> List[dict]:
    """Query existing documents from Elasticsearch.

    Uses a ``multi_match`` query instead of a raw query-string to avoid
    injection risks and improve relevance.
    """
    log.info("[OWN INDEX] Searching Elasticsearch: %s", query)
    try:
        resp = await _get_client().post(
            f"{ELASTICSEARCH}/{ES_INDEX}/_search",
            json={
                "size": 5,
                "query": {
                    "multi_match": {
                        "query": query,
                        "fields": ["title^2", "content"],
                        "type": "best_fields",
                        "fuzziness": "AUTO",
                    }
                },
            },
            timeout=TIMEOUT,
        )
        resp.raise_for_status()
        data = resp.json()
        hits = data.get("hits", {}).get("hits", [])
        log.info("[OWN INDEX] Found %d local results", len(hits))
        return hits
    except Exception as exc:
        log.warning("[OWN INDEX] Search failed: %s", exc)
        return []


# ═══════════════════════════════════════════════════════════════════════
#  AI SYNTHESIS — Groq (llama-3.3-70b-versatile)
# ═══════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPT = (
    "You are Manthana, India's trusted medical intelligence engine. "
    "You have expertise in Ayurveda, Allopathy, Homeopathy, Siddha and Unani. "
    "Be accurate, cite sources, recommend consulting a doctor."
)

_USER_PROMPT_TEMPLATE = """\
You are Manthana, India's medical intelligence engine. You have expertise \
in Ayurveda, Allopathy, Homeopathy, Siddha and Unani. Answer the following \
medical query using ONLY the provided context. Always cite sources. Be \
accurate, concise and evidence-based.

Query: {query}

Context: {context}

Answer:"""


async def synthesize(query: str, context: str, redis_client: Optional[Any] = None) -> str:
    """Generate an AI-synthesized answer using OpenRouter (SSOT: config/cloud_inference.yaml)."""
    log.info("[OpenRouter] Synthesizing answer for: %s", query[:80])
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        log.warning("[OpenRouter] No OPENROUTER_API_KEY — skipping synthesis")
        return ""

    # ── Optional Redis cache lookup ────────────────────────────────────
    cache_client = redis_client
    if cache_client is None:
        cache_client = await _get_redis()

    cache_key = hashlib.sha256(
        f"{query}::{context[:500]}".encode("utf-8")
    ).hexdigest()

    if cache_client is not None:
        try:
            cached = await cache_client.get(cache_key)
            if cached:
                log.info("[OpenRouter] Cache HIT for synthesis key=%s", cache_key[:16])
                return cached
        except Exception as exc:
            log.warning("[OpenRouter] Cache read failed: %s", exc)

    prompt = _USER_PROMPT_TEMPLATE.format(
        query=query,
        context=context[:MAX_CONTEXT],
    )

    def _sync_call_with_retry() -> str:
        """Blocking OpenRouter call with basic rate-limit retries."""
        try:
            from openai import RateLimitError  # type: ignore
        except Exception:  # pragma: no cover
            RateLimitError = Exception  # type: ignore

        from pathlib import Path

        from manthana_inference import (  # type: ignore
            build_openrouter_sync_client,
            chat_complete_sync,
            load_cloud_inference_config,
        )

        cfg_path = (os.getenv("CLOUD_INFERENCE_CONFIG_PATH") or "").strip()
        cfg = load_cloud_inference_config(Path(cfg_path) if cfg_path else None)
        client = build_openrouter_sync_client(api_key, cfg)
        messages = [
            {"role": "system", "content": _SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ]
        backoffs = [2, 4, 8]
        for attempt, delay in enumerate(backoffs, start=1):
            try:
                text, _model, *_ = chat_complete_sync(
                    client,
                    cfg,
                    "orchestrator_synthesis",
                    messages,
                )
                return text or ""
            except RateLimitError as exc:  # type: ignore[misc]
                log.warning(
                    "[OpenRouter] Rate limit on attempt %d/%d, sleeping %ss: %s",
                    attempt,
                    len(backoffs),
                    delay,
                    exc,
                )
                time.sleep(delay)
            except Exception as exc:
                log.error("[OpenRouter] Synthesis error (non-rate-limit): %s", exc)
                return ""

        log.error("[OpenRouter] Exhausted retries due to rate limits")
        return ""

    # Run blocking OpenRouter SDK call in the default thread executor
    loop = asyncio.get_running_loop()
    answer = await loop.run_in_executor(None, _sync_call_with_retry)
    if answer:
        log.info("[OpenRouter] Answer generated (%d chars)", len(answer))
        if cache_client is not None:
            try:
                await cache_client.setex(cache_key, 3600, answer)
                log.info("[OpenRouter] Cached synthesis result key=%s ttl=3600", cache_key[:16])
            except Exception as exc:
                log.warning("[OpenRouter] Cache write failed: %s", exc)
    return answer


# ═══════════════════════════════════════════════════════════════════════
#  QUERY COMPLEXITY HEURISTIC
# ═══════════════════════════════════════════════════════════════════════

def query_is_complex(query: str) -> bool:
    """Determine if a query warrants AI synthesis.

    True when the query is longer than 3 words OR contains medical /
    analytical keywords.
    """
    words = query.strip().split()
    query_lower = query.lower()
    is_long = len(words) > 3
    has_complex_keyword = any(kw in query_lower for kw in _COMPLEX_KEYWORDS)
    return is_long or has_complex_keyword


# ═══════════════════════════════════════════════════════════════════════
#  MAIN SEARCH PIPELINE
# ═══════════════════════════════════════════════════════════════════════

async def manthana_search(
    query: str,
    category: str = "medical",
    force_ai: bool = False,
) -> Dict[str, Any]:
    """Execute the full Manthana search pipeline.

    Modes:
      1. **own_index** — enough local results, no AI needed
      2. **own_index_ai** — local results + AI synthesis
      3. **web_search** — web results returned without synthesis
      4. **ai_synthesis** — web + crawl + AI synthesis

    Parameters
    ----------
    query : str
        User's medical search query.
    category : str
        SearXNG search category (default ``"medical"``).
    force_ai : bool
        Force AI synthesis even for simple queries.
    """
    log.info("=" * 60)
    log.info("[MANTHANA] New query: %s | force_ai=%s", query, force_ai)
    t0 = time.monotonic()

    # ── MODE 1: Check own index first (zero cost) ─────────────────────
    own_hits = await search_own_index(query)
    if len(own_hits) >= 5 and not force_ai:
        log.info("[MANTHANA] MODE 1: Serving from own index")
        own_contents = [
            h["_source"].get("content", "")
            for h in own_hits
            if h.get("_source", {}).get("content", "")
        ]
        own_answer: Optional[str] = None
        if (force_ai or query_is_complex(query)) and own_contents:
            log.info("[MANTHANA] MODE 1+AI: Synthesizing from own index")
            combined = "\n\n---\n\n".join(own_contents[:3])
            own_answer = await synthesize(query, combined)

        elapsed = round(time.monotonic() - t0, 2)
        return {
            "mode": "own_index_ai" if own_answer else "own_index",
            "query": query,
            "answer": own_answer,
            "sources": [
                h.get("_source", {}).get("url", "")
                for h in own_hits
                if h.get("_source", {}).get("url")
            ],
            "results": [h.get("_source", {}) for h in own_hits],
            "elapsed_seconds": elapsed,
        }

    # ── MODE 2: Web search + crawl + index ────────────────────────────
    log.info("[MANTHANA] MODE 2: Web search + crawl pipeline")
    web_results = await search_web(query, category)
    top_urls = [r.get("url", "") for r in web_results[:5] if r.get("url")]

    # Extract SearXNG snippets as guaranteed fallback context
    searxng_snippets = [
        r.get("content", "").strip()
        for r in web_results[:5]
        if r.get("content", "").strip()
    ]
    log.info("[MANTHANA] SearXNG snippets available: %d", len(searxng_snippets))

    # Crawl top results for full-page content
    async def _crawl_and_index(result: dict) -> Optional[str]:
        url = result.get("url", "")
        title = result.get("title", "")
        engine = result.get("engine", "")
        if not url:
            return None
        try:
            content = await extract(url)
            if content and len(content) >= MIN_CONTENT_LEN:
                await index_all(url, content, title, engine)
                return content
        except Exception as exc:
            log.warning("[CRAWL] Failed for %s: %s", url[:60], exc)
        return None

    crawl_results = await asyncio.gather(
        *[_crawl_and_index(r) for r in web_results[:5]],
        return_exceptions=True,
    )
    crawled_contents = [
        c for c in crawl_results
        if isinstance(c, str) and c
    ]

    # Use crawled content if available, fall back to SearXNG snippets
    if crawled_contents:
        contents = crawled_contents
        log.info("[MANTHANA] Using crawled content (%d pages)", len(contents))
    elif searxng_snippets:
        contents = searxng_snippets
        log.warning(
            "[MANTHANA] Crawlers unavailable — using SearXNG snippets (%d)",
            len(contents),
        )
    else:
        contents = []
        log.warning("[MANTHANA] No content available from any source")

    # ── MODE 3: AI synthesis ──────────────────────────────────────────
    answer: Optional[str] = None
    if (force_ai or query_is_complex(query)) and contents:
        log.info("[MANTHANA] MODE 3: AI synthesis activated")
        combined = "\n\n---\n\n".join(contents[:3])
        answer = await synthesize(query, combined)

    elapsed = round(time.monotonic() - t0, 2)
    mode = "ai_synthesis" if answer else "web_search"
    log.info(
        "[MANTHANA] ✅ Done in %ss | Mode: %s | Sources: %d",
        elapsed, mode, len(top_urls),
    )

    return {
        "mode": mode,
        "query": query,
        "answer": answer,
        "sources": top_urls,
        "results": web_results[:5],
        "elapsed_seconds": elapsed,
    }


# ═══════════════════════════════════════════════════════════════════════
#  INDEX INITIALISATION
# ═══════════════════════════════════════════════════════════════════════

async def init_indexes() -> None:
    """Create Elasticsearch index, Qdrant collection, and Meilisearch
    index if they don't already exist.  Safe to call multiple times."""

    # ── Elasticsearch ─────────────────────────────────────────────────
    log.info("[INIT] Ensuring Elasticsearch index '%s'...", ES_INDEX)
    try:
        resp = await _get_client().put(
            f"{ELASTICSEARCH}/{ES_INDEX}",
            json={
                "settings": {
                    "number_of_shards": 1,
                    "number_of_replicas": 0,
                    "refresh_interval": "30s",
                    "index.translog.durability": "async",
                },
                "mappings": {
                    "properties": {
                        "url":        {"type": "keyword"},
                        "title":      {"type": "text", "analyzer": "standard"},
                        "content":    {"type": "text", "analyzer": "standard"},
                        "engine":     {"type": "keyword"},
                        "indexed_at": {"type": "date"},
                    }
                },
            },
            timeout=TIMEOUT,
        )
        if resp.status_code in (200, 201):
            log.info("[INIT] ✅ Elasticsearch index created")
        elif resp.status_code == 400:
            log.info("[INIT] Elasticsearch index already exists")
        else:
            log.warning("[INIT] ES responded %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.warning("[INIT] ES index setup failed: %s", exc)

    # ── Qdrant ────────────────────────────────────────────────────────
    log.info("[INIT] Ensuring Qdrant collection '%s'...", QDRANT_COL)
    try:
        resp = await _get_client().put(
            f"{QDRANT}/collections/{QDRANT_COL}",
            json={"vectors": {"size": EMBED_DIM, "distance": "Cosine"}},
            timeout=TIMEOUT,
        )
        if resp.status_code in (200, 201):
            log.info("[INIT] ✅ Qdrant collection created")
        elif resp.status_code == 409:
            log.info("[INIT] Qdrant collection already exists")
        else:
            log.info("[INIT] Qdrant responded %d (may already exist)", resp.status_code)
    except Exception as exc:
        log.warning("[INIT] Qdrant collection setup failed: %s", exc)

    # ── Meilisearch ───────────────────────────────────────────────────
    log.info("[INIT] Ensuring Meilisearch index '%s'...", MEILI_INDEX)
    headers: Dict[str, str] = {"Content-Type": "application/json"}
    if MEILI_KEY:
        headers["Authorization"] = f"Bearer {MEILI_KEY}"
        headers["X-Meili-API-Key"] = MEILI_KEY
    try:
        resp = await _get_client().post(
            f"{MEILISEARCH}/indexes",
            json={"uid": MEILI_INDEX, "primaryKey": "id"},
            headers=headers,
            timeout=TIMEOUT,
        )
        if resp.status_code in (200, 201, 202):
            log.info("[INIT] ✅ Meilisearch index created")
        elif resp.status_code in (400, 409):
            log.info("[INIT] Meilisearch index already exists")
        else:
            log.warning("[INIT] Meili responded %d: %s", resp.status_code, resp.text[:200])
    except Exception as exc:
        log.warning("[INIT] Meili index setup failed: %s", exc)


# ═══════════════════════════════════════════════════════════════════════
#  CLI entry-point
# ═══════════════════════════════════════════════════════════════════════

async def main() -> None:
    """Standalone test: initialise indexes and run a sample query."""
    log.info("🔱 MANTHANA — Medical Intelligence Engine Starting...")
    await init_indexes()
    result = await manthana_search("ashwagandha dosage for stress and anxiety")
    print(json.dumps(result, indent=2, ensure_ascii=False))
    await close_client()


if __name__ == "__main__":
    asyncio.run(main())
