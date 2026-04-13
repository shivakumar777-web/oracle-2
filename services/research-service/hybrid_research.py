"""
hybrid_research.py — GPT Researcher + SearXNG + LangGraph hybrid path (Production Hardened)
============================================================================================
Web search via GPT Researcher's retriever with Tavily fallback.
Synthesis reuses orchestrator ``synthesize_research_report`` for JSON sections + grounding parity with legacy.

Production Features:
- Multi-retriever support (SearXNG primary, Tavily fallback, DuckDuckGo emergency)
- Parallel domain collection for multi-domain queries
- Redis caching for search results
- Circuit breakers for external API resilience
- Comprehensive metrics and structured logging
- Rate limiting and retry logic
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import os
import time
from contextlib import contextmanager
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, AsyncIterator, Callable, Dict, List, Optional, Tuple, TypedDict
from urllib.parse import urlparse

import httpx

from config import ResearchSettings
from services.shared.domain_sources import SOURCE_SITE_FRAGMENT, get_sources_for_domains
from services.shared.models import DeepResearchRequest

logger = logging.getLogger("manthana.research.hybrid")

# =============================================================================
# RETRIEVER CONFIGURATION (Production Multi-Tier)
# =============================================================================

class RetrieverTier(Enum):
    """Search retriever priority tiers for failover."""
    PRIMARY = "searxng"      # Self-hosted, free, full control
    FALLBACK = "tavily"      # Paid API, higher quality
    EMERGENCY = "duckduckgo" # Free, lower quality, last resort


@dataclass
class RetrieverConfig:
    """Configuration for a search retriever."""
    name: str
    enabled: bool = False
    api_key: Optional[str] = None
    base_url: Optional[str] = None
    timeout: float = 30.0
    max_retries: int = 2
    circuit_breaker_failures: int = 5
    circuit_breaker_timeout: float = 60.0
    rate_limit_per_min: int = 100


@dataclass
class HybridMetrics:
    """Runtime metrics for observability."""
    total_queries: int = 0
    successful_queries: int = 0
    failed_queries: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    retriever_switches: int = 0
    avg_response_time_ms: float = 0.0
    domains_per_query: Dict[str, int] = field(default_factory=dict)
    errors_by_type: Dict[str, int] = field(default_factory=dict)

    def record_success(self, duration_ms: float, domains: int):
        self.total_queries += 1
        self.successful_queries += 1
        # Rolling average
        self.avg_response_time_ms = (
            (self.avg_response_time_ms * (self.total_queries - 1) + duration_ms)
            / self.total_queries
        )
        self.domains_per_query[str(domains)] = self.domains_per_query.get(str(domains), 0) + 1

    def record_failure(self, error_type: str):
        self.total_queries += 1
        self.failed_queries += 1
        self.errors_by_type[error_type] = self.errors_by_type.get(error_type, 0) + 1

    def record_cache_hit(self):
        self.cache_hits += 1

    def record_cache_miss(self):
        self.cache_misses += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_queries": self.total_queries,
            "success_rate": self.successful_queries / max(self.total_queries, 1),
            "cache_hit_rate": self.cache_hits / max(self.cache_hits + self.cache_misses, 1),
            "avg_response_time_ms": round(self.avg_response_time_ms, 2),
            "retriever_switches": self.retriever_switches,
            "domains_distribution": self.domains_per_query,
            "error_breakdown": self.errors_by_type,
        }


# Global metrics instance
_hybrid_metrics = HybridMetrics()


def get_hybrid_metrics() -> Dict[str, Any]:
    """Export metrics for health endpoint."""
    return _hybrid_metrics.to_dict()


# =============================================================================
# CIRCUIT BREAKER PATTERN
# =============================================================================

class CircuitState(Enum):
    CLOSED = "closed"      # Normal operation
    OPEN = "open"          # Failing fast
    HALF_OPEN = "half_open"  # Testing recovery


class CircuitBreaker:
    """Circuit breaker for external API resilience."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 60.0,
        half_open_max_calls: int = 3,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        return self._state

    async def call(self, fn: Callable[..., Any], *args, **kwargs) -> Any:
        async with self._lock:
            if self._state == CircuitState.OPEN:
                if self._should_attempt_reset():
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    logger.info(f"Circuit {self.name}: entering HALF_OPEN state")
                else:
                    raise CircuitBreakerOpen(f"Circuit {self.name} is OPEN")

            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self.half_open_max_calls:
                    raise CircuitBreakerOpen(f"Circuit {self.name} HALF_OPEN limit reached")
                self._half_open_calls += 1

        # Execute the call
        try:
            result = await fn(*args, **kwargs)
            await self._on_success()
            return result
        except Exception as e:
            await self._on_failure()
            raise

    async def _on_success(self):
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                if self._success_count >= self.half_open_max_calls:
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._success_count = 0
                    logger.info(f"Circuit {self.name}: CLOSED (recovered)")
            else:
                self._failure_count = max(0, self._failure_count - 1)

    async def _on_failure(self):
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.monotonic()

            if self._state == CircuitState.HALF_OPEN:
                self._state = CircuitState.OPEN
                logger.warning(f"Circuit {self.name}: OPEN (recovery failed)")
            elif self._failure_count >= self.failure_threshold:
                self._state = CircuitState.OPEN
                logger.warning(f"Circuit {self.name}: OPEN (threshold reached)")

    def _should_attempt_reset(self) -> bool:
        if self._last_failure_time is None:
            return True
        return (time.monotonic() - self._last_failure_time) >= self.recovery_timeout


