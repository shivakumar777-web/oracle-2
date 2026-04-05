"""Tests for domain_sources_meta + ranked OpenRouter domain extraction."""

from __future__ import annotations

# Import order: domain_sources must load before functions that pull meta
from services.shared import domain_sources as ds
from services.shared.domain_sources_meta import (
    rank_sources,
    score_source_for_query,
    source_meta_for_api,
)


def test_no_import_cycle_domain_sources_then_meta():
    """domain_sources may import meta lazily; eager meta import should not require ds at init."""
    from services.shared import domain_sources_meta as meta

    assert meta.SOURCE_META["ccras"].short_name == "CCRAS"


def test_unknown_source_id_gets_neutral_score():
    s = score_source_for_query("totally-unknown-pill-xyz", "query", ["ayurveda"])
    assert 0.0 < s < 0.5


def test_rank_sources_deterministic_tiebreak():
    ids = ["shodhganga", "ccras", "jaim"]
    ranked = [x[0] for x in rank_sources(ids, "", ["ayurveda"])]
    assert len(ranked) == 3
    assert set(ranked) == set(ids)


def test_openrouter_allowed_domains_ranked_non_empty():
    """Hostname allowlist is built from metadata-ranked source ids."""
    hosts = ds.openrouter_allowed_domains_for_ui_domain("ayurveda", query="khalitya hair")
    assert hosts
    assert any(x in hosts for x in ("ccras.nic.in", "ayush.gov.in", "jaim.in"))

    # Query-aware path should still return a valid list (same caps)
    hosts2 = ds.openrouter_allowed_domains_for_ui_domain("allopathy", query="clinical trial diabetes")
    assert hosts2
    assert "pubmed.ncbi.nlm.nih.gov" in hosts2 or "clinicaltrials.gov" in hosts2


def test_build_openrouter_web_search_parameters_accepts_query():
    p = ds.build_openrouter_web_search_parameters("ayurveda", query="triphala")
    assert "max_results" in p
    if p.get("allowed_domains"):
        assert p["engine"] == "exa"


def test_ranked_search_priority_entries_have_labels():
    entries = ds.ranked_search_priority_entries("allopathy", "diabetes trial", top_k=4)
    assert entries
    assert all("display_name" in e and "site_hint" in e for e in entries)


def test_source_meta_for_api_serializable():
    rows = source_meta_for_api()
    assert isinstance(rows, list)
    assert all("id" in r and "access" in r and "evidence_tier" in r for r in rows[:5])
