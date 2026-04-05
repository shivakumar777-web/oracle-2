"""
circuit_breaker.py — Service-Specific Circuit Breakers
=======================================================
Circuit breaker pattern implementation for graceful degradation.
Each service can have its own failure threshold and recovery timeout.
"""

from __future__ import annotations

import asyncio
import functools
import logging
import time
from enum import Enum
from typing import Any, Callable, Dict, Optional, TypeVar, Union

logger = logging.getLogger("manthana.circuit")

T = TypeVar("T")


class CircuitState(Enum):
    """Circuit breaker states."""
    CLOSED = "closed"       # Normal operation - requests pass through
    OPEN = "open"           # Failure threshold reached - requests blocked
    HALF_OPEN = "half_open"  # Testing if service recovered


class CircuitBreakerError(Exception):
    """Raised when circuit breaker is open."""
    pass


class CircuitBreaker:
    """Circuit breaker for service call protection."""

    def __init__(
        self,
        name: str,
        failure_threshold: int = 5,
        recovery_timeout: float = 30.0,
        half_open_max_calls: int = 3,
        expected_exception: type = Exception,
    ):
        self.name = name
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.half_open_max_calls = half_open_max_calls
        self.expected_exception = expected_exception

        self._state = CircuitState.CLOSED
        self._failure_count = 0
        self._success_count = 0
        self._last_failure_time: Optional[float] = None
        self._half_open_calls = 0
        self._lock = asyncio.Lock()

    @property
    def state(self) -> CircuitState:
        """Current circuit state."""
        return self._state

    async def call(self, func: Callable[..., T], *args, **kwargs) -> T:
        """Execute function with circuit breaker protection."""
        async with self._lock:
            await self._update_state()

            if self._state == CircuitState.OPEN:
                raise CircuitBreakerError(
                    f"Circuit '{self.name}' is OPEN - service unavailable"
                )

            if self._state == CircuitState.HALF_OPEN:
                if self._half_open_calls >= self.half_open_max_calls:
                    raise CircuitBreakerError(
                        f"Circuit '{self.name}' is HALF_OPEN - max test calls reached"
                    )
                self._half_open_calls += 1

        # Execute the call outside the lock
        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
            await self._on_success()
            return result
        except self.expected_exception as e:
            await self._on_failure()
            raise

    async def _update_state(self) -> None:
        """Update circuit state based on time and failures."""
        if self._state == CircuitState.OPEN:
            # Check if recovery timeout has passed
            if self._last_failure_time:
                elapsed = time.time() - self._last_failure_time
                if elapsed >= self.recovery_timeout:
                    logger.info(
                        f"Circuit '{self.name}' transitioning OPEN -> HALF_OPEN"
                    )
                    self._state = CircuitState.HALF_OPEN
                    self._half_open_calls = 0
                    self._success_count = 0

    async def _on_success(self) -> None:
        """Handle successful call."""
        async with self._lock:
            if self._state == CircuitState.HALF_OPEN:
                self._success_count += 1
                # If enough successes in half-open, close the circuit
                if self._success_count >= self.half_open_max_calls:
                    logger.info(
                        f"Circuit '{self.name}' transitioning HALF_OPEN -> CLOSED"
                    )
                    self._state = CircuitState.CLOSED
                    self._failure_count = 0
                    self._half_open_calls = 0
            elif self._state == CircuitState.CLOSED:
                # Reset failure count on success
                self._failure_count = 0

    async def _on_failure(self) -> None:
        """Handle failed call."""
        async with self._lock:
            self._failure_count += 1
            self._last_failure_time = time.time()

            if self._state == CircuitState.HALF_OPEN:
                # Failure in half-open goes back to open
                logger.warning(
                    f"Circuit '{self.name}' transitioning HALF_OPEN -> OPEN"
                )
                self._state = CircuitState.OPEN
            elif self._state == CircuitState.CLOSED:
                if self._failure_count >= self.failure_threshold:
                    logger.warning(
                        f"Circuit '{self.name}' transitioning CLOSED -> OPEN "
                        f"({self._failure_count} failures)"
                    )
                    self._state = CircuitState.OPEN

    def get_stats(self) -> Dict[str, Any]:
        """Get circuit breaker statistics."""
        return {
            "name": self.name,
            "state": self._state.value,
            "failure_count": self._failure_count,
            "success_count": self._success_count,
            "failure_threshold": self.failure_threshold,
            "recovery_timeout": self.recovery_timeout,
            "last_failure_time": self._last_failure_time,
        }


# Global circuit breaker registry
_CIRCUIT_BREAKERS: Dict[str, CircuitBreaker] = {}


