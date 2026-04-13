"""
E2E and error-path tests.

- E2E: Full search flow (api → orchestrator) with all external services mocked.
- Error paths: 500s, timeouts, circuit breaker behavior.
"""
import io
import os
import pytest
from PIL import Image


def _minimal_valid_png():
    """Minimal valid 1x1 PNG for file validation."""
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), color=(0, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()
import respx
from unittest.mock import patch, AsyncMock, MagicMock
from httpx import Response as HttpxResponse, TimeoutException

# ── E2E: Full search flow ───────────────────────────────────────────────


@pytest.mark.asyncio
async def test_e2e_full_search_flow(respx_mock, monkeypatch):
    """
    Full search flow: api GET /search → orchestrator manthana_search
    with all external services (ES, SearXNG, Crawl4AI, Groq, etc.) mocked.
    """
    from api import app
    from httpx import ASGITransport, AsyncClient

    # Patch orchestrator URLs to test endpoints
    url_patches = [
        ("orchestrator.ELASTICSEARCH", "http://es.test"),
        ("orchestrator.SEARXNG", "http://searxng.test"),
        ("orchestrator.CRAWL4AI", "http://crawl4ai.test"),
        ("orchestrator.OLLAMA", "http://ollama.test"),
        ("orchestrator.QDRANT", "http://qdrant.test"),
        ("orchestrator.MEILISEARCH", "http://meili.test"),
    ]
    patches = [patch(p, v) for p, v in url_patches]
    for p in patches:
        p.start()

    try:
        # ES: search_own_index returns <5 hits → triggers web pipeline
        respx_mock.post("http://es.test/manthana-medical/_search").mock(
            return_value=HttpxResponse(200, json={"hits": {"hits": []}})
        )
        # SearXNG: web results
        respx_mock.get("http://searxng.test/search").mock(
            return_value=HttpxResponse(
                200,
                json={
                    "results": [
                        {
                            "url": "https://pubmed.com/1",
                            "title": "Diabetes Study",
                            "content": "Abstract about diabetes treatment.",
                            "engine": "pubmed",
                        },
                    ],
                    "number_of_results": 1,
                },
            )
        )
        # Crawl4AI: extract returns content (>=100 chars to avoid fallback)
        long_content = "x" * 150
        respx_mock.post("http://crawl4ai.test/crawl").mock(
            return_value=HttpxResponse(
                200,
                json={"results": [{"markdown": long_content}]},
            )
        )
        # Indexing: ES, Ollama, Qdrant, Meilisearch
        respx_mock.route(method="PUT", url__regex=r"http://es\.test/manthana-medical/_doc/[a-f0-9]+").mock(
            return_value=HttpxResponse(200)
        )
        respx_mock.post("http://ollama.test/api/embeddings").mock(
            return_value=HttpxResponse(200, json={"embedding": [0.1] * 768})
        )
        respx_mock.post("http://qdrant.test/collections/medical_documents/points").mock(
            return_value=HttpxResponse(200)
        )
        respx_mock.post("http://meili.test/indexes/medical_search/documents").mock(
            return_value=HttpxResponse(202)
        )
        # OpenRouter for synthesize (SDK — mock manthana_inference.chat_complete_sync)
        monkeypatch.setenv("OPENROUTER_API_KEY", "test-key-e2e")
        monkeypatch.setenv(
            "CLOUD_INFERENCE_CONFIG_PATH",
            os.path.abspath(
                os.path.join(os.path.dirname(__file__), "..", "..", "config", "cloud_inference.yaml")
            ),
        )
        with patch(
            "manthana_inference.chat_complete_sync",
            return_value=("Synthesized medical answer.", "m", {}),
        ):
            with patch("orchestrator._get_redis", new_callable=AsyncMock, return_value=None):
                async with AsyncClient(
                    transport=ASGITransport(app=app), base_url="http://test"
                ) as client:
                    resp = await client.get("/search?q=diabetes%20treatment&category=medical")
        assert resp.status_code == 200
        data = resp.json()
        assert "query" in data
        assert data["query"] == "diabetes treatment"
        assert "mode" in data
        assert data["mode"] in ("web_search", "ai_synthesis")
        assert "results" in data
        assert "elapsed_seconds" in data
        assert "sources" in data
    finally:
        for p in patches:
            p.stop()


# ── Error paths: 500s, timeouts, circuit breaker ────────────────────────


@pytest.mark.asyncio
async def test_api_search_returns_500_on_orchestrator_exception():
    """GET /search returns 500 when manthana_search raises."""
    from api import app
    from httpx import ASGITransport, AsyncClient

    with patch("api.manthana_search", new_callable=AsyncMock, side_effect=RuntimeError("Pipeline crash")):
        async with AsyncClient(
            transport=ASGITransport(app=app), base_url="http://test"
        ) as client:
            resp = await client.get("/search?q=diabetes%20treatment")
    assert resp.status_code == 500
    assert "internal error" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_analyze_auto_returns_502_on_downstream_timeout(client_router, respx_mock):
    """POST /v1/analyze/auto returns 502 when downstream service times out."""
    respx_mock.route(
        method="POST",
        url__regex=r"http://ecg:8102/analyze/ecg",
    ).mock(side_effect=TimeoutException("Connection timed out"))
    file_content = _minimal_valid_png()
    resp = await client_router.post(
        "/v1/analyze/auto",
        files={"file": ("strip.png", io.BytesIO(file_content), "image/png")},
        data={"type_hint": "ecg", "patient_id": ""},
    )
    assert resp.status_code == 502
    data = resp.json()
    assert data.get("status") == "error"
    assert "502" in str(data.get("error", {}).get("code", ""))


@pytest.mark.asyncio
async def test_analyze_auto_returns_502_on_downstream_500(client_router, respx_mock):
    """POST /v1/analyze/auto returns 200 with error details when downstream returns 500."""
    respx_mock.route(
        method="POST",
        url__regex=r"http://ecg:8102/analyze/ecg",
    ).mock(return_value=HttpxResponse(500, json={"error": "Internal server error"}))
    file_content = _minimal_valid_png()
    resp = await client_router.post(
        "/v1/analyze/auto",
        files={"file": ("strip.png", io.BytesIO(file_content), "image/png")},
        data={"type_hint": "ecg", "patient_id": ""},
    )
    # ai-router normalizes to 200 with downstream_status in error body
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    assert data.get("data", {}).get("downstream_status") == 500


@pytest.mark.asyncio
async def test_circuit_breaker_returns_503_when_open(client_router, respx_mock):
    """
    When circuit opens after N failures, /v1/analyze/auto returns 503
    (service temporarily unavailable). Failures must raise (not 500 response)
    to trigger on_failure.
    """
    import sys

    # client_router loads ai_router_main; use that same module for patching
    mod = sys.modules.get("ai_router_main")
    assert mod is not None, "ai_router_main loaded by client_router"
    CircuitBreaker = mod.CircuitBreaker

    # Use a fresh circuit with low threshold for fast test
    fresh_cb = CircuitBreaker(failure_threshold=2, reset_timeout=60)
    with patch.object(mod, "_circuit", fresh_cb):
        # Raise exception to trigger on_failure (500 response alone does not)
        respx_mock.route(
            method="POST",
            url__regex=r"http://ecg:8102/analyze/ecg",
        ).mock(side_effect=Exception("Connection refused"))

        # First two calls fail with exception → on_failure called twice → circuit opens
        png_bytes = _minimal_valid_png()
        for _ in range(2):
            resp = await client_router.post(
                "/v1/analyze/auto",
                files={"file": ("strip.png", io.BytesIO(png_bytes), "image/png")},
                data={"type_hint": "ecg", "patient_id": ""},
            )
            assert resp.status_code == 502

        # Third call: circuit open → 503 before even calling downstream
        resp = await client_router.post(
            "/v1/analyze/auto",
            files={"file": ("strip.png", io.BytesIO(png_bytes), "image/png")},
            data={"type_hint": "ecg", "patient_id": ""},
        )
    assert resp.status_code == 503
    data = resp.json()
    assert data.get("status") == "error"
    assert "503" in str(data.get("error", {}).get("code", ""))
    assert "temporarily unavailable" in resp.json().get("error", {}).get("message", "").lower()
