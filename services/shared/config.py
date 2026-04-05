"""
config.py — Manthana Central Configuration
===========================================
Single source of truth for every URL, credential, timeout, and
behavioural flag across the entire Manthana platform.

All values are overridable via environment variables or a ``.env`` file.
Docker Compose service names are used as defaults so the platform works
out of the box in the standard deployment.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import List, Optional
from urllib.parse import urlparse

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Manthana platform-wide settings.

    Every field can be overridden by setting the corresponding
    environment variable (case-insensitive).  Defaults target the
    Docker Compose service names defined in ``docker-compose.yml``.
    """

    # ══════════════════════════════════════════════════════════════════
    #  INFRASTRUCTURE — search / vector / cache / LLM backends
    # ══════════════════════════════════════════════════════════════════

    # Ollama (LLM inference — main chat/query models)
    OLLAMA_URL: str = Field(
        default="http://litellm:4000",
        description="Ollama or LiteLLM proxy endpoint for chat completions.",
    )

    # Ollama embeddings (may differ from OLLAMA_URL when using LiteLLM proxy)
    EMBED_URL: str = Field(
        default="http://ollama:11434",
        description="Ollama endpoint used specifically for embedding generation.",
    )
    EMBEDDING_MODEL: str = Field(
        default="nomic-embed-text",
        description="Model name passed to Ollama /api/embeddings.",
    )

    # Qdrant (vector search)
    QDRANT_URL: str = Field(
        default="http://qdrant:6333",
        description="Qdrant REST API base URL.",
    )
    QDRANT_COLLECTION: str = Field(
        default="medical_documents",
        description="Default Qdrant collection for medical document vectors.",
    )

    # Meilisearch (full-text search)
    MEILISEARCH_URL: str = Field(
        default="http://meilisearch:7700",
        description="Meilisearch base URL.",
    )
    MEILISEARCH_KEY: str = Field(
        default="masterKey",
        description="Meilisearch master/admin API key.",
    )
    MEILISEARCH_API_KEY: str = Field(
        default="masterKey",
        description="Alias for MEILISEARCH_KEY — used by search route.",
    )

    # Perplexica (internal RAG search engine)
    PERPLEXICA_URL: str = Field(
        default="http://perplexica:3000",
        description="Perplexica internal search API.",
    )

    # SearXNG (meta-search engine)
    SEARXNG_URL: str = Field(
        default="http://searxng:8080",
        description="SearXNG meta-search engine URL.",
    )

    # Redis (caching + queues)
    REDIS_URL: str = Field(
        default="redis://redis:6379",
        description="Redis connection URL for search cache and queues.",
    )

    # Elasticsearch (used by orchestrator / legacy pipeline)
    ELASTICSEARCH_URL: str = Field(
        default="http://elasticsearch:9200",
        description="Elasticsearch REST endpoint.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CRAWLER BACKENDS (used by orchestrator.py)
    # ══════════════════════════════════════════════════════════════════

    FIRECRAWL_URL: str = Field(
        default="http://firecrawl-api:3002",
        description="Firecrawl API endpoint for on-demand web crawling.",
    )
    CRAWL4AI_URL: str = Field(
        default="http://crawl4ai:11235",
        description="Crawl4AI endpoint for intelligent web crawling.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  LLM SETTINGS (used by orchestrator / LiteLLM)
    # ══════════════════════════════════════════════════════════════════

    OPENROUTER_API_KEY: str = Field(
        default="",
        description="OpenRouter API key for cloud LLM (LiteLLM / orchestration).",
    )
    HF_TOKEN: str = Field(
        default="",
        description="Hugging Face token for model downloads.",
    )
    LITELLM_URL: str = Field(
        default="http://litellm:4000",
        description="LiteLLM proxy base URL.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  AI CLINICAL MICRO-SERVICE URLs
    #  Must match Docker Compose service names in docker-compose.yml.
    # ══════════════════════════════════════════════════════════════════

    ECG_URL: str = Field(
        default="http://ecg:8102",
        description="ECG micro-service (signal / image analysis).",
    )
    EYE_URL: str = Field(
        default="http://eye:8103",
        description="Eye micro-service (fundus / OCT analysis).",
    )
    CANCER_URL: str = Field(
        default="http://cancer:8104",
        description="Cancer micro-service (skin / oral lesion analysis).",
    )
    PATHOLOGY_URL: str = Field(
        default="http://pathology:8105",
        description="Pathology micro-service (WSI / tile analysis).",
    )
    BRAIN_URL: str = Field(
        default="http://brain:8106",
        description="Brain micro-service (MRI / EEG analysis).",
    )
    SEGMENTATION_URL: str = Field(
        default="http://segmentation:8107",
        description="Segmentation micro-service (organ / lesion segmentation).",
    )
    NLP_URL: str = Field(
        default="http://nlp:8108",
        description="NLP micro-service (QA / NER / summarisation / ICD coding).",
    )
    DRUG_URL: str = Field(
        default="http://drug:8109",
        description="Drug micro-service (SMILES / interaction / similarity).",
    )
    AYURVEDA_URL: str = Field(
        default="http://ayurveda:8110",
        description="Ayurveda micro-service (Prakriti / Vikriti / herb / formulation).",
    )
    IMAGING_URL: str = Field(
        default="http://imaging-utils:8111",
        description="Imaging utils micro-service (DICOM / NIfTI / metadata / preprocess).",
    )
    INDEXER_URL: str = Field(
        default="http://indexer:8112",
        description="Indexer micro-service (document embedding + indexing).",
    )

    # Legacy Manthana API (categories, icd10, report/pdf)
    MANTHANA_API_URL: str = Field(
        default="http://manthana-api:8001",
        description="Legacy api.py search/manthana-api service (port 8001).",
    )

    # ══════════════════════════════════════════════════════════════════
    #  APPLICATION SETTINGS
    # ══════════════════════════════════════════════════════════════════

    # Logging
    LOG_LEVEL: str = Field(
        default="INFO",
        description="Python log level: DEBUG, INFO, WARNING, ERROR, CRITICAL.",
    )

    # Uploads
    MAX_UPLOAD_MB: int = Field(
        default=50,
        ge=1,
        le=500,
        description="Maximum upload file size in megabytes.",
    )

    # LLM model names
    MEDITRON_MODEL: str = Field(
        default="meditron",
        description="Ollama model name for Oracle / Deep Research answers.",
    )
    SUMMARY_MODEL: str = Field(
        default="llama3.2",
        description="Ollama model name for summaries / lighter tasks.",
    )
    GROQ_MODEL: str = Field(
        default="llama-3.3-70b-versatile",
        description="Deprecated; unused. Cloud LLM is OpenRouter — models in config/cloud_inference.yaml.",
    )

    # Device
    DEVICE: str = Field(
        default="cpu",
        description="PyTorch device for clinical micro-services (cpu / cuda / mps).",
    )
    ENABLE_GPU: bool = Field(
        default=False,
        description="Enable GPU acceleration across clinical services.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  TIMEOUTS & LIMITS
    # ══════════════════════════════════════════════════════════════════

    HTTP_TIMEOUT: float = Field(
        default=20.0,
        description="Default HTTP client timeout in seconds.",
    )
    CLINICAL_SERVICE_TIMEOUT: float = Field(
        default=60.0,
        description="Timeout for forwarding files to clinical micro-services.",
    )
    EMBEDDING_TIMEOUT: float = Field(
        default=15.0,
        description="Timeout for embedding generation calls.",
    )
    LLM_TIMEOUT: float = Field(
        default=120.0,
        description="Timeout for LLM chat completions.",
    )
    SEARXNG_TIMEOUT: float = Field(
        default=8.0,
        description="Timeout for SearXNG search requests.",
    )
    SEARCH_CACHE_TTL: int = Field(
        default=300,
        ge=0,
        description="Redis cache TTL for search results in seconds.",
    )

    # Rate limiting
    DEFAULT_RATE_LIMIT: str = Field(
        default="100/minute",
        description="Default rate limit for API endpoints.",
    )
    SEARCH_RATE_LIMIT: str = Field(
        default="200/minute",
        description="Rate limit for the /search endpoint.",
    )

    # Circuit breaker
    CB_FAILURE_THRESHOLD: int = Field(
        default=3,
        ge=1,
        description="Number of failures before circuit opens.",
    )
    CB_RESET_TIMEOUT: int = Field(
        default=60,
        ge=5,
        description="Seconds before open circuit transitions to half-open.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  CORS
    # ══════════════════════════════════════════════════════════════════

    FRONTEND_URL: str = Field(
        default="http://localhost:3001",
        description="Primary frontend origin for CORS (set in .env for production).",
    )

    # Auth (Better Auth JWT)
    BETTER_AUTH_URL: str = Field(
        default="http://localhost:3001",
        description="Frontend URL where Better Auth runs (JWKS at {url}/api/auth/jwks).",
    )
    # When True, protected routes require JWT; when False, auth is optional (MVP mode)
    REQUIRE_AUTH: bool = Field(
        default=False,
        description="Require JWT on protected routes. Set REQUIRE_AUTH=true for production.",
    )
    EXTRA_CORS_ORIGINS: str = Field(
        default="",
        description=(
            "Comma-separated additional CORS origins "
            "(e.g. 'https://manthana.ai,https://staging.manthana.ai')."
        ),
    )

    # ══════════════════════════════════════════════════════════════════
    #  OBSERVABILITY
    # ══════════════════════════════════════════════════════════════════

    PROMETHEUS_URL: str = Field(
        default="http://prometheus:9090",
        description="Prometheus query endpoint.",
    )
    GRAFANA_URL: str = Field(
        default="http://grafana:3000",
        description="Grafana dashboard URL.",
    )
    LOKI_URL: str = Field(
        default="http://loki:3100",
        description="Loki log aggregation push endpoint.",
    )

    # ──────────────────────────────────────────────────────────────────
    #  Validators
    # ──────────────────────────────────────────────────────────────────

    @field_validator("LOG_LEVEL")
    @classmethod
    def _normalise_log_level(cls, v: str) -> str:
        v = v.upper().strip()
        if v not in ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"):
            return "INFO"
        return v

    @field_validator("DEVICE")
    @classmethod
    def _normalise_device(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in ("cpu", "cuda", "mps"):
            return "cpu"
        return v

    @model_validator(mode="after")
    def _validate_meilisearch_key(self) -> "Settings":
        """Log CRITICAL if Meilisearch uses default key in production-like env."""
        key = (self.MEILISEARCH_KEY or self.MEILISEARCH_API_KEY or "").strip()
        if not key or key == "masterKey":
            host = urlparse(self.MEILISEARCH_URL).hostname or ""
            is_local = host in ("localhost", "127.0.0.1", "::1", "meilisearch", "")
            if not is_local:
                logging.getLogger("manthana.config").critical(
                    "MEILISEARCH_KEY is empty or 'masterKey' but MEILISEARCH_URL=%s "
                    "appears to be a non-localhost endpoint. Set MEILI_MASTER_KEY to a "
                    "strong random value in production. See DEPLOYMENT_CHECKLIST.md",
                    self.MEILISEARCH_URL,
                )
            else:
                logging.getLogger("manthana.config").warning(
                    "MEILISEARCH_KEY is default 'masterKey'. For production, set "
                    "MEILI_MASTER_KEY in .env. See DEPLOYMENT_CHECKLIST.md",
                )
        return self

    # ──────────────────────────────────────────────────────────────────
    #  Computed helpers
    # ──────────────────────────────────────────────────────────────────

    @property
    def cors_origins(self) -> List[str]:
        """Return the full list of allowed CORS origins."""
        origins = [
            self.FRONTEND_URL,
            "http://localhost:3000",
            "http://localhost:3001",
        ]
        if self.EXTRA_CORS_ORIGINS:
            extras = [
                o.strip()
                for o in self.EXTRA_CORS_ORIGINS.split(",")
                if o.strip()
            ]
            origins.extend(extras)
        # Deduplicate while preserving order
        seen: set[str] = set()
        unique: List[str] = []
        for o in origins:
            if o not in seen:
                seen.add(o)
                unique.append(o)
        return unique

    @property
    def max_upload_bytes(self) -> int:
        """MAX_UPLOAD_MB converted to bytes for convenience."""
        return self.MAX_UPLOAD_MB * 1024 * 1024

    # ──────────────────────────────────────────────────────────────────
    #  Pydantic v2 model config
    # ──────────────────────────────────────────────────────────────────

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    """Return the cached singleton Settings instance.

    Because of ``@lru_cache`` the ``.env`` file and environment are read
    only once per process.  Restart the process (or clear the cache with
    ``get_settings.cache_clear()``) to pick up changes.
    """
    return Settings()
