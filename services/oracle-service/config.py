"""
config.py — Oracle Service Configuration
============================================
Oracle-specific settings for chat, M5, query intelligence, and domain handling.
Falls back to shared settings where appropriate for gradual migration.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class OracleSettings(BaseSettings):
    """Oracle service-specific settings.

    All Oracle-specific configuration with fallback to ai-router defaults.
    """

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",  # Allow extra env vars for compatibility
    )

    # ══════════════════════════════════════════════════════════════════
    #  SERVICE IDENTITY
    # ══════════════════════════════════════════════════════════════════

    SERVICE_NAME: str = Field(default="oracle-service")
    SERVICE_VERSION: str = Field(default="1.0.0")
    API_PREFIX: str = Field(default="/v1")

    # ══════════════════════════════════════════════════════════════════
    #  LLM CONFIGURATION
    # ══════════════════════════════════════════════════════════════════

    ORACLE_GROQ_API_KEY: str = Field(
        default="",
        description="Primary Groq API key for LLM inference.",
    )
    ORACLE_GROQ_API_KEY_2: str = Field(
        default="",
        description="Secondary Groq API key (used when primary hits rate limit).",
    )
    ORACLE_GROQ_MODEL: str = Field(
        default="llama-3.3-70b-versatile",
        description="Primary Groq model for chat completions.",
    )
    ORACLE_FALLBACK_ENABLED: bool = Field(
        default=False,
        description="Enable fallback to secondary Groq key when primary fails.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  VECTOR & SEARCH (Phase A: RAG for chat)
    # ══════════════════════════════════════════════════════════════════

    ORACLE_MEILISEARCH_URL: str = Field(
        default="http://meilisearch:7700",
        description="Meilisearch URL for RAG keyword retrieval.",
    )
    ORACLE_MEILISEARCH_KEY: str = Field(
        default="",
        description="Meilisearch API key (optional).",
    )
    ORACLE_QDRANT_URL: str = Field(
        default="http://qdrant:6333",
        description="Qdrant URL for vector search.",
    )
    ORACLE_QDRANT_COLLECTION: str = Field(
        default="medical_documents",
        description="Qdrant collection name.",
    )
    ORACLE_EMBED_URL: str = Field(
        default="http://ollama:11434",
        description="Ollama endpoint for embedding generation (Qdrant).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CACHING
    # ══════════════════════════════════════════════════════════════════

    ORACLE_REDIS_URL: Optional[str] = Field(
        default=None,
        description="Optional Redis URL for response caching.",
    )
    ORACLE_CACHE_TTL: int = Field(
        default=300,
        description="Cache TTL in seconds for chat responses.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  RATE LIMITING
    # ══════════════════════════════════════════════════════════════════

    ORACLE_RATE_LIMIT: str = Field(
        default="100/minute",
        description="Rate limit for Oracle endpoints.",
    )
    ORACLE_STREAM_RATE_LIMIT: str = Field(
        default="60/minute",
        description="Rate limit for streaming endpoints.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  FEATURE FLAGS
    # ══════════════════════════════════════════════════════════════════

    ORACLE_ENABLE_M5: bool = Field(
        default=True,
        description="Enable M5 five-domain mode.",
    )
    ORACLE_ENABLE_TRIALS: bool = Field(
        default=True,
        description="Enable ClinicalTrials.gov integration.",
    )
    ORACLE_ENABLE_PUBMED: bool = Field(
        default=True,
        description="Enable PubMed integration.",
    )
    ORACLE_ENABLE_DOMAIN_INTELLIGENCE: bool = Field(
        default=True,
        description="Enable domain detection and expansion.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  TIMEOUTS
    # ══════════════════════════════════════════════════════════════════

    ORACLE_LLM_TIMEOUT: float = Field(
        default=120.0,
        description="Timeout for LLM chat completions.",
    )
    ORACLE_M5_TIMEOUT: float = Field(
        default=180.0,
        description="Timeout for M5 five-domain queries.",
    )
    ORACLE_STREAM_TIMEOUT: float = Field(
        default=60.0,
        description="Timeout for streaming responses.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  EXTERNAL SERVICE URLS
    # ══════════════════════════════════════════════════════════════════

    SEARXNG_URL: str = Field(
        default="http://searxng:8080",
        description="SearXNG URL for web search context.",
    )
    CLINICAL_TRIALS_URL: str = Field(
        default="https://clinicaltrials.gov/api",
        description="ClinicalTrials.gov API base URL.",
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
def get_oracle_settings() -> OracleSettings:
    """Get cached Oracle settings instance."""
    return OracleSettings()


def configure_logging(level: Optional[str] = None) -> None:
    """Configure logging for Oracle service."""
    settings = get_oracle_settings()
    log_level = (level or settings.LOG_LEVEL).upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
