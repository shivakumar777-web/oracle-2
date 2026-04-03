"""
Unit tests for services/shared/search_utils.py.
"""
import pytest
import respx
from httpx import Response as HttpxResponse
from unittest.mock import AsyncMock

from services.shared.search_utils import (
    _make_cache_key,
    deduplicate_results,
    detect_result_type,
    enrich_result,
    extract_domain,
    fetch_searxng,
    generate_related_questions,
    get_trust_score,
    PEER_REVIEWED_DOMAINS,
    sort_by_trust,
    search_own_index_async,
    TRUST_SCORES,
)


class TestExtractDomain:
    """Tests for extract_domain."""

    def test_standard_url(self):
        assert extract_domain("https://www.pubmed.ncbi.nlm.nih.gov/article/123") == "pubmed.ncbi.nlm.nih.gov"
        assert extract_domain("http://who.int/guidelines") == "who.int"

    def test_strips_www(self):
        assert extract_domain("https://www.example.com/path") == "example.com"

    def test_empty_invalid(self):
        assert extract_domain("") == ""
        assert extract_domain("not-a-url") == ""


class TestGetTrustScore:
    """Tests for get_trust_score."""

    def test_exact_match(self):
        assert get_trust_score("https://pubmed.ncbi.nlm.nih.gov/123") == 99
        assert get_trust_score("https://who.int/guidelines") == 97

    def test_suffix_match(self):
        # pmc.ncbi.nlm.nih.gov should match ncbi.nlm.nih.gov
        score = get_trust_score("https://pmc.ncbi.nlm.nih.gov/article/1")
        assert score >= 90

    def test_gov_in_floor(self):
        score = get_trust_score("https://unknown.gov.in/page")
        assert score >= 80

    def test_ac_in_floor(self):
        score = get_trust_score("https://college.ac.in/page")
        assert score >= 75

    def test_default_unknown(self):
        score = get_trust_score("https://random-blog.com/post")
        assert score == 45


class TestDetectResultType:
    """Tests for detect_result_type."""

    def test_video(self):
        assert detect_result_type("https://youtube.com/watch?v=123", {}) == "video"
        assert detect_result_type("https://vimeo.com/123", {}) == "video"

    def test_pdf(self):
        assert detect_result_type("https://example.com/paper.pdf", {}) == "pdf"

    def test_trial(self):
        assert detect_result_type("https://clinicaltrials.gov/study/123", {}) == "trial"
        assert detect_result_type("https://ctri.nic.in/trial/1", {}) == "trial"

    def test_guideline(self):
        assert detect_result_type("https://who.int/guideline/covid", {}) == "guideline"

    def test_preprint(self):
        assert detect_result_type("https://biorxiv.org/content/123", {}) == "preprint"
        assert detect_result_type("https://medrxiv.org/content/456", {}) == "preprint"

    def test_article_default(self):
        assert detect_result_type("https://example.com/article", {}) == "article"


class TestEnrichResult:
    """Tests for enrich_result."""

    def test_enriches_pubmed(self):
        raw = {"url": "https://pubmed.ncbi.nlm.nih.gov/123", "title": "Study", "content": "Abstract"}
        out = enrich_result(raw, "medical")
        assert out["trustScore"] == 99
        assert out["source"] == "PubMed"
        assert out["isPeerReviewed"] is True
        assert out["type"] == "article"

    def test_enriches_who(self):
        raw = {"url": "https://who.int/guidelines", "title": "WHO", "content": "Text"}
        out = enrich_result(raw, "medical")
        assert out["isOfficial"] is True
        assert out["source"] == "WHO"


class TestDeduplicateResults:
    """Tests for deduplicate_results."""

    def test_removes_duplicate_urls(self):
        results = [
            {"url": "https://a.com/1", "title": "First", "trustScore": 80},
            {"url": "https://a.com/1", "title": "First copy", "trustScore": 70},
        ]
        out = deduplicate_results(results)
        assert len(out) == 1
        assert out[0]["trustScore"] == 80

    def test_removes_near_identical_titles(self):
        results = [
            {"url": "https://a.com/1", "title": "Diabetes treatment guidelines 2024", "trustScore": 80},
            {"url": "https://b.com/2", "title": "Diabetes treatment guidelines 2024", "trustScore": 70},
        ]
        out = deduplicate_results(results)
        assert len(out) == 1

    def test_preserves_unique(self):
        results = [
            {"url": "https://a.com/1", "title": "A", "trustScore": 80},
            {"url": "https://b.com/2", "title": "B", "trustScore": 70},
        ]
        out = deduplicate_results(results)
        assert len(out) == 2


class TestSortByTrust:
    """Tests for sort_by_trust."""

    def test_sorts_by_composite(self):
        results = [
            {"url": "https://blog.com/1", "trustScore": 50, "isOfficial": False, "isPeerReviewed": False, "type": "article", "isOpenAccess": False},
            {"url": "https://who.int/1", "trustScore": 97, "isOfficial": True, "isPeerReviewed": False, "type": "article", "isOpenAccess": False},
        ]
        out = sort_by_trust(results)
        assert out[0]["url"] == "https://who.int/1"


