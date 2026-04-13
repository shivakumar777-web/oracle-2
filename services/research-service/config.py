"""
config.py — Research Service Configuration
===========================================
Deep research and plagiarism detection settings.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class ResearchSettings(BaseSettings):
    """Research service-specific settings for deep research and plagiarism."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ══════════════════════════════════════════════════════════════════
    #  SERVICE IDENTITY
    # ══════════════════════════════════════════════════════════════════

    SERVICE_NAME: str = Field(default="research-service")
    SERVICE_VERSION: str = Field(default="1.0.0")
    API_PREFIX: str = Field(default="/v1")

    # ══════════════════════════════════════════════════════════════════
    #  LLM CONFIGURATION (OpenRouter + optional Ollama)
    # ══════════════════════════════════════════════════════════════════

    OPENROUTER_API_KEY: str = Field(default="", description="OpenRouter API key.")
    OPENROUTER_API_KEY_2: str = Field(default="", description="Optional second OpenRouter key.")
    RESEARCH_OLLAMA_URL: str = Field(
        default="",
        description="Ollama base URL for synthesis fallback (e.g. http://ollama:11434).",
    )
    RESEARCH_OLLAMA_MODEL: str = Field(
        default="llama3.2",
        description="Ollama model name for /api/chat.",
    )
    RESEARCH_LLM_TIMEOUT: float = Field(
        default=120.0,
        description="Timeout for LLM research generation.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  VECTOR & SEARCH
    # ══════════════════════════════════════════════════════════════════

    RESEARCH_QDRANT_URL: Optional[str] = Field(
        default=None,
        description="Qdrant URL for document similarity.",
    )
    RESEARCH_QDRANT_COLLECTION: str = Field(
        default="medical_documents",
        description="Qdrant collection for research.",
    )
    RESEARCH_MEILISEARCH_URL: Optional[str] = Field(
        default=None,
        description="Meilisearch base URL (e.g. http://meilisearch:7700).",
    )
    RESEARCH_MEILISEARCH_KEY: str = Field(
        default="",
        description="Meilisearch API key (optional if protected).",
    )
    RESEARCH_EMBED_URL: Optional[str] = Field(
        default=None,
        description="Ollama or compatible embedding API (e.g. http://ollama:11434).",
    )
    RESEARCH_PERPLEXICA_URL: Optional[str] = Field(
        default=None,
        description="Perplexica base URL for web RAG (e.g. http://perplexica:3000).",
    )
    RESEARCH_NCBI_API_KEY: str = Field(
        default="",
        description="Optional NCBI API key for higher PubMed rate limits.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  PLAGIARISM SETTINGS
    # ══════════════════════════════════════════════════════════════════

    RESEARCH_PLAGIARISM_MODEL: str = Field(
        default="all-MiniLM-L6-v2",
        description="Sentence transformer model for embeddings.",
    )
    RESEARCH_PLAGIARISM_WEB_THRESHOLD: float = Field(
        default=0.72,
        description="Web overlap threshold for plagiarism detection.",
    )
    RESEARCH_PLAGIARISM_VECTOR_THRESHOLD: float = Field(
        default=0.70,
        description="Vector similarity threshold.",
    )
    RESEARCH_PLAGIARISM_QDRANT_THRESHOLD: float = Field(
        default=0.82,
        description="Min Qdrant score to flag corpus similarity in plagiarism.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CACHING
    # ══════════════════════════════════════════════════════════════════

    RESEARCH_REDIS_URL: Optional[str] = Field(
        default=None,
        description="Optional Redis URL for caching.",
    )
    RESEARCH_CACHE_TTL: int = Field(
        default=600,
        description="Cache TTL in seconds for research results.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  RATE LIMITING
    # ══════════════════════════════════════════════════════════════════

    RESEARCH_RATE_LIMIT: str = Field(
        default="60/minute",
        description="Rate limit for research endpoints.",
    )
    RESEARCH_PLAGIARISM_RATE_LIMIT: str = Field(
        default="60/minute",
        description="Rate limit for plagiarism endpoint.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  FEATURE FLAGS
    # ══════════════════════════════════════════════════════════════════

    RESEARCH_ENABLE_PLAGIARISM: bool = Field(
        default=True,
        description="Enable plagiarism checking.",
    )
    RESEARCH_ENABLE_ORIGINALITY: bool = Field(
        default=True,
        description="Enable originality analysis.",
    )
    RESEARCH_ENABLE_CITATIONS: bool = Field(
        default=True,
        description="Generate citations for research.",
    )
    RESEARCH_MAX_CITATIONS: int = Field(
        default=25,
        description="Maximum citations per research response.",
    )
    RESEARCH_MAX_SOURCES: int = Field(
        default=12,
        description="Maximum sources to search.",
    )

    RESEARCH_USE_LEGACY_RAG: bool = Field(
        default=False,  # Hybrid default; legacy is opt-in only
        description="If True, use Meilisearch/Qdrant/Perplexica/SearXNG legacy pipeline. If False, use GPT Researcher + SearXNG hybrid path.",
    )
    RESEARCH_HYBRID_MAX_STEPS: int = Field(
        default=0,
        description="If >0, overrides MAX_ITERATIONS for GPT Researcher (hybrid). 0 = derive from depth.",
    )
    RESEARCH_HYBRID_TIMEOUT_SECONDS: float = Field(
        default=0.0,
        description="If >0, hard cap for hybrid GR+graph wall time (seconds). 0 = use target_seconds/depth only.",
    )
    RESEARCH_GR_LLM: str = Field(
        default="openrouter:deepseek/deepseek-chat",
        description="GPT Researcher LLM string provider:model (e.g. openrouter:deepseek/deepseek-chat).",
    )
    RESEARCH_GR_EMBEDDING: str = Field(
        default="openrouter:openai/text-embedding-3-small",
        description="GPT Researcher EMBEDDING env value provider:model.",
    )
    RESEARCH_PLAGIARISM_USE_QDRANT: bool = Field(
        default=True,
        description="If False, plagiarism skips Qdrant corpus layer (web + vector self-similarity only).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  EXTERNAL SERVICES
    # ══════════════════════════════════════════════════════════════════

    SEARXNG_URL: str = Field(
        default="http://searxng:8080",
        description="SearXNG URL for web search in research (primary retriever).",
    )
    TAVILY_API_KEY: Optional[str] = Field(
        default=None,
        description="Tavily API key for fallback web search (higher quality, paid).",
    )
    TAVILY_ENABLED: bool = Field(
        default=False,
        description="Enable Tavily as fallback retriever when SearXNG fails.",
    )
    PERPLEXICA_URL: Optional[str] = Field(
        default=None,
        description="Legacy alias; prefer RESEARCH_PERPLEXICA_URL.",
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
    RESEARCH_DATABASE_URL: Optional[str] = Field(
        default=None,
        description="PostgreSQL URL for thread persistence (also reads DATABASE_URL).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  LOGGING
    # ══════════════════════════════════════════════════════════════════

    LOG_LEVEL: str = Field(
        default="INFO",
        description="Log level: DEBUG, INFO, WARNING, ERROR, CRITICAL.",
    )


@lru_cache
def get_research_settings() -> ResearchSettings:
    """Get cached Research settings instance."""
    return ResearchSettings()


def configure_logging(level: Optional[str] = None) -> None:
    """Configure logging for Research service."""
    settings = get_research_settings()
    log_level = (level or settings.LOG_LEVEL).upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
