"""
config.py — Web Service Configuration
======================================
Web search-specific settings for SearXNG, MeiliSearch integration.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class WebSettings(BaseSettings):
    """Web service-specific settings for search aggregation."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ══════════════════════════════════════════════════════════════════
    #  SERVICE IDENTITY
    # ══════════════════════════════════════════════════════════════════

    SERVICE_NAME: str = Field(default="web-service")
    SERVICE_VERSION: str = Field(default="2.0.0")
    API_PREFIX: str = Field(default="/v1")

    # ══════════════════════════════════════════════════════════════════
    #  SEARCH BACKENDS
    # ══════════════════════════════════════════════════════════════════

    WEB_SEARXNG_URL: str = Field(
        default="http://searxng:8080",
        description="SearXNG meta-search engine URL.",
    )
    WEB_SEARXNG_TIMEOUT: float = Field(
        default=8.0,
        description="Timeout for SearXNG requests in seconds.",
    )

    WEB_MEILISEARCH_URL: Optional[str] = Field(
        default=None,
        description="Optional MeiliSearch URL for local index.",
    )
    WEB_MEILISEARCH_KEY: Optional[str] = Field(
        default=None,
        description="MeiliSearch API key.",
    )
    WEB_MEILISEARCH_INDEX: str = Field(
        default="medical_search",
        description="MeiliSearch index name.",
    )

    WEB_ENABLE_TRIALS: bool = Field(
        default=True,
        description="Enable ClinicalTrials.gov integration.",
    )
    WEB_ENABLE_GUIDELINES: bool = Field(
        default=True,
        description="Enable medical guidelines search (MeiliSearch guidelines index).",
    )
    WEB_MEILISEARCH_GUIDELINES_INDEX: str = Field(
        default="guidelines",
        description="MeiliSearch index for medical guidelines.",
    )

    NCBI_API_KEY: Optional[str] = Field(
        default=None,
        description="Optional NCBI API key for higher PubMed rate limits (10 req/sec vs 3).",
    )
    SEMANTIC_SCHOLAR_API_KEY: Optional[str] = Field(
        default=None,
        description="Optional Semantic Scholar API key (higher rate limits). Free: semanticscholar.org/product/api",
    )
    OPENALEX_MAILTO: Optional[str] = Field(
        default=None,
        description="Contact email for OpenAlex/Crossref polite-pool User-Agent (recommended).",
    )
    CROSSREF_MAILTO: Optional[str] = Field(
        default=None,
        description="Alias for OPENALEX_MAILTO if you want a separate Crossref contact.",
    )
    CORE_API_KEY: Optional[str] = Field(
        default=None,
        description="Optional CORE API v3 Bearer token (higher rate limits); basic search works without a key.",
    )
    WEB_ENABLE_CTRI: bool = Field(
        default=False,
        description="Enable CTRI (India) trial search.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  KNOWLEDGE PANEL AI (OpenRouter — role web_knowledge in cloud_inference.yaml)
    # ══════════════════════════════════════════════════════════════════

    OPENROUTER_API_KEY: Optional[str] = Field(
        default=None,
        description="OpenRouter API key for Knowledge Panel AI summary (optional).",
    )
    OPENROUTER_API_KEY_2: Optional[str] = Field(default=None, description="Optional second OpenRouter key.")
    WEB_KNOWLEDGE_CACHE_TTL: int = Field(
        default=86400,
        description="Knowledge summary cache TTL in seconds (24h default).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  DATABASE
    # ══════════════════════════════════════════════════════════════════

    DATABASE_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL URL for cache and analytics (postgresql://user:pass@host:5432/db).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CACHING
    # ══════════════════════════════════════════════════════════════════

    WEB_REDIS_URL: Optional[str] = Field(
        default=None,
        description="Optional Redis URL for search result caching.",
    )
    WEB_CACHE_TTL: int = Field(
        default=300,
        description="Cache TTL in seconds for search results.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  RATE LIMITING
    # ══════════════════════════════════════════════════════════════════

    WEB_RATE_LIMIT: str = Field(
        default="200/minute",
        description="Rate limit for search endpoints.",
    )
    WEB_AUTOCOMPLETE_RATE_LIMIT: str = Field(
        default="300/minute",
        description="Rate limit for autocomplete endpoint.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  FEATURE FLAGS
    # ══════════════════════════════════════════════════════════════════

    WEB_ENABLE_IMAGES: bool = Field(
        default=True,
        description="Enable image search results.",
    )
    WEB_ENABLE_VIDEOS: bool = Field(
        default=True,
        description="Enable video search results.",
    )
    WEB_ENABLE_LOCAL_INDEX: bool = Field(
        default=True,
        description="Enable MeiliSearch local index queries.",
    )
    WEB_ENABLE_RELATED_QUESTIONS: bool = Field(
        default=True,
        description="Generate related questions for queries.",
    )
    WEB_FEATURE_LOCKED: bool = Field(
        default=False,
        description="When true, GET /search returns 503 with status=locked (Manthana Web paused).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  TRUST SCORING
    # ══════════════════════════════════════════════════════════════════

    WEB_TRUST_PEER_REVIEWED_DOMAINS: list = Field(
        default_factory=lambda: [
            "pubmed.ncbi.nlm.nih.gov",
            "ncbi.nlm.nih.gov",
            "who.int",
            "cdc.gov",
            "fda.gov",
            "ema.europa.eu",
            "cochrane.org",
            "nejm.org",
            "thelancet.com",
            "jamanetwork.com",
            "bmj.com",
            "nature.com",
            "sciencedirect.com",
            "springer.com",
            "wiley.com",
            "academic.oup.com",
        ],
        description="Domains considered peer-reviewed sources.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CORS & AUTH
    # ══════════════════════════════════════════════════════════════════

    FRONTEND_URL: str = Field(
        default="http://localhost:3001",
        description="Frontend origin for CORS.",
    )
    BETTER_AUTH_URL: str = Field(
        default="http://localhost:3001",
        description="Better Auth URL for JWT validation.",
    )
    REQUIRE_AUTH: bool = Field(
        default=False,
        description="Require JWT authentication.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  LOGGING
    # ══════════════════════════════════════════════════════════════════

    LOG_LEVEL: str = Field(
        default="INFO",
        description="Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL.",
    )


@lru_cache
def get_web_settings() -> WebSettings:
    """Get cached Web settings instance."""
    return WebSettings()


def configure_logging(level: Optional[str] = None) -> None:
    """Configure logging for Web service."""
    settings = get_web_settings()
    log_level = (level or settings.LOG_LEVEL).upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
