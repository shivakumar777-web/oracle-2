"""
Unit tests for orchestrator.py — pure functions and helpers.
"""
import pytest
from orchestrator import doc_id, query_is_complex, _qdrant_point_id


class TestDocId:
    """Tests for doc_id."""

    def test_deterministic(self):
        assert doc_id("https://example.com/page") == doc_id("https://example.com/page")

    def test_different_urls_different_ids(self):
        assert doc_id("https://a.com") != doc_id("https://b.com")

    def test_returns_hex_string(self):
        out = doc_id("https://pubmed.ncbi.nlm.nih.gov/123")
        assert len(out) == 32
        assert all(c in "0123456789abcdef" for c in out)


class TestQueryIsComplex:
    """Tests for query_is_complex."""

    def test_simple_short(self):
        assert query_is_complex("diabetes") is False
        assert query_is_complex("cold") is False

    def test_long_query(self):
        assert query_is_complex("what is the treatment for type 2 diabetes") is True

    def test_complex_keywords(self):
        assert query_is_complex("dosage") is True
        assert query_is_complex("side effect of metformin") is True
        assert query_is_complex("drug interaction") is True
        assert query_is_complex("treatment plan") is True
        assert query_is_complex("differential diagnosis") is True

    def test_mixed(self):
        assert query_is_complex("diabetes vs hypertension") is True


class TestQdrantPointId:
    """Tests for _qdrant_point_id."""

    def test_deterministic(self):
        assert _qdrant_point_id("https://a.com") == _qdrant_point_id("https://a.com")

    def test_positive_integer(self):
        out = _qdrant_point_id("https://example.com/page")
        assert isinstance(out, int)
        assert out >= 0

    def test_different_urls_different_ids(self):
        assert _qdrant_point_id("https://a.com") != _qdrant_point_id("https://b.com")