class CircuitBreakerOpen(Exception):
    """Exception raised when circuit breaker is open."""
    pass


# Circuit breakers for retrievers
_searxng_circuit = CircuitBreaker("searxng", failure_threshold=5, recovery_timeout=60.0)
_tavily_circuit = CircuitBreaker("tavily", failure_threshold=3, recovery_timeout=120.0)
_ddg_circuit = CircuitBreaker("duckduckgo", failure_threshold=10, recovery_timeout=30.0)


# =============================================================================
# REDIS CACHING
# =============================================================================

_redis_pool: Optional[Any] = None


def _get_cache_key(query: str, domain: str, depth: str) -> str:
    """Generate cache key for search results."""
    content = f"{query}:{domain}:{depth}:{os.environ.get('RESEARCH_GR_LLM', '')}"
    return f"hybrid:search:{hashlib.sha256(content.encode()).hexdigest()[:16]}"


async def _get_redis_pool() -> Optional[Any]:
    """Lazy initialization of Redis pool."""
    global _redis_pool
    if _redis_pool is not None:
        return _redis_pool

    redis_url = os.environ.get("RESEARCH_REDIS_URL", "")
    if not redis_url:
        return None

    try:
        import redis.asyncio as aioredis
        _redis_pool = aioredis.from_url(redis_url, decode_responses=True)
        await _redis_pool.ping()
        logger.info("Hybrid research: Redis cache connected")
        return _redis_pool
    except Exception as e:
        logger.warning(f"Hybrid research: Redis unavailable ({e}), caching disabled")
        return None


async def _get_cached_search(cache_key: str) -> Optional[List[Dict[str, Any]]]:
    """Retrieve cached search results."""
    redis = await _get_redis_pool()
    if redis is None:
        return None

    try:
        cached = await redis.get(cache_key)
        if cached:
            _hybrid_metrics.record_cache_hit()
            return json.loads(cached)
    except Exception as e:
        logger.debug(f"Cache retrieval error: {e}")

    _hybrid_metrics.record_cache_miss()
    return None


async def _set_cached_search(
    cache_key: str, results: List[Dict[str, Any]], ttl: int = 3600
) -> None:
    """Cache search results with TTL."""
    redis = await _get_redis_pool()
    if redis is None:
        return

    try:
        # Compress large results
        serialized = json.dumps(results, ensure_ascii=False)
        await redis.setex(cache_key, ttl, serialized)
    except Exception as e:
        logger.debug(f"Cache storage error: {e}")


# =============================================================================
# RETRIEVER IMPLEMENTATIONS
# =============================================================================

