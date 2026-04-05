import io
import pytest
import respx
from unittest.mock import patch, AsyncMock
from httpx import Response as HttpxResponse


@pytest.mark.asyncio
async def test_router_health(client_router):
    resp = await client_router.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "services" in data["data"]


@pytest.mark.asyncio
async def test_router_categories(client_router):
    resp = await client_router.get("/v1/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "categories" in data["data"]


@pytest.mark.asyncio
async def test_router_services(client_router):
    resp = await client_router.get("/v1/services")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "services" in data["data"]


@pytest.mark.asyncio
async def test_router_info(client_router):
    resp = await client_router.get("/info")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"


@pytest.mark.asyncio
async def test_router_search(client_router):
    """GET /search returns search structure (mocked SearXNG)."""
    with patch("ai_router_main.fetch_searxng", new_callable=AsyncMock) as m_searx:
        with patch("ai_router_main.search_own_index_async", new_callable=AsyncMock) as m_meili:
            m_searx.return_value = {"results": [], "number_of_results": 0}
            m_meili.return_value = []
            resp = await client_router.get("/v1/search?q=diabetes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    d = data["data"]
    assert "query" in d
    assert "results" in d
    assert "images" in d
    assert "videos" in d
    assert "relatedQuestions" in d


# ── Plagiarism ───────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_plagiarism_check(client_router):
    """POST /plagiarism/check with mocked check_originality."""
    with patch("routers.plagiarism.check_originality", new_callable=AsyncMock) as m:
        m.return_value = {
            "originalityScore": 92,
            "matches": [],
            "scanId": "test-123",
        }
        resp = await client_router.post(
            "/v1/plagiarism/check",
            json={"text": " ".join(["word"] * 55), "scanId": "test-123"},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["originalityScore"] == 92


@pytest.mark.asyncio
async def test_plagiarism_check_too_short(client_router):
    """POST /plagiarism/check rejects text < 50 words (Pydantic validation)."""
    resp = await client_router.post(
        "/v1/plagiarism/check",
        json={"text": "short text"},
    )
    assert resp.status_code in (400, 422)
    body = resp.json()
    assert "50" in str(body).lower() or "word" in str(body).lower() or "minimum" in str(body).lower()


@pytest.mark.asyncio
async def test_plagiarism_health(client_router):
    """GET /plagiarism/health returns status."""
    resp = await client_router.get("/v1/plagiarism/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"


# ── Metrics ───────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_metrics(client_router):
    """GET /metrics returns Prometheus-style metrics."""
    resp = await client_router.get("/metrics")
    assert resp.status_code == 200
    text = resp.text
    assert "manthana_requests_total" in text
    assert "manthana_errors_total" in text
    assert "manthana_rate_limited_total" in text


# ── Analyze auto ───────────────────────────────────────────────────────
def _minimal_valid_png():
    """Create minimal valid 1x1 PNG for file validation tests."""
    from PIL import Image
    buf = io.BytesIO()
    Image.new("RGB", (1, 1), color=(0, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.mark.asyncio
async def test_analyze_auto(client_router, respx_mock):
    """POST /analyze/auto forwards to downstream service (mocked ECG)."""
    respx_mock.route(
        method="POST",
        url__regex=r"http://ecg:8102/analyze/ecg",
    ).mock(return_value=HttpxResponse(200, json={"data": {"pathologies": []}}))
    file_content = _minimal_valid_png()
    resp = await client_router.post(
        "/v1/analyze/auto",
        files={"file": ("strip.png", io.BytesIO(file_content), "image/png")},
        data={"type_hint": "ecg", "patient_id": ""},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"


# ── Phase 2: Integration tests for proxy routes ───────────────────────────


@pytest.mark.asyncio
async def test_icd10_suggest_proxy_success(client_router, respx_mock):
    """GET /v1/icd10/suggest proxies to manthana-api and returns envelope."""
    respx_mock.route(
        method="GET",
        url__regex=r".*/icd10/suggest.*",
    ).mock(
        return_value=HttpxResponse(
            200,
            json={"query": "diabetes", "suggestions": [{"code": "E11", "description": "Type 2 diabetes"}]},
        )
    )
    resp = await client_router.get("/v1/icd10/suggest?q=diabetes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    assert data["data"]["query"] == "diabetes"
    assert len(data["data"]["suggestions"]) > 0
    assert data["data"]["suggestions"][0]["code"] == "E11"


@pytest.mark.asyncio
async def test_icd10_suggest_fallback_when_proxy_fails(client_router, respx_mock):
    """GET /v1/icd10/suggest falls back to icd10_lookup when proxy fails."""
    respx_mock.route(
        method="GET",
        url__regex=r".*/icd10/suggest.*",
    ).mock(return_value=HttpxResponse(500))
    resp = await client_router.get("/v1/icd10/suggest?q=diabetes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    assert data["data"]["query"] == "diabetes"
    assert "suggestions" in data["data"]
    assert len(data["data"]["suggestions"]) > 0


@pytest.mark.asyncio
async def test_search_autocomplete(client_router, respx_mock):
    """GET /v1/search/autocomplete returns envelope with suggestions."""
    respx_mock.route(
        method="GET",
        url__regex=r".*/autocompleter.*",
    ).mock(return_value=HttpxResponse(200, json=["diabetes", ["diabetes", "diabetes mellitus", "diabetes type 2"]]))
    resp = await client_router.get("/v1/search/autocomplete?q=diab")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    assert "suggestions" in data["data"]
    assert "diabetes" in data["data"]["suggestions"]


@pytest.mark.asyncio
async def test_search_autocomplete_empty_on_error(client_router, respx_mock):
    """GET /v1/search/autocomplete returns empty suggestions on SearXNG error."""
    respx_mock.route(
        method="GET",
        url__regex=r".*/autocompleter.*",
    ).mock(return_value=HttpxResponse(500))
    resp = await client_router.get("/v1/search/autocomplete?q=diab")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert data["data"]["suggestions"] == []


@pytest.mark.asyncio
async def test_report_enrich_e2e(client_router):
    """POST /v1/report/enrich returns envelope with ICD-10/RadLex."""
    with patch("ai_router_main._call_groq_chat", new_callable=AsyncMock) as m_llm:
        m_llm.return_value = '{"impression": "Pleural effusion. Correlate clinically.", "differential": {"pleural effusion": ["CHF", "Pneumonia", "Malignancy"]}, "triage_level": "ROUTINE"}'
        resp = await client_router.post(
            "/v1/report/enrich",
            json={
                "modality": "chest_xray",
                "findings": [
                    {"label": "pleural effusion", "confidence": 0.9, "severity": "moderate"},
                ],
            },
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    d = data["data"]
    assert "enriched_findings" in d
    assert len(d["enriched_findings"]) == 1
    assert d["enriched_findings"][0]["icd10_code"] == "J90"
    assert "rads_score" in d
    assert d["rads_score"]["system"] == "Lung-RADS"
    assert "impression" in d


@pytest.mark.asyncio
async def test_report_pdf_proxy(client_router, respx_mock):
    """POST /v1/report/pdf proxies to manthana-api and streams PDF."""
    pdf_bytes = b"%PDF-1.4 fake pdf content"
    respx_mock.route(
        method="POST",
        url__regex=r".*/report/pdf",
    ).mock(
        return_value=HttpxResponse(
            200,
            content=pdf_bytes,
            headers={"Content-Type": "application/pdf"},
        )
    )
    resp = await client_router.post(
        "/v1/report/pdf",
        json={
            "enriched_findings": [{"label": "pleural effusion", "icd10_code": "J90"}],
            "rads_score": {"system": "Lung-RADS"},
            "triage_level": "ROUTINE",
            "impression": "Test impression",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("application/pdf")
    assert resp.content == pdf_bytes


@pytest.mark.asyncio
async def test_report_pdf_proxy_502_on_failure(client_router, respx_mock):
    """POST /v1/report/pdf returns 502 when manthana-api fails."""
    respx_mock.route(
        method="POST",
        url__regex=r".*/report/pdf",
    ).mock(return_value=HttpxResponse(500))
    resp = await client_router.post(
        "/v1/report/pdf",
        json={"enriched_findings": [], "rads_score": {}, "triage_level": "ROUTINE", "impression": ""},
    )
    assert resp.status_code == 502
    data = resp.json()
    assert data["status"] == "error"


# ── Auth: protected routes return 401 when auth required ─────────────────────
@pytest.mark.asyncio
async def test_protected_route_401_when_require_auth(app_router, client_router):
    """When auth required, unauthenticated request to protected route → 401."""
    from fastapi import HTTPException
    from ai_router_main import get_protected_user

    async def _require_auth():
        raise HTTPException(status_code=401, detail="Authentication required")

    app_router.dependency_overrides[get_protected_user] = _require_auth
    try:
        resp = await client_router.post(
            "/v1/query",
            json={"query": "What is diabetes?"},
        )
        assert resp.status_code == 401
    finally:
        app_router.dependency_overrides.pop(get_protected_user, None)


@pytest.mark.asyncio
async def test_query_endpoint_validation(client_router):
    """POST /v1/query: empty query → 400; query too long → 422."""
    resp = await client_router.post("/v1/query", json={})
    assert resp.status_code in (400, 422)
    resp2 = await client_router.post("/v1/query", json={"query": "x" * 5001})
    assert resp2.status_code == 422


@pytest.mark.asyncio
async def test_query_endpoint(client_router, respx_mock):
    """POST /v1/query returns envelope (mocked RAG + Ollama)."""
    respx_mock.route(method="POST", url__regex=r".*/indexes/.*/search").mock(
        return_value=HttpxResponse(200, json={"hits": []})
    )
    respx_mock.route(method="POST", url__regex=r".*/collections/.*/points/search").mock(
        return_value=HttpxResponse(200, json={"result": []})
    )
    respx_mock.route(method="POST", url__regex=r".*/api/search").mock(
        return_value=HttpxResponse(200, json={"sources": []})
    )
    respx_mock.route(method="POST", url__regex=r".*/api/chat").mock(
        return_value=HttpxResponse(200, json={"message": {"content": "Ollama synthesized answer."}})
    )
    with patch("ai_router_main._call_groq_chat", new_callable=AsyncMock) as m_llm:
        m_llm.return_value = "Ollama synthesized answer for the medical query."
        resp = await client_router.post(
            "/v1/query",
            json={"question": "What is diabetes?", "context": ""},
        )
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "success"
    assert "data" in data
    assert "answer" in data["data"]

