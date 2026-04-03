from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from config import ResearchSettings
from planner import decompose_query


@pytest.mark.asyncio
async def test_decompose_returns_list_of_strings():
    settings = ResearchSettings(RESEARCH_GROQ_API_KEY="x" * 40)
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content='{"questions": ["q1", "q2"]}'))]
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
    with patch("groq.AsyncGroq", return_value=mock_client):
        out = await decompose_query("hello world", ["allopathy"], "clinical", settings)
    assert isinstance(out, list)
    assert all(isinstance(x, str) for x in out)


@pytest.mark.asyncio
async def test_original_question_always_in_result():
    settings = ResearchSettings(RESEARCH_GROQ_API_KEY="x" * 40)
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content='{"questions": ["only other"]}'))]
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(return_value=mock_resp)
    with patch("groq.AsyncGroq", return_value=mock_client):
        out = await decompose_query("my unique q", ["allopathy"], "clinical", settings)
    assert "my unique q" in out


@pytest.mark.asyncio
async def test_groq_failure_returns_original():
    settings = ResearchSettings(RESEARCH_GROQ_API_KEY="x" * 40)
    mock_client = AsyncMock()
    mock_client.chat.completions.create = AsyncMock(side_effect=RuntimeError("boom"))
    with patch("groq.AsyncGroq", return_value=mock_client):
        out = await decompose_query("fallback q", ["ayurveda"], "clinical", settings)
    assert out == ["fallback q"]


@pytest.mark.asyncio
async def test_short_query_skip_is_orchestrator_behavior():
    """Planner still runs if called; orchestrator skips when len<=6."""
    settings = ResearchSettings(RESEARCH_GROQ_API_KEY="")
    out = await decompose_query("short", ["allopathy"], "clinical", settings)
    assert out == ["short"]
