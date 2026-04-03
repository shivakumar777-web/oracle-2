"""
Unit tests for services/shared/models.py.
"""
import pytest
from pydantic import ValidationError
from services.shared.models import (
    BaseResponse,
    ErrorDetail,
    HealthResponse,
    ResponseStatus,
    ServiceHealth,
)


class TestErrorDetail:
    """Tests for ErrorDetail."""

    def test_valid(self):
        e = ErrorDetail(code=404, message="Not found")
        assert e.code == 404
        assert e.message == "Not found"
        assert e.details is None

    def test_with_details(self):
        e = ErrorDetail(code=502, message="Bad gateway", details={"error": "timeout"})
        assert e.details["error"] == "timeout"


class TestBaseResponse:
    """Tests for BaseResponse."""

    def test_success(self):
        r = BaseResponse(status="success", service="test", data={"key": "value"}, request_id="abc")
        assert r.status == "success"
        assert r.data == {"key": "value"}
        assert r.error is None

    def test_error(self):
        r = BaseResponse(status="error", service="test", error={"code": 500, "message": "Fail"}, request_id="abc")
        assert r.status == "error"
        assert r.error is not None


class TestHealthResponse:
    """Tests for HealthResponse."""

    def test_valid(self):
        h = HealthResponse(status="healthy", service="test", details=None, request_id="rid")
        assert h.status == "healthy"
        assert h.service == "test"