def get_circuit_breaker(
    name: str,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
) -> CircuitBreaker:
    """Get or create a circuit breaker."""
    if name not in _CIRCUIT_BREAKERS:
        _CIRCUIT_BREAKERS[name] = CircuitBreaker(
            name=name,
            failure_threshold=failure_threshold,
            recovery_timeout=recovery_timeout,
        )
    return _CIRCUIT_BREAKERS[name]


def circuit(
    name: Optional[str] = None,
    failure_threshold: int = 5,
    recovery_timeout: float = 30.0,
    fallback: Optional[Callable[..., T]] = None,
) -> Callable:
    """Decorator for circuit breaker protection."""
    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        cb_name = name or func.__name__
        breaker = get_circuit_breaker(cb_name, failure_threshold, recovery_timeout)

        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs) -> T:
            try:
                return await breaker.call(func, *args, **kwargs)
            except CircuitBreakerError:
                if fallback:
                    if asyncio.iscoroutinefunction(fallback):
                        return await fallback(*args, **kwargs)
                    return fallback(*args, **kwargs)
                raise

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs) -> T:
            # For sync functions, run in executor
            loop = asyncio.get_event_loop()
            try:
                return loop.run_until_complete(breaker.call(func, *args, **kwargs))
            except CircuitBreakerError:
                if fallback:
                    return fallback(*args, **kwargs)
                raise

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        return sync_wrapper

    return decorator


# ═══════════════════════════════════════════════════════════════════════
#  SERVICE-SPECIFIC CIRCUIT BREAKERS
# ═══════════════════════════════════════════════════════════════════════

# Oracle service - stricter (LLM is expensive); OpenRouter-backed chat/M5
oracle_openrouter_circuit = get_circuit_breaker(
    "oracle_openrouter",
    failure_threshold=3,
    recovery_timeout=60.0,
)
oracle_groq_circuit = oracle_openrouter_circuit  # deprecated alias, same breaker instance

oracle_ollama_circuit = get_circuit_breaker(
    "oracle_ollama",
    failure_threshold=5,
    recovery_timeout=30.0,
)

# Web service - more permissive (search is cheap)
web_searxng_circuit = get_circuit_breaker(
    "web_searxng",
    failure_threshold=10,
    recovery_timeout=30.0,
)

web_meilisearch_circuit = get_circuit_breaker(
    "web_meilisearch",
    failure_threshold=5,
    recovery_timeout=60.0,
)

# Research service
research_groq_circuit = get_circuit_breaker(
    "research_groq",
    failure_threshold=3,
    recovery_timeout=60.0,
)

research_searxng_circuit = get_circuit_breaker(
    "research_searxng",
    failure_threshold=10,
    recovery_timeout=30.0,
)

# Analysis service
analysis_clinical_circuit = get_circuit_breaker(
    "analysis_clinical",
    failure_threshold=5,
    recovery_timeout=30.0,
)

# Web service — per-source circuit breakers (Phase 15)
web_pubmed_circuit = get_circuit_breaker(
    "web_pubmed",
    failure_threshold=5,
    recovery_timeout=30.0,
)

web_semantic_scholar_circuit = get_circuit_breaker(
    "web_semantic_scholar",
    failure_threshold=5,
    recovery_timeout=30.0,
)

web_clinical_trials_circuit = get_circuit_breaker(
    "web_clinical_trials",
    failure_threshold=5,
    recovery_timeout=30.0,
)

web_youtube_circuit = get_circuit_breaker(
    "web_youtube",
    failure_threshold=3,
    recovery_timeout=60.0,
)

web_pmc_circuit = get_circuit_breaker(
    "web_pmc",
    failure_threshold=5,
    recovery_timeout=30.0,
)

web_europe_pmc_circuit = get_circuit_breaker(
    "web_europe_pmc",
    failure_threshold=5,
    recovery_timeout=30.0,
)

web_openalex_circuit = get_circuit_breaker(
    "web_openalex",
    failure_threshold=5,
    recovery_timeout=45.0,
)

web_crossref_circuit = get_circuit_breaker(
    "web_crossref",
    failure_threshold=5,
    recovery_timeout=45.0,
)

web_doaj_circuit = get_circuit_breaker(
    "web_doaj",
    failure_threshold=5,
    recovery_timeout=45.0,
)

web_core_circuit = get_circuit_breaker(
    "web_core",
    failure_threshold=5,
    recovery_timeout=45.0,
)

web_wikidata_circuit = get_circuit_breaker(
    "web_wikidata",
    failure_threshold=8,
    recovery_timeout=30.0,
)


def get_all_circuit_stats() -> Dict[str, Dict[str, Any]]:
    """Get statistics for all circuit breakers."""
    return {
        name: cb.get_stats()
        for name, cb in _CIRCUIT_BREAKERS.items()
    }