async def _check_retriever_health(retriever: str, settings: ResearchSettings) -> bool:
    """Health check for a retriever."""
    if retriever == "searxng":
        return await check_searxng_reachable(settings.SEARXNG_URL)
    elif retriever == "tavily":
        return bool(settings.TAVILY_API_KEY)
    elif retriever == "duckduckgo":
        return True  # Always available
    return False


def _select_retriever(settings: ResearchSettings) -> str:
    """Select best available retriever."""
    # Priority order
    retrievers = [
        (RetrieverTier.PRIMARY.value, bool(settings.SEARXNG_URL)),
        (RetrieverTier.FALLBACK.value, bool(settings.TAVILY_API_KEY)),
        (RetrieverTier.EMERGENCY.value, True),  # Always available
    ]

    for name, available in retrievers:
        if available:
            return name

    return RetrieverTier.EMERGENCY.value  # Ultimate fallback


async def _conduct_research_with_retry(
    query: str,
    tradition: str,
    settings: ResearchSettings,
    depth: str,
    max_retries: int = 2,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Conduct research with automatic retriever failover."""
    logs: List[str] = []
    last_error: Optional[Exception] = None

    # Try primary, fallback, emergency retrievers
    retrievers_to_try = [
        (RetrieverTier.PRIMARY.value, _searxng_circuit),
        (RetrieverTier.FALLBACK.value, _tavily_circuit),
        (RetrieverTier.EMERGENCY.value, _ddg_circuit),
    ]

    for retriever_name, circuit in retrievers_to_try:
        # Check if retriever is configured
        if retriever_name == "searxng" and not settings.SEARXNG_URL:
            continue
        if retriever_name == "tavily" and not settings.TAVILY_API_KEY:
            continue

        for attempt in range(max_retries):
            try:
                logs.append(f"Attempting {retriever_name} (attempt {attempt + 1}/{max_retries})...")

                # Use circuit breaker
                docs, lg = await circuit.call(
                    _conduct_research_with_env, query, tradition, settings, depth, retriever_name
                )

                if docs:
                    logs.extend(lg)
                    logs.append(f"✓ Success with {retriever_name}: {len(docs)} sources")

                    if retriever_name != RetrieverTier.PRIMARY.value:
                        _hybrid_metrics.retriever_switches += 1
                        logger.warning(f"Retriever failover: using {retriever_name} instead of primary")

                    return docs, logs

            except CircuitBreakerOpen:
                logs.append(f"✗ Circuit breaker OPEN for {retriever_name}, skipping...")
                break  # Don't retry if circuit is open
            except Exception as e:
                last_error = e
                logs.append(f"✗ {retriever_name} failed: {str(e)[:100]}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(2 ** attempt)  # Exponential backoff

    # All retrievers failed
    logger.error(f"All retrievers failed for query: {query[:100]}...")
    _hybrid_metrics.record_failure("all_retrievers_failed")
    return [], logs + [f"All retrievers exhausted. Last error: {last_error}"]


async def _conduct_research_with_env(
    query: str,
    tradition: str,
    settings: ResearchSettings,
    depth: str,
    retriever: str = "searxng",
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Execute GPT Researcher with specific retriever configuration."""
    from gpt_researcher import GPTResearcher
    from gpt_researcher.utils.enum import Tone

    logs: List[str] = []

    # Configure environment for this retriever
    env_config = _build_retriever_env(settings, depth, retriever)

    with _gpt_researcher_env_with_config(env_config):
        logs.append(f"GPT Researcher: using {retriever} retriever...")

        researcher = GPTResearcher(
            query=query,
            report_type="research_report",
            report_format="markdown",
            tone=Tone.Objective,
            verbose=False,
        )

        await researcher.conduct_research()
        raw = researcher.get_research_sources()
        merged = _gr_sources_to_merged(raw, tradition)
        logs.append(f"Retrieved {len(merged)} sources via {retriever}")

    return merged, logs


def _build_retriever_env(
    settings: ResearchSettings, depth: str, retriever: str
) -> Dict[str, str]:
    """Build environment configuration for specific retriever."""
    d = (depth or "comprehensive").lower().strip()

    # Depth-based budgets
    if d == "focused":
        max_iter, max_search, total_words = 3, 4, 800
    elif d == "exhaustive":
        max_iter, max_search, total_words = 8, 12, 2500
    else:
        max_iter, max_search, total_words = 5, 8, 1400

    if settings.RESEARCH_HYBRID_MAX_STEPS > 0:
        max_iter = settings.RESEARCH_HYBRID_MAX_STEPS

    # Base configuration
    config: Dict[str, str] = {
        "MAX_ITERATIONS": str(max_iter),
        "MAX_SEARCH_RESULTS_PER_QUERY": str(max_search),
        "TOTAL_WORDS": str(total_words),
        "FAST_LLM": settings.RESEARCH_GR_LLM or "openrouter:deepseek/deepseek-chat",
        "SMART_LLM": settings.RESEARCH_GR_LLM or "openrouter:deepseek/deepseek-chat",
        "STRATEGIC_LLM": settings.RESEARCH_GR_LLM or "openrouter:deepseek/deepseek-chat",
        "EMBEDDING": settings.RESEARCH_GR_EMBEDDING or "openrouter:openai/text-embedding-3-small",
    }

    # Add API key if available
    or_key = (settings.OPENROUTER_API_KEY or "").strip()
    or_key_2 = (settings.OPENROUTER_API_KEY_2 or "").strip()
    api_key = or_key if (or_key and len(or_key) >= 8) else or_key_2
    if api_key:
        config["OPENROUTER_API_KEY"] = api_key

    # Retriever-specific configuration
    if retriever == "searxng":
        config["RETRIEVER"] = "searx"
        searx_url = (settings.SEARXNG_URL or "").strip().rstrip("/") + "/"
        config["SEARX_URL"] = searx_url
    elif retriever == "tavily":
        config["RETRIEVER"] = "tavily"
        if settings.TAVILY_API_KEY:
            config["TAVILY_API_KEY"] = settings.TAVILY_API_KEY
    elif retriever == "duckduckgo":
        config["RETRIEVER"] = "duckduckgo"

    # Ollama fallback for embeddings if configured
    ollama_base = (settings.RESEARCH_EMBED_URL or settings.RESEARCH_OLLAMA_URL or "").strip().rstrip("/")
    if ollama_base and config["EMBEDDING"].lower().startswith("ollama:"):
        config["OLLAMA_BASE_URL"] = ollama_base

    return config


@contextmanager
def _gpt_researcher_env_with_config(updates: Dict[str, str]):
    """Apply environment configuration for GPT Researcher."""
    saved: Dict[str, Optional[str]] = {}
    try:
        for k, v in updates.items():
            saved[k] = os.environ.get(k)
            os.environ[k] = v
        yield
    finally:
        for k, old in saved.items():
            if old is None:
                os.environ.pop(k, None)
            else:
                os.environ[k] = old


# =============================================================================
# PARALLEL DOMAIN COLLECTION
# =============================================================================

async def _collect_domain_sources_parallel(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    depth: str,
    log_fn: Optional[Callable[[str], None]] = None,
) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Collect sources from multiple domains in parallel with caching."""
    domains = list(body.domains or [])
    if not domains:
        domains = ["allopathy"]

    sources_filter = list(body.sources or [])
    subdomain_map = dict(body.subdomain_map or {})
    question = body.question_text

    all_docs: List[Dict[str, Any]] = []
    all_logs: List[str] = []

    async def search_single_domain(domain: str) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        """Search a single domain with caching."""
        # Build query with domain intelligence
        q = _build_augmented_query(question, domain, subdomain_map, sources_filter)

        # Check cache
        cache_key = _get_cache_key(q, domain, depth)
        cached = await _get_cached_search(cache_key)
        if cached is not None:
            return domain, cached, [f"[CACHE HIT] Domain {domain}: {len(cached)} sources"]

        # Execute search with retry and failover
        docs, logs = await _conduct_research_with_retry(q, domain, settings, depth)

        # Cache successful results
        if docs:
            await _set_cached_search(cache_key, docs, ttl=1800)  # 30 min cache

        return domain, docs, logs

    # Execute all domain searches in parallel with semaphore for rate limiting
    semaphore = asyncio.Semaphore(3)  # Max 3 concurrent domain searches

    async def bounded_search(domain: str) -> Tuple[str, List[Dict[str, Any]], List[str]]:
        async with semaphore:
            return await search_single_domain(domain)

    # Run all searches concurrently
    results = await asyncio.gather(*[bounded_search(d) for d in domains], return_exceptions=True)

    # Process results
    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Domain search failed: {result}")
            all_logs.append(f"Domain search error: {str(result)[:100]}")
            continue

        domain, docs, logs = result
        for d in docs:
            d["source"] = domain
        all_docs.extend(docs)
        all_logs.extend(logs)

        if log_fn:
            for line in logs:
                log_fn(line)
            log_fn(f"Completed domain: {domain} ({len(docs)} sources)")

    return _dedupe_merged(all_docs), all_logs


# =============================================================================
# UTILITY FUNCTIONS
# =============================================================================

def _build_augmented_query(
    question: str,
    domain_id: str,
    subdomain_map: Dict[str, List[str]],
    sources_filter: List[str],
) -> str:
    """Build augmented query with domain intelligence."""
    doms = [domain_id] if domain_id else []
    pills = _domain_source_pills(doms, sources_filter)
    frag = _site_fragments_for_pills(pills)
    subs = subdomain_map.get(domain_id) or []
    bits = [question.strip()]
    if subs:
        bits.append("Focus areas: " + ", ".join(subs))
    if frag:
        bits.append("Prefer sources matching: " + frag)
    return "\n\n".join(bits)


def _domain_source_pills(domains: List[str], sources_filter: List[str]) -> List[str]:
    """Get source pills for domains."""
    auto = get_sources_for_domains(domains)
    if not sources_filter:
        return auto
    filt = set(sources_filter)
    return [s for s in auto if s in filt]


def _site_fragments_for_pills(pills: List[str]) -> str:
    """Build site: fragments for search scoping."""
    parts: List[str] = []
    for p in pills:
        frag = SOURCE_SITE_FRAGMENT.get(p)
        if frag:
            parts.append(f"({frag})")
    if not parts:
        return ""
    return " OR ".join(parts)


def _gr_sources_to_merged(sources: List[Dict[str, Any]], tradition: str) -> List[Dict[str, Any]]:
    """Normalize GPT Researcher sources to merged format."""
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for i, s in enumerate(sources or []):
        if not isinstance(s, dict):
            continue
        url = (s.get("url") or "").strip()
        key = url or f"idx-{i}"
        if key in seen:
            continue
        seen.add(key)
        title = (s.get("title") or "").strip() or (urlparse(url).netloc if url else f"Source {i+1}")
        content = (s.get("content") or s.get("raw_content") or "")[:2000]
        out.append({
            "title": title,
            "content": content,
            "url": url or None,
            "source": tradition or "gpt-researcher",
        })
    return out


def _dedupe_merged(docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Deduplicate merged documents by URL."""
    seen: set[str] = set()
    out: List[Dict[str, Any]] = []
    for d in docs:
        u = (d.get("url") or "") + "\0" + (d.get("title") or "")
        if u in seen:
            continue
        seen.add(u)
        out.append(d)
    return out


# =============================================================================
# PUBLIC API EXPORTS (Health & Readiness)
# =============================================================================

async def check_searxng_reachable(url: str, timeout: float = 5.0) -> bool:
    """Check if SearXNG is reachable."""
    base = (url or "").strip().rstrip("/")
    if not base:
        return False
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.get(f"{base}/", follow_redirects=True)
            return resp.status_code < 500
    except Exception as exc:
        logger.debug("searxng_probe_failed: %s", exc)
        return False


def hybrid_dependencies_available() -> bool:
    """Check if hybrid dependencies are installed."""
    try:
        import gpt_researcher  # noqa: F401
        import langgraph  # noqa: F401
        return True
    except ImportError:
        return False


def hybrid_ready(settings: ResearchSettings) -> Tuple[bool, str]:
    """Check if hybrid research is ready to run."""
    if not hybrid_dependencies_available():
        return False, "gpt_researcher_or_langgraph_import_failed"
    if not (settings.SEARXNG_URL or settings.TAVILY_API_KEY):
        return False, "no_search_retriever_configured"
    return True, "ok"


# =============================================================================
# LANGGRAPH GRAPH DEFINITION
# =============================================================================

class _GraphState(TypedDict, total=False):
    """LangGraph state type."""
    merged_docs: List[Dict[str, Any]]
    research_logs: List[str]
    sections: List[Dict[str, Any]]
    followup_questions: List[str]
    citations: List[Dict[str, Any]]
    provider_used: str
    error: str


async def _langgraph_run_hybrid(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
    merged_seed: List[Dict[str, Any]],
    use_deep: bool,
    log_fn: Optional[Callable[[str], None]] = None,
) -> _GraphState:
    """LangGraph workflow for hybrid research."""
    from langgraph.graph import END, StateGraph

    depth = (body.depth or "comprehensive").strip()
    domains = list(body.domains or [])
    subdomains = list(body.subdomains or [])
    subdomain_map = dict(body.subdomain_map or {})
    intent = (body.intent or "clinical").strip()
    output_format = (body.output_format or "structured").lower()
    citation_style = (body.citation_style or "vancouver").lower()
    lang = (body.lang or "en").strip()

    async def node_collect(state: _GraphState) -> _GraphState:
        """Collect sources from all domains."""
        merged, logs = await _collect_domain_sources_parallel(body, settings, depth, log_fn=log_fn)
        return {"merged_docs": merged, "research_logs": logs}

    async def node_synthesize(state: _GraphState) -> _GraphState:
        """Synthesize report from collected sources."""
        merged = state.get("merged_docs") or merged_seed
        from orchestrator import _apply_scoring_and_cap, _depth_config, synthesize_research_report

        budget = _depth_config(depth)
        total_cap = int(budget["total_cap"])
        merged2, _ = _apply_scoring_and_cap(merged, body.question_text, domains, use_deep, total_cap)
        sections, followup, citations, provider_used = await synthesize_research_report(
            body.question_text,
            domains,
            subdomains,
            subdomain_map,
            intent,
            depth,
            merged2,
            output_format,
            citation_style,
            lang,
            settings,
            request_id,
            use_deep=use_deep,
            log_callback=log_fn,
        )
        return {
            "sections": sections,
            "followup_questions": followup,
            "citations": citations,
            "provider_used": provider_used,
        }

    # Build graph
    graph = StateGraph(_GraphState)
    graph.add_node("collect", node_collect)
    graph.add_node("synthesize", node_synthesize)
    graph.set_entry_point("collect")
    graph.add_edge("collect", "synthesize")
    graph.add_edge("synthesize", END)
    app = graph.compile()

    initial: _GraphState = {"merged_docs": merged_seed, "research_logs": []}
    return await app.ainvoke(initial)


# =============================================================================
# MAIN ENTRY POINTS
# =============================================================================

def hybrid_pipeline_timeout(settings: ResearchSettings, body: DeepResearchRequest) -> float:
    """Calculate timeout for hybrid pipeline."""
    from orchestrator import _depth_config, _effective_total_timeout

    depth = (body.depth or "comprehensive").strip()
    budget = _depth_config(depth)
    base = _effective_total_timeout(budget, getattr(body, "target_seconds", None))

    if settings.RESEARCH_HYBRID_TIMEOUT_SECONDS and settings.RESEARCH_HYBRID_TIMEOUT_SECONDS > 0:
        return min(float(settings.RESEARCH_HYBRID_TIMEOUT_SECONDS), base)
    return base


async def run_hybrid_research(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
) -> Dict[str, Any]:
    """Run hybrid research (sync endpoint)."""
    t0 = time.monotonic()

    # Validate readiness
    ready, reason = hybrid_ready(settings)
    if not ready:
        _hybrid_metrics.record_failure(f"not_ready:{reason}")
        return {
            "query": body.question_text or "",
            "error": f"Hybrid research not ready: {reason}",
            "sections": [{"id": "error", "title": "Not Ready", "content": reason}],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": 0,
            "generated_at": _iso_now(),
            "integrative_mode": False,
            "followup_questions": [],
            "citation_style": body.citation_style or "vancouver",
            "provider_used": "",
        }

    # Run pipeline with timeout
    timeout_sec = hybrid_pipeline_timeout(settings, body)

    try:
        final = await asyncio.wait_for(
            _langgraph_run_hybrid(
                body, settings, request_id, merged_seed=[], use_deep=True, log_fn=None
            ),
            timeout=timeout_sec,
        )

        merged = final.get("merged_docs") or []

        # Record lesson for evolution
        from evolution import record_lesson
        domains = list(body.domains or [])
        intent = (body.intent or "clinical").strip()
        question = (body.question_text or "")[:200]
        outcome = "good" if len(merged) >= 3 else "degraded"
        record_lesson(
            domains,
            intent,
            question,
            outcome,
            {"hybrid": len(merged), "path": "hybrid", "retriever": _select_retriever(settings)},
            notes="path=hybrid",
        )

        elapsed = time.monotonic() - t0
        _hybrid_metrics.record_success(elapsed * 1000, len(domains))

        return {
            "query": body.question_text or "",
            "domains_consulted": domains,
            "subdomains_consulted": list(body.subdomains or []),
            "intent": intent,
            "sections": final.get("sections") or [],
            "citations": final.get("citations") or [],
            "sources_searched": len(merged),
            "time_taken_seconds": int(elapsed),
            "generated_at": _iso_now(),
            "integrative_mode": len(domains) >= 2,
            "followup_questions": final.get("followup_questions") or [],
            "citation_style": (body.citation_style or "vancouver").lower(),
            "provider_used": final.get("provider_used") or "",
        }

    except asyncio.TimeoutError:
        _hybrid_metrics.record_failure("timeout")
        logger.warning("hybrid_research_timeout", extra={"request_id": request_id, "timeout": timeout_sec})
        return {
            "query": body.question_text or "",
            "domains_consulted": list(body.domains or []),
            "subdomains_consulted": list(body.subdomains or []),
            "intent": body.intent or "clinical",
            "sections": [{
                "id": "timeout",
                "title": "Time limit reached",
                "content": f"Hybrid research exceeded the time budget ({timeout_sec:.0f}s).",
            }],
            "citations": [],
            "sources_searched": 0,
            "time_taken_seconds": int(time.monotonic() - t0),
            "generated_at": _iso_now(),
            "integrative_mode": len(body.domains or []) >= 2,
            "followup_questions": [],
            "citation_style": body.citation_style or "vancouver",
            "provider_used": "",
        }

    except Exception as exc:
        _hybrid_metrics.record_failure(f"exception:{type(exc).__name__}")
        logger.exception("hybrid_research_error", extra={"request_id": request_id})
        raise


async def stream_hybrid_research_events(
    body: DeepResearchRequest,
    settings: ResearchSettings,
    request_id: str,
    timeout_override: Optional[float] = None,
) -> AsyncIterator[Dict[str, Any]]:
    """Stream hybrid research events (SSE endpoint).

    ``timeout_override`` is passed from ``orchestrator.stream_research_events`` when
    hybrid mode is active; if None, timeout is derived from depth + settings.
    """
    t0 = time.monotonic()
    log_lines: List[str] = []

    def log_cb(msg: str) -> None:
        log_lines.append(msg)

    ready, reason = hybrid_ready(settings)
    if not ready:
        yield {"type": "error", "message": f"Hybrid research not ready: {reason}"}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": 0,
                "integrative_mode": False,
                "citation_style": body.citation_style or "vancouver",
                "provider_used": "",
            },
        }
        return

    timeout_sec = (
        float(timeout_override)
        if timeout_override is not None and timeout_override > 0
        else hybrid_pipeline_timeout(settings, body)
    )
    use_deep = True  # Always deep for streaming

    try:
        yield {"type": "log", "text": "Starting Manthana Hybrid Deep Research..."}
        yield {"type": "log", "text": f"Selected retriever: {_select_retriever(settings)}"}

        final = await asyncio.wait_for(
            _langgraph_run_hybrid(
                body, settings, request_id, merged_seed=[], use_deep=use_deep, log_fn=log_cb
            ),
            timeout=timeout_sec,
        )

        for line in log_lines:
            yield {"type": "log", "text": line}

        merged = final.get("merged_docs") or []
        yield {"type": "log", "text": f"Merged {len(merged)} unique sources for synthesis."}

        # Record lesson
        from evolution import record_lesson
        domains = list(body.domains or [])
        intent = (body.intent or "clinical").strip()
        question = (body.question_text or "")[:200]
        record_lesson(
            domains,
            intent,
            question,
            "good" if len(merged) >= 3 else "degraded",
            {"hybrid": len(merged), "path": "hybrid"},
            notes="path=hybrid",
        )

        elapsed = time.monotonic() - t0
        _hybrid_metrics.record_success(elapsed * 1000, len(domains))

        # Yield results
        payload = {
            "sections": final.get("sections") or [],
            "citations": final.get("citations") or [],
            "followup_questions": final.get("followup_questions") or [],
            "sources_searched": len(merged),
            "integrative_mode": len(domains) >= 2,
            "provider_used": final.get("provider_used") or "",
        }

        async for ev in _yield_section_events(payload, elapsed, request_id, body.citation_style or "vancouver"):
            yield ev

    except asyncio.TimeoutError:
        _hybrid_metrics.record_failure("stream_timeout")
        yield {"type": "error", "message": f"Research exceeded time budget ({timeout_sec:.0f}s)."}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(body.domains or []) >= 2,
                "request_id": request_id,
                "citation_style": body.citation_style or "vancouver",
                "provider_used": "",
            },
        }

    except Exception as exc:
        _hybrid_metrics.record_failure(f"stream_exception:{type(exc).__name__}")
        logger.exception("hybrid_stream_error", extra={"request_id": request_id})
        yield {"type": "error", "message": str(exc)}
        yield {
            "type": "done",
            "meta": {
                "sources_searched": 0,
                "time_taken_seconds": int(time.monotonic() - t0),
                "integrative_mode": len(body.domains or []) >= 2,
                "request_id": request_id,
                "citation_style": body.citation_style or "vancouver",
                "provider_used": "",
            },
        }


