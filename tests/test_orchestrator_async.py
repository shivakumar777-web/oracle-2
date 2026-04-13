"""
Unit tests for orchestrator.py — async functions with mocked HTTP.
"""
import os
import re
import pytest
import respx
from unittest.mock import patch, AsyncMock, MagicMock
import httpx

from orchestrator import (
    safe_post,
    safe_get,
    search_web,
    crawl_fast,
    crawl_deep,
    extract,
    close_client,
    init_indexes,
    index_elasticsearch,
    index_qdrant,
    index_meilisearch,
    index_all,
    get_embedding,
    search_own_index,
    synthesize,
    manthana_search,
)


@pytest.fixture(autouse=True)
def reset_client():
    """Ensure clean client state between tests."""
    import orchestrator as orch
    yield
    orch._client = None


@pytest.mark.asyncio
async def test_safe_get_success(respx_mock):
    respx_mock.get("https://example.com/api").mock(return_value=httpx.Response(200, json={"key": "value"}))
    result = await safe_get("https://example.com/api")
    assert result == {"key": "value"}


@pytest.mark.asyncio
async def test_safe_get_failure_returns_empty(respx_mock):
    respx_mock.get("https://example.com/fail").mock(return_value=httpx.Response(500))
    result = await safe_get("https://example.com/fail")
    assert result == {}


@pytest.mark.asyncio
async def test_safe_post_success(respx_mock):
    respx_mock.post("https://example.com/api").mock(return_value=httpx.Response(200, json={"ok": True}))
    result = await safe_post("https://example.com/api", {"data": "x"})
    assert result == {"ok": True}


@pytest.mark.asyncio
async def test_safe_post_failure_returns_empty(respx_mock):
    respx_mock.post("https://example.com/fail").mock(return_value=httpx.Response(404))
    result = await safe_post("https://example.com/fail", {})
    assert result == {}


@pytest.mark.asyncio
async def test_search_web(respx_mock):
    with patch("orchestrator.SEARXNG", "https://searxng.test"):
        respx_mock.get("https://searxng.test/search").mock(
            return_value=httpx.Response(200, json={"results": [{"title": "A", "url": "https://a.com"}]})
        )
        results = await search_web("diabetes", "medical")
        assert len(results) == 1
        assert results[0]["title"] == "A"


@pytest.mark.asyncio
async def test_crawl_fast(respx_mock):
    with patch("orchestrator.CRAWL4AI", "https://crawl4ai.test"):
        respx_mock.post("https://crawl4ai.test/crawl").mock(
            return_value=httpx.Response(200, json={"results": [{"markdown": "# Content"}]})
        )
        content = await crawl_fast("https://example.com/page")
        assert content == "# Content"


@pytest.mark.asyncio
async def test_crawl_deep(respx_mock):
    with patch("orchestrator.FIRECRAWL", "https://firecrawl.test"):
        respx_mock.post("https://firecrawl.test/v1/scrape").mock(
            return_value=httpx.Response(200, json={"data": {"markdown": "## Deep content"}})
        )
        content = await crawl_deep("https://example.com/page")
        assert "Deep content" in content


@pytest.mark.asyncio
async def test_extract_uses_crawl_fast(respx_mock):
    long_content = "x" * 150
    with patch("orchestrator.CRAWL4AI", "https://crawl4ai.test"):
        respx_mock.post("https://crawl4ai.test/crawl").mock(
            return_value=httpx.Response(200, json={"results": [{"markdown": long_content}]})
        )
        content = await extract("https://example.com", deep=False)
        assert content == long_content


@pytest.mark.asyncio
async def test_close_client():
    await close_client()
    # Should not raise


# ── Index functions ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_index_elasticsearch(respx_mock):
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        respx_mock.route(
            method="PUT",
            url__regex=r"http://es\.test/manthana-medical/_doc/[a-f0-9]+",
        ).mock(return_value=httpx.Response(200))
        await index_elasticsearch("https://a.com", "content here", "Title")
        assert respx_mock.calls


@pytest.mark.asyncio
async def test_index_elasticsearch_failure(respx_mock):
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        respx_mock.route(
            method="PUT",
            url__regex=r"http://es\.test/manthana-medical/_doc/[a-f0-9]+",
        ).mock(return_value=httpx.Response(500))
        await index_elasticsearch("https://a.com", "content", "Title")
        # Should not raise


@pytest.mark.asyncio
async def test_get_embedding(respx_mock):
    with patch("orchestrator.OLLAMA", "http://ollama.test"):
        respx_mock.post("http://ollama.test/api/embeddings").mock(
            return_value=httpx.Response(200, json={"embedding": [0.1] * 768})
        )
        vec = await get_embedding("test text")
        assert len(vec) == 768


@pytest.mark.asyncio
async def test_get_embedding_empty_on_failure(respx_mock):
    with patch("orchestrator.OLLAMA", "http://ollama.test"):
        respx_mock.post("http://ollama.test/api/embeddings").mock(
            return_value=httpx.Response(500)
        )
        vec = await get_embedding("test")
        assert vec == []


@pytest.mark.asyncio
async def test_index_qdrant(respx_mock):
    with patch("orchestrator.OLLAMA", "http://ollama.test"):
        with patch("orchestrator.QDRANT", "http://qdrant.test"):
            respx_mock.post("http://ollama.test/api/embeddings").mock(
                return_value=httpx.Response(200, json={"embedding": [0.1] * 768})
            )
            respx_mock.post("http://qdrant.test/collections/medical_documents/points").mock(
                return_value=httpx.Response(200)
            )
            await index_qdrant("https://a.com", "content " * 100, "Title")
            assert respx_mock.calls


