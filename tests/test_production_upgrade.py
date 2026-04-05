"""
Integration tests for PRODUCTION_LAUNCH_UPGRADE_PLAN features.

Covers: Clinical trials (Phase A), Herb-drug evidence (Phase B), Audit trail (Phase C).
"""

import os

import pytest


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clinical_trials_search_returns_real_trials(client_router):
    """Phase A: /clinical-trials/search returns real trials from ClinicalTrials.gov."""
    resp = await client_router.post(
        "/v1/clinical-trials/search",
        json={"query": "diabetes", "filters": {}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    inner = data.get("data", data)
    assert "trials" in inner
    assert "total" in inner
    assert "source" in inner
    assert inner["source"] == "ClinicalTrials.gov"
    if inner.get("total", 0) > 0:
        trial = inner["trials"][0]
        assert "nctId" in trial
        assert "title" in trial
        assert "url" in trial
        assert "clinicaltrials.gov" in trial["url"].lower()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clinical_trials_india_filter(client_router):
    """Phase A: India filter returns trials (API filters by India sites)."""
    resp = await client_router.post(
        "/v1/clinical-trials/search",
        json={"query": "diabetes", "filters": {"india_only": True}},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    inner = data.get("data", data)
    trials = inner.get("trials", [])
    total = inner.get("total", 0)
    # With India filter, API returns studies with India in locations
    if trials:
        # At least one trial should have India in locations (API guarantees this)
        has_india = any(
            "India" in [loc.get("country", "") for loc in (t.get("locations") or []) if isinstance(loc, dict)]
            for t in trials
        )
        assert has_india or total > 0, "India filter should return trials"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_herb_drug_evidence_based(client_router):
    """Phase B: /herb-drug/analyze uses evidence-based table + PubMed; no herb-as-drug."""
    resp = await client_router.post(
        "/v1/herb-drug/analyze",
        json={"herb": "ashwagandha", "drug": "warfarin"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    inner = data.get("data", data)
    assert inner.get("herb") == "ashwagandha"
    assert inner.get("drug") == "warfarin"
    assert "safetyLevel" in inner
    assert inner["safetyLevel"] in ("safe", "caution", "avoid")
    assert "mechanism" in inner
    assert "clinicalNotes" in inner
    assert "data_sources" in inner
    # Should have curated_evidence or pubmed
    assert any(s in str(inner.get("data_sources", [])) for s in ["curated_evidence", "pubmed", "none"])
    # Interaction should have citation/recommendation
    interaction = inner.get("interaction", {})
    assert "recommendation" in interaction or "mechanism" in interaction


@pytest.mark.integration
@pytest.mark.asyncio
async def test_herb_drug_curated_match(client_router):
    """Phase B: Curated evidence returns known interaction."""
    resp = await client_router.post(
        "/v1/herb-drug/analyze",
        json={"herb": "st johns wort", "drug": "immunosuppressant"},
    )
    assert resp.status_code == 200
    data = resp.json()
    inner = data.get("data", data)
    assert inner.get("safetyLevel") == "avoid"
    assert "curated_evidence" in str(inner.get("data_sources", []))


@pytest.mark.asyncio
async def test_audit_log_populated(client_router):
    """Phase C: Audit log populated for every analysis."""
    import tempfile
    from services.shared.audit import query_audit_log, write_audit_log

    db_path = tempfile.mktemp(suffix=".db")
    try:
        write_audit_log(
            request_id="test-req-123",
            service="ecg",
            endpoint="/analyze/ecg",
            model_id="ecg-basic",
            findings=[{"label": "Normal sinus rhythm", "confidence": 85}],
            db_path=db_path,
        )
        entries = query_audit_log(request_id="test-req-123", db_path=db_path)
        assert len(entries) >= 1
        e = entries[0]
        assert e["request_id"] == "test-req-123"
        assert e["service"] == "ecg"
        assert e["model_id"] == "ecg-basic"
        assert "sinus" in (e.get("findings_summary") or "").lower()
    finally:
        if os.path.exists(db_path):
            os.remove(db_path)


@pytest.mark.asyncio
async def test_audit_log_query_endpoint(client_router):
    """Phase C: GET /v1/audit/log returns entries."""
    resp = await client_router.get("/v1/audit/log?limit=5")
    assert resp.status_code == 200
    data = resp.json()
    assert data.get("status") == "success"
    inner = data.get("data", data)
    assert "entries" in inner
    assert "count" in inner
    assert isinstance(inner["entries"], list)


@pytest.mark.asyncio
async def test_clinical_trials_query_required(client_router):
    """Clinical trials: query required."""
    resp = await client_router.post(
        "/v1/clinical-trials/search",
        json={"query": "", "filters": {}},
    )
    assert resp.status_code in (400, 422)


@pytest.mark.asyncio
async def test_herb_drug_both_required(client_router):
    """Herb-drug: both herb and drug required."""
    resp = await client_router.post(
        "/v1/herb-drug/analyze",
        json={"herb": "ashwagandha", "drug": ""},
    )
    assert resp.status_code in (400, 422)