async def _yield_section_events(
    payload: Dict[str, Any],
    elapsed: float,
    request_id: str,
    citation_style: str,
) -> AsyncIterator[Dict[str, Any]]:
    """Yield result events for streaming."""
    for sec in payload.get("sections", []):
        yield {
            "type": "section",
            "id": sec.get("id", "section"),
            "title": sec.get("title", "Section"),
            "content": sec.get("content", ""),
        }

    yield {"type": "citations", "data": payload.get("citations", [])}
    yield {"type": "followup", "questions": payload.get("followup_questions", [])}

    yield {
        "type": "done",
        "meta": {
            "sources_searched": payload.get("sources_searched", 0),
            "time_taken_seconds": int(elapsed),
            "integrative_mode": payload.get("integrative_mode", False),
            "request_id": request_id,
            "citation_style": citation_style,
            "provider_used": payload.get("provider_used", ""),
        },
    }


def _iso_now() -> str:
    """ISO timestamp for generated_at."""
    return (
        datetime.now(timezone.utc)
        .replace(microsecond=0)
        .isoformat()
        .replace("+00:00", "Z")
    )


# =============================================================================
# GPT RESEARCHER ENV (SearXNG default)
# =============================================================================

@contextmanager
def _gpt_researcher_env(settings: ResearchSettings, depth: str) -> Any:
    """Apply GPT Researcher env vars for SearXNG (primary retriever)."""
    config = _build_retriever_env(settings, depth, "searxng")
    with _gpt_researcher_env_with_config(config):
        yield
