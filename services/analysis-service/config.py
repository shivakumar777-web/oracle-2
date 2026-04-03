"""
config.py — Analysis Service Configuration
===========================================
Image analysis gateway settings for routing to clinical microservices.
"""

from __future__ import annotations

import logging
from functools import lru_cache
from typing import Optional

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class AnalysisSettings(BaseSettings):
    """Analysis service-specific settings for image analysis gateway."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # ══════════════════════════════════════════════════════════════════
    #  SERVICE IDENTITY
    # ══════════════════════════════════════════════════════════════════

    SERVICE_NAME: str = Field(default="analysis-service")
    SERVICE_VERSION: str = Field(default="1.0.0")
    API_PREFIX: str = Field(default="/v1")

    # ══════════════════════════════════════════════════════════════════
    #  CLINICAL MICROSERVICE URLS
    # ══════════════════════════════════════════════════════════════════

    ECG_URL: str = Field(
        default="http://ecg:8102",
        description="ECG service for signal analysis.",
    )
    EYE_URL: str = Field(
        default="http://eye:8103",
        description="Eye service for fundus/OCT analysis.",
    )
    CANCER_URL: str = Field(
        default="http://cancer:8104",
        description="Cancer service for lesion analysis.",
    )
    PATHOLOGY_URL: str = Field(
        default="http://pathology:8105",
        description="Pathology service for WSI analysis.",
    )
    BRAIN_URL: str = Field(
        default="http://brain:8106",
        description="Brain service for MRI/EEG analysis.",
    )
    SEGMENTATION_URL: str = Field(
        default="http://segmentation:8107",
        description="Segmentation service for organ/lesion segmentation.",
    )
    NLP_URL: str = Field(
        default="http://nlp:8108",
        description="NLP service for text analysis.",
    )
    IMAGING_URL: str = Field(
        default="http://imaging-utils:8111",
        description="Imaging utils for DICOM/NIfTI preprocessing.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  ANALYSIS SETTINGS
    # ══════════════════════════════════════════════════════════════════

    ANALYSIS_TIMEOUT: float = Field(
        default=60.0,
        description="Timeout for analysis requests to clinical services.",
    )
    ANALYSIS_MAX_FILE_SIZE_MB: int = Field(
        default=50,
        description="Maximum file upload size in MB.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  RATE LIMITING
    # ══════════════════════════════════════════════════════════════════

    ANALYSIS_RATE_LIMIT: str = Field(
        default="100/minute",
        description="Rate limit for analysis endpoints.",
    )
    ANALYSIS_STREAM_RATE_LIMIT: str = Field(
        default="60/minute",
        description="Rate limit for streaming analysis.",
    )

    # ══════════════════════════════════════════════════════════════════
    #  FEATURE FLAGS
    # ══════════════════════════════════════════════════════════════════

    ANALYSIS_ENABLE_HEATMAP: bool = Field(
        default=True,
        description="Enable Grad-CAM heatmap generation.",
    )
    ANALYSIS_ENABLE_ENRICHMENT: bool = Field(
        default=True,
        description="Enable report enrichment with ICD-10/RadLex.",
    )
    ANALYSIS_ENABLE_ROUTING: bool = Field(
        default=True,
        description="Enable auto-routing based on file type.",
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
def get_analysis_settings() -> AnalysisSettings:
    """Get cached Analysis settings instance."""
    return AnalysisSettings()


def configure_logging(level: Optional[str] = None) -> None:
    """Configure logging for Analysis service."""
    settings = get_analysis_settings()
    log_level = (level or settings.LOG_LEVEL).upper()
    logging.basicConfig(
        level=getattr(logging, log_level, logging.INFO),
        format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
