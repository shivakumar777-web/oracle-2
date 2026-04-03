"""
redis_keys.py — Redis Key Namespacing
========================================
Service-scoped Redis key prefixes for data isolation.
"""

from __future__ import annotations

from typing import Optional


class RedisKeySpace:
    """Redis key namespace manager for service isolation."""

    def __init__(self, service_name: str):
        self.service_name = service_name
        self.prefix = f"{service_name}:"

    def cache(self, key: str) -> str:
        """Cache key."""
        return f"{self.prefix}cache:{key}"

    def session(self, session_id: str) -> str:
        """Session key."""
        return f"{self.prefix}session:{session_id}"

    def rate_limit(self, identifier: str) -> str:
        """Rate limit key."""
        return f"{self.prefix}ratelimit:{identifier}"

    def lock(self, resource: str) -> str:
        """Distributed lock key."""
        return f"{self.prefix}lock:{resource}"

    def queue(self, queue_name: str) -> str:
        """Queue key."""
        return f"{self.prefix}queue:{queue_name}"

    def metadata(self, key: str) -> str:
        """Metadata key."""
        return f"{self.prefix}meta:{key}"

    def analytics(self, metric: str) -> str:
        """Analytics counter key."""
        return f"{self.prefix}analytics:{metric}"


# ═══════════════════════════════════════════════════════════════════════
#  SERVICE-SPECIFIC KEY SPACES
# ═══════════════════════════════════════════════════════════════════════

# Oracle service keys
oracle_keys = RedisKeySpace("oracle")

# Web service keys
web_keys = RedisKeySpace("web")

# Research service keys
research_keys = RedisKeySpace("research")

# Analysis service keys
analysis_keys = RedisKeySpace("analysis")


# ═══════════════════════════════════════════════════════════════════════
#  COMMON KEY PATTERNS
# ═══════════════════════════════════════════════════════════════════════

def search_cache_key(query: str, domain: str, service: str = "web") -> str:
    """Generate search cache key."""
    import hashlib
    query_hash = hashlib.sha256(f"{query}:{domain}".encode()).hexdigest()[:16]
    return RedisKeySpace(service).cache(f"search:{query_hash}")


def chat_session_key(session_id: str, service: str = "oracle") -> str:
    """Generate chat session key."""
    return RedisKeySpace(service).session(session_id)


def rate_limit_key(identifier: str, service: str) -> str:
    """Generate rate limit key."""
    return RedisKeySpace(service).rate_limit(identifier)


def analysis_job_key(job_id: str, service: str = "analysis") -> str:
    """Generate analysis job key."""
    return RedisKeySpace(service).metadata(f"job:{job_id}")


def research_session_key(session_id: str, service: str = "research") -> str:
    """Generate research session key."""
    return RedisKeySpace(service).session(session_id)


def plagiarism_scan_key(scan_id: str, service: str = "research") -> str:
    """Generate plagiarism scan key."""
    return RedisKeySpace(service).metadata(f"plagiarism:{scan_id}")
