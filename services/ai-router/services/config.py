from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── Infrastructure ───────────────────────────────────────
    OLLAMA_URL: str = "http://litellm:4000"
    EMBED_URL: str = "http://ollama:11434"
    QDRANT_URL: str = "http://qdrant:6333"
    MEILISEARCH_URL: str = "http://meilisearch:7700"
    MEILISEARCH_KEY: str = "masterKey"
    MEILISEARCH_API_KEY: str = "masterKey"   # alias for search route
    PERPLEXICA_URL: str = "http://perplexica:3000"
    SEARXNG_URL: str = "http://searxng:8080"
    REDIS_URL: str = "redis://redis:6379"

    # ── AI Microservice URLs ─────────────────────────────────
    # These MUST match the Docker service names in docker-compose.yml
    ECG_URL: str = "http://ecg:8102"
    EYE_URL: str = "http://eye:8103"
    CANCER_URL: str = "http://cancer:8104"
    PATHOLOGY_URL: str = "http://pathology:8105"
    BRAIN_URL: str = "http://brain:8106"
    SEGMENTATION_URL: str = "http://segmentation:8107"
    NLP_URL: str = "http://nlp:8108"
    DRUG_URL: str = "http://drug:8109"
    AYURVEDA_URL: str = "http://ayurveda:8110"
    IMAGING_URL: str = "http://imaging-utils:8111"
    INDEXER_URL: str = "http://indexer:8112"

    # ── App Settings ─────────────────────────────────────────
    LOG_LEVEL: str = "INFO"
    MAX_UPLOAD_MB: int = 50
    MEDITRON_MODEL: str = "meditron"
    SUMMARY_MODEL: str = "llama3.2"
    DEVICE: str = "cpu"
    ENABLE_GPU: bool = False

    # ── CORS ─────────────────────────────────────────────────
    # Set FRONTEND_URL in .env for production (e.g. https://manthana.ai)
    FRONTEND_URL: str = "http://localhost:3001"

    # ── Auth (Better Auth JWT) ─────────────────────────────────
    # URL of the frontend where Better Auth runs (for JWKS: {BETTER_AUTH_URL}/api/auth/jwks)
    BETTER_AUTH_URL: str = "http://localhost:3001"

    # ── OpenRouter (cloud LLM; models from repo config/cloud_inference.yaml) ──
    OPENROUTER_API_KEY: str = ""
    OPENROUTER_API_KEY_2: str = ""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


@lru_cache()
def get_settings() -> Settings:
    return Settings()