@pytest.mark.asyncio
async def test_index_meilisearch(respx_mock):
    with patch("orchestrator.MEILISEARCH", "http://meili.test"):
        respx_mock.post("http://meili.test/indexes/medical_search/documents").mock(
            return_value=httpx.Response(202)
        )
        await index_meilisearch("https://a.com", "content here", "Title")
        assert respx_mock.calls


@pytest.mark.asyncio
async def test_index_all_skips_short_content(respx_mock):
    await index_all("https://a.com", "short")  # < MIN_CONTENT_LEN
    assert not respx_mock.calls


@pytest.mark.asyncio
async def test_index_all(respx_mock):
    content = "x" * 100
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        with patch("orchestrator.OLLAMA", "http://ollama.test"):
            with patch("orchestrator.QDRANT", "http://qdrant.test"):
                with patch("orchestrator.MEILISEARCH", "http://meili.test"):
                    respx_mock.route(
                        method="PUT",
                        url__regex=r"http://es\.test/manthana-medical/_doc/[a-f0-9]+",
                    ).mock(return_value=httpx.Response(200))
                    respx_mock.post("http://ollama.test/api/embeddings").mock(
                        return_value=httpx.Response(200, json={"embedding": [0.1] * 768})
                    )
                    respx_mock.post("http://qdrant.test/collections/medical_documents/points").mock(
                        return_value=httpx.Response(200)
                    )
                    respx_mock.post("http://meili.test/indexes/medical_search/documents").mock(
                        return_value=httpx.Response(202)
                    )
                    await index_all("https://a.com", content, "Title", "searxng")
                    assert len(respx_mock.calls) >= 3


# ── search_own_index ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_search_own_index(respx_mock):
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        respx_mock.post("http://es.test/manthana-medical/_search").mock(
            return_value=httpx.Response(200, json={
                "hits": {
                    "hits": [
                        {"_source": {"url": "https://a.com", "title": "A", "content": "Content A"}},
                        {"_source": {"url": "https://b.com", "title": "B", "content": "Content B"}},
                    ]
                }
            })
        )
        hits = await search_own_index("diabetes")
        assert len(hits) == 2
        assert hits[0]["_source"]["url"] == "https://a.com"


@pytest.mark.asyncio
async def test_search_own_index_failure_returns_empty(respx_mock):
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        respx_mock.post("http://es.test/manthana-medical/_search").mock(
            return_value=httpx.Response(500)
        )
        hits = await search_own_index("diabetes")
        assert hits == []


# ── synthesize ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_synthesize_mocked_groq(monkeypatch):
    monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-for-synthesize")
    monkeypatch.setenv(
        "CLOUD_INFERENCE_CONFIG_PATH",
        os.path.abspath(
            os.path.join(os.path.dirname(__file__), "..", "..", "config", "cloud_inference.yaml")
        ),
    )
    with patch("manthana_inference.chat_complete_sync", return_value=("Synthesized answer.", "m", {})):
        with patch("orchestrator._get_redis", new_callable=AsyncMock, return_value=None):
            result = await synthesize("query", "context")
            assert result == "Synthesized answer."


@pytest.mark.asyncio
async def test_synthesize_no_groq_returns_empty(monkeypatch):
    monkeypatch.delenv("OPENROUTER_API_KEY", raising=False)
    result = await synthesize("query", "context")
    assert result == ""


# ── manthana_search ───────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_manthana_search_mode_own_index(respx_mock):
    """Mode 1: 5+ own hits, no force_ai -> returns from own index."""
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        respx_mock.post("http://es.test/manthana-medical/_search").mock(
            return_value=httpx.Response(200, json={
                "hits": {
                    "hits": [
                        {"_source": {"url": f"https://a{i}.com", "title": f"A{i}", "content": f"Content {i}"}}
                        for i in range(5)
                    ]
                }
            })
        )
        result = await manthana_search("diabetes", force_ai=False)
        assert result["mode"] == "own_index"
        assert len(result["results"]) == 5
        assert "elapsed_seconds" in result


@pytest.mark.asyncio
async def test_manthana_search_mode_web_search(respx_mock):
    """Mode 2: <5 own hits -> web search + crawl pipeline."""
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        with patch("orchestrator.SEARXNG", "http://searxng.test"):
            with patch("orchestrator.CRAWL4AI", "http://crawl4ai.test"):
                respx_mock.post("http://es.test/manthana-medical/_search").mock(
                    return_value=httpx.Response(200, json={"hits": {"hits": []}})
                )
                respx_mock.get("http://searxng.test/search").mock(
                    return_value=httpx.Response(200, json={
                        "results": [
                            {"url": "https://pubmed.com/1", "title": "Study", "content": "Abstract here", "engine": "pubmed"},
                        ]
                    })
                )
                respx_mock.post("http://crawl4ai.test/crawl").mock(
                    return_value=httpx.Response(200, json={"results": [{"markdown": "x" * 100}]})
                )
                with patch("orchestrator.index_all", new_callable=AsyncMock):
                    result = await manthana_search("diabetes treatment", force_ai=False)
        assert result["mode"] in ("web_search", "ai_synthesis")
        assert "sources" in result
        assert "elapsed_seconds" in result


# ── init_indexes ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_init_indexes(respx_mock):
    with patch("orchestrator.ELASTICSEARCH", "http://es.test"):
        with patch("orchestrator.QDRANT", "http://qdrant.test"):
            with patch("orchestrator.MEILISEARCH", "http://meili.test"):
                respx_mock.put("http://es.test/manthana-medical").mock(
                    return_value=httpx.Response(200)
                )
                respx_mock.put("http://qdrant.test/collections/medical_documents").mock(
                    return_value=httpx.Response(200)
                )
                respx_mock.post("http://meili.test/indexes").mock(
                    return_value=httpx.Response(202)
                )
                await init_indexes()
                assert len(respx_mock.calls) >= 3
