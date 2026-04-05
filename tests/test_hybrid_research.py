"""
Unit tests for hybrid deep research (translation helpers, SSE contract, readiness).
"""
from __future__ import annotations

import sys
from pathlib import Path

import pytest

_root = Path(__file__).resolve().parents[1]
_rs = _root / "services" / "research-service"
sys.path.insert(0, str(_root))
sys.path.insert(0, str(_rs))

from hybrid_research import (  # noqa: E402
    _build_augmented_query,
    _dedupe_merged,
    _gr_sources_to_merged,
    hybrid_ready,
)
from services.shared.models import DeepResearchRequest  # noqa: E402


def test_build_augmented_query_includes_subdomains_and_fragments():
    q = _build_augmented_query(
        "Type 2 diabetes first-line therapy",
        "ayurveda",
        {"ayurveda": ["kayachikitsa"]},
        [],
    )
    assert "Type 2 diabetes" in q
    assert "kayachikitsa" in q
    assert "ccras.nic.in" in q or "ayush" in q.lower()


def test_gr_sources_to_merged_and_dedupe():
    raw = [
        {"url": "https://a.example/p", "title": "A", "content": "body one"},
        {"url": "https://a.example/p", "title": "A2", "content": "dup"},
        {"url": "https://b.example/q", "content": "two"},
    ]
    m = _gr_sources_to_merged(raw, "allopathy")
    assert len(m) == 2
    d = _dedupe_merged(m + m)
    assert len(d) == 2


def test_hybrid_ready_when_legacy_enabled():
    class _S:
        RESEARCH_USE_LEGACY_RAG = True
        SEARXNG_URL = ""

    ok, reason = hybrid_ready(_S())  # type: ignore[arg-type]
    assert ok is True
    assert reason == "legacy_rag_enabled"


def test_hybrid_ready_when_hybrid_and_no_searx(monkeypatch):
    monkeypatch.setattr("hybrid_research.hybrid_dependencies_available", lambda: True)

    class _S:
        RESEARCH_USE_LEGACY_RAG = False
        SEARXNG_URL = ""

    ok, reason = hybrid_ready(_S())  # type: ignore[arg-type]
    assert ok is False
    assert "searxng" in reason.lower()


@pytest.mark.asyncio
async def test_yield_section_events_contract():
    from hybrid_research import _yield_section_events

    payload = {
        "sections": [{"id": "summary", "title": "Summary", "content": "Hello [1]"}],
        "citations": [{"id": 1, "title": "T", "authors": "", "journal": "j", "year": 2020}],
        "followup_questions": ["Q1?", "Q2?", "Q3?"],
        "sources_searched": 3,
        "integrative_mode": True,
        "provider_used": "openrouter",
    }
    events: list = []
    async for ev in _yield_section_events(payload, 2.5, "req-abc", "vancouver"):
        events.append(ev)

    assert events[0]["type"] == "section"
    assert events[0]["id"] == "summary"
    assert any(e["type"] == "citations" for e in events)
    assert any(e["type"] == "followup" for e in events)
    done = [e for e in events if e["type"] == "done"][0]
    assert done["meta"]["sources_searched"] == 3
    assert done["meta"]["request_id"] == "req-abc"
    assert done["meta"]["citation_style"] == "vancouver"
    assert done["meta"]["provider_used"] == "openrouter"


def test_deep_research_request_question_text():
    b = DeepResearchRequest(
        query="x",
        domains=["allopathy"],
        subdomains=[],
        intent="clinical",
        depth="comprehensive",
        sources=[],
        output_format="structured",
        citation_style="vancouver",
        lang="en",
        deep=True,
    )
    assert b.question_text == "x"
