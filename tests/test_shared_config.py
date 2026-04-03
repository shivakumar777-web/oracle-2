"""
Unit tests for services/shared/config.py.
"""
import pytest
from services.shared.config import Settings, get_settings


class TestSettings:
    """Tests for Settings."""

    def test_defaults(self):
        settings = Settings()
        assert settings.OLLAMA_URL
        assert settings.SEARXNG_URL
        assert settings.MEILISEARCH_URL

    def test_log_level_validator(self):
        settings = Settings(LOG_LEVEL="debug")
        assert settings.LOG_LEVEL == "DEBUG"
        settings2 = Settings(LOG_LEVEL="invalid")
        assert settings2.LOG_LEVEL == "INFO"

    def test_device_validator(self):
        settings = Settings(DEVICE="cuda")
        assert settings.DEVICE == "cuda"
        settings2 = Settings(DEVICE="invalid")
        assert settings2.DEVICE == "cpu"


class TestGetSettings:
    """Tests for get_settings."""

    def test_returns_settings_instance(self):
        s = get_settings()
        assert isinstance(s, Settings)

    def test_cached(self):
        s1 = get_settings()
        s2 = get_settings()
        assert s1 is s2
