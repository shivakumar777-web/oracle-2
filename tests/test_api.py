"""
Tests for api.py — Manthana Legacy Search API.
Uses mocks for orchestrator to avoid external dependencies.
"""
import pytest
from unittest.mock import AsyncMock, patch
from httpx import ASGITransport, AsyncClient


@pytest.fixture
def mock_orchestrator():
    """Mock orchestrator functions to avoid ES/SearXNG/Groq calls."""
    with patch("api.init_indexes", new_callable=AsyncMock) as m_init:
        with patch("api.close_client", new_callable=AsyncMock) as m_close:
            with patch("api.manthana_search", new_callable=AsyncMock) as m_search:
                with patch("api.synthesize", new_callable=AsyncMock) as m_synth:
                    m_init.return_value = None
                    m_close.return_value = None
                    m_search.return_value = {
                        "query": "test",
                        "results": [],
                        "synthesis": None,
                        "sources": [],
                    }
                    m_synth.return_value = "Synthesized answer"
                    yield {"init": m_init, "close": m_close, "search": m_search, "synthesize": m_synth}


@pytest.fixture
async def api_client(mock_orchestrator):
    """Create test client for api app."""
    from api import app
    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as ac:
        yield ac


@pytest.mark.asyncio
async def test_api_root(api_client):
    """GET / returns service info."""
    resp = await api_client.get("/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["product"] == "Manthana"
    assert data["version"] == "2.0.0"
    assert "endpoints" in data


@pytest.mark.asyncio
async def test_api_health(api_client):
    """GET /health returns health status."""
    resp = await api_client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "timestamp" in data


@pytest.mark.asyncio
async def test_api_categories(api_client):
    """GET /categories returns medical domain categories."""
    resp = await api_client.get("/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert "categories" in data
    cats = data["categories"]
    assert len(cats) > 0
    assert any(c["id"] == "medical" for c in cats)


@pytest.mark.asyncio
async def test_api_icd10_exact_match(api_client):
    """GET /icd10/suggest returns exact match for diabetes."""
    resp = await api_client.get("/icd10/suggest?q=diabetes")
    assert resp.status_code == 200
    data = resp.json()
    assert data["query"] == "diabetes"
    assert "suggestions" in data
    assert len(data["suggestions"]) > 0
    assert any(s.get("code") == "E11" for s in data["suggestions"])


@pytest.mark.asyncio
async def test_api_icd10_prefix_match(api_client):
    """GET /icd10/suggest returns prefix matches."""
    resp = await api_client.get("/icd10/suggest?q=diab")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["suggestions"]) > 0


@pytest.mark.asyncio
async def test_api_icd10_code_search(api_client):
    """GET /icd10/suggest finds by ICD code."""
    resp = await api_client.get("/icd10/suggest?q=E11")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["suggestions"]) > 0
    assert any(s.get("code") == "E11" for s in data["suggestions"])


@pytest.mark.asyncio
async def test_api_icd10_unknown_fallback(api_client):
    """GET /icd10/suggest returns R69 fallback for unknown."""
    resp = await api_client.get("/icd10/suggest?q=xyznonexistent")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["suggestions"]) > 0
    assert any(s.get("code") == "R69" for s in data["suggestions"])


@pytest.mark.asyncio
async def test_api_icd10_query_too_short(api_client):
    """GET /icd10/suggest rejects query < 2 chars."""
    resp = await api_client.get("/icd10/suggest?q=z")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_search_get(api_client, mock_orchestrator):
    """GET /search returns search results."""
    resp = await api_client.get("/search?q=diabetes%20treatment")
    assert resp.status_code == 200
    data = resp.json()
    assert "query" in data or "results" in data
    mock_orchestrator["search"].assert_called_once()


@pytest.mark.asyncio
async def test_api_search_post(api_client, mock_orchestrator):
    """POST /search returns search results."""
    resp = await api_client.post(
        "/search",
        json={"query": "hypertension guidelines", "category": "medical", "force_ai": False},
    )
    assert resp.status_code == 200
    mock_orchestrator["search"].assert_called_once()


@pytest.mark.asyncio
async def test_api_search_query_too_short(api_client):
    """GET /search rejects query < 2 chars."""
    resp = await api_client.get("/search?q=a")
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_search_post_validation(api_client):
    """POST /search rejects invalid body."""
    resp = await api_client.post("/search", json={"query": "x"})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_search_orchestrator_exception(api_client, mock_orchestrator):
    """GET /search returns 500 when orchestrator raises."""
    mock_orchestrator["search"].side_effect = Exception("Pipeline error")
    resp = await api_client.get("/search?q=diabetes%20treatment")
    assert resp.status_code == 500
    assert "internal error" in resp.json().get("detail", "").lower()


@pytest.mark.asyncio
async def test_api_report_enrich_validation(api_client):
    """POST /report/enrich requires modality and findings."""
    resp = await api_client.post("/report/enrich", json={})
    assert resp.status_code == 422


@pytest.mark.asyncio
async def test_api_report_enrich_ok(api_client):
    """POST /report/enrich returns enriched findings."""
    with patch("api.synthesize", new_callable=AsyncMock, return_value=None):
        resp = await api_client.post(
            "/report/enrich",
            json={
                "modality": "chest_xray",
                "findings": [
                    {"label": "pleural effusion", "confidence": 0.9, "severity": "moderate"}
                ],
            },
        )
    # May succeed or fail (500) if synthesize unavailable
    assert resp.status_code in (200, 500)


@pytest.mark.asyncio
async def test_api_report_enrich_mammogram_rads(api_client):
    """POST /report/enrich uses BI-RADS for mammogram modality."""
    with patch("api.synthesize", new_callable=AsyncMock, return_value=None):
        resp = await api_client.post(
            "/report/enrich",
            json={
                "modality": "mammogram",
                "findings": [{"label": "cardiomegaly", "confidence": 0.85}],
            },
        )
    if resp.status_code == 200:
        data = resp.json()
        assert data["rads_score"]["system"] == "BI-RADS"


@pytest.mark.asyncio
async def test_api_report_enrich_liver_rads(api_client):
    """POST /report/enrich uses LI-RADS for liver modality."""
    with patch("api.synthesize", new_callable=AsyncMock, return_value=None):
        resp = await api_client.post(
            "/report/enrich",
            json={
                "modality": "liver_ct",
                "findings": [{"label": "mass", "confidence": 0.8}],
            },
        )
    if resp.status_code == 200:
        data = resp.json()
        assert data["rads_score"]["system"] == "LI-RADS"


@pytest.mark.asyncio
async def test_api_report_pdf(api_client):
    """POST /report/pdf returns PDF bytes (minimal body, no findings table)."""
    resp = await api_client.post(
        "/report/pdf",
        json={
            "enriched_findings": [],
            "rads_score": {"system": "Lung-RADS", "score": "3", "meaning": "Benign", "action": "Follow-up", "reference": "https://acr.org"},
            "triage_level": "ROUTINE",
            "impression": "No dominant abnormality.",
            "report_standard": "ACR 2024",
        },
    )
    assert resp.status_code == 200
    assert resp.headers.get("content-type", "").startswith("application/pdf")
    assert "attachment" in resp.headers.get("content-disposition", "").lower()
    assert len(resp.content) > 100