class TestGenerateRelatedQuestions:
    """Tests for generate_related_questions."""

    def test_returns_list(self):
        out = generate_related_questions("diabetes", [], count=3)
        assert isinstance(out, list)
        assert len(out) <= 3
        for q in out:
            assert "diabetes" in q.lower()

    def test_deterministic(self):
        out1 = generate_related_questions("hypertension", [], count=2)
        out2 = generate_related_questions("hypertension", [], count=2)
        assert out1 == out2


class TestMakeCacheKey:
    """Tests for _make_cache_key."""

    def test_deterministic(self):
        k1 = _make_cache_key("diabetes", "medical", 1)
        k2 = _make_cache_key("diabetes", "medical", 1)
        assert k1 == k2

    def test_format(self):
        k = _make_cache_key("query", "medical", 2)
        assert k.startswith("searxng:")
        assert len(k) > 20

    def test_different_inputs_different_keys(self):
        k1 = _make_cache_key("a", "medical", 1)
        k2 = _make_cache_key("b", "medical", 1)
        assert k1 != k2


class TestSortByTrustEdgeCases:
    """Edge cases for sort_by_trust."""

    def test_empty_list(self):
        assert sort_by_trust([]) == []

    def test_single_element(self):
        r = [{"url": "https://a.com", "trustScore": 50, "isOfficial": False, "isPeerReviewed": False, "type": "article", "isOpenAccess": False}]
        assert sort_by_trust(r) == r


class TestDeduplicateEdgeCases:
    """Edge cases for deduplicate_results."""

    def test_empty(self):
        assert deduplicate_results([]) == []

    def test_all_duplicates(self):
        r = [
            {"url": "https://a.com", "title": "Same", "trustScore": 80},
            {"url": "https://a.com", "title": "Same", "trustScore": 70},
        ]
        out = deduplicate_results(r)
        assert len(out) == 1


# ── Async: fetch_searxng ───────────────────────────────────────────────
class TestFetchSearxng:
    """Tests for fetch_searxng with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_fetch_searxng_success(self, respx_mock):
        respx_mock.get("http://searxng.test/search").mock(
            return_value=HttpxResponse(
                200,
                json={"results": [{"url": "https://a.com", "title": "A"}], "number_of_results": 1},
            )
        )
        data = await fetch_searxng("diabetes", "medical", searxng_url="http://searxng.test")
        assert data["number_of_results"] == 1
        assert len(data["results"]) == 1
        assert data["results"][0]["title"] == "A"

    @pytest.mark.asyncio
    async def test_fetch_searxng_empty_on_failure(self, respx_mock):
        respx_mock.get("http://searxng.test/search").mock(
            return_value=HttpxResponse(500)
        )
        data = await fetch_searxng("diabetes", "medical", searxng_url="http://searxng.test")
        assert data == {"results": [], "number_of_results": 0}

    @pytest.mark.asyncio
    async def test_fetch_searxng_redis_cache_hit(self, respx_mock):
        import json
        cached = {"results": [{"url": "https://cached.com", "title": "Cached"}], "number_of_results": 1}
        redis = AsyncMock()
        redis.get = AsyncMock(return_value=json.dumps(cached))
        redis.setex = AsyncMock(return_value=None)
        data = await fetch_searxng("diabetes", "medical", searxng_url="http://searxng.test", redis_client=redis)
        assert data["results"][0]["title"] == "Cached"
        assert not respx_mock.calls  # No HTTP when cache hits


# ── Async: search_own_index_async ──────────────────────────────────────
class TestSearchOwnIndexAsync:
    """Tests for search_own_index_async with mocked HTTP."""

    @pytest.mark.asyncio
    async def test_search_own_index_success(self, respx_mock):
        respx_mock.post("http://meili.test/indexes/medical_search/search").mock(
            return_value=HttpxResponse(
                200,
                json={"hits": [{"title": "Doc A", "content": "Content A"}]},
            )
        )
        hits = await search_own_index_async(
            "diabetes",
            "medical",
            meilisearch_url="http://meili.test",
            meilisearch_key="test-key",
        )
        assert len(hits) == 1
        assert hits[0]["title"] == "Doc A"

    @pytest.mark.asyncio
    async def test_search_own_index_empty_on_failure(self, respx_mock):
        respx_mock.post("http://meili.test/indexes/medical_search/search").mock(
            return_value=HttpxResponse(500)
        )
        hits = await search_own_index_async(
            "diabetes",
            "medical",
            meilisearch_url="http://meili.test",
        )
        assert hits == []

    @pytest.mark.asyncio
    async def test_search_own_index_empty_on_exception(self, respx_mock):
        respx_mock.post("http://meili.test/indexes/medical_search/search").mock(
            side_effect=Exception("network error")
        )
        hits = await search_own_index_async(
            "diabetes",
            "medical",
            meilisearch_url="http://meili.test",
        )
        assert hits == []
