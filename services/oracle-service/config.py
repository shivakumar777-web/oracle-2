"""
config.py — Oracle Service Configuration
============================================
Oracle-specific settings for chat, M5, query intelligence, and domain handling.
Falls back to shared settings where appropriate for gradual migration.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Literal, Optional

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
    #  LLM CONFIGURATION (OpenRouter — models in config/cloud_inference.yaml)
    # ══════════════════════════════════════════════════════════════════

    OPENROUTER_API_KEY: str = Field(
        default="",
        description="OpenRouter API key (also read from process env).",
    )
    OPENROUTER_API_KEY_2: str = Field(
        default="",
        description="Optional second OpenRouter key for rate-limit rotation.",
    )
    ORACLE_OPENROUTER_API_KEY: str = Field(
        default="",
        description="Oracle-prefixed OpenRouter key (same as OPENROUTER_API_KEY if you prefer ORACLE_* in compose).",
    )
    ORACLE_OPENROUTER_API_KEY_2: str = Field(
        default="",
        description="Optional second Oracle OpenRouter key for rotation.",
    )
    ORACLE_OPENROUTER_BASE_URL: str = Field(
        default="",
        description="Override OpenRouter base URL; empty uses config/cloud_inference.yaml.",
    )
    ORACLE_OPENROUTER_MODEL: str = Field(
        default="",
        description="Override model for oracle_chat role; empty uses cloud_inference.yaml.",
    )
    ORACLE_OPENROUTER_MODEL_M5: str = Field(
        default="",
        description="Override model for oracle_m5 role; empty uses cloud_inference.yaml or ORACLE_OPENROUTER_MODEL.",
    )
    ORACLE_LLM_PROVIDER: Literal["openrouter"] = Field(
        default="openrouter",
        description="Oracle chat/M5 use OpenRouter only. (Legacy groq is not supported; do not set.)",
    )
    ORACLE_USE_FREE_MODELS: bool = Field(
        default=False,
        description="When true, use openrouter/free smart router as primary with free model fallbacks. Premium Kimi K2.5 is final fallback. For testing/cost-saving only.",
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
    ORACLE_USE_RAG: bool = Field(
        default=False,
        description="When true, run Meili/Qdrant/embeddings/SearXNG/PubMed/trials for chat/M5.",
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
