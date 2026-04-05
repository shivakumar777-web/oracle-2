from __future__ import annotations

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from config import ResearchSettings
from planner import decompose_query


@pytest.mark.asyncio
async def test_decompose_returns_list_of_strings():
    settings = ResearchSettings(OPENROUTER_API_KEY="x" * 40)
    with (
        patch("manthana_inference.load_cloud_inference_config", return_value=MagicMock()),
        patch("manthana_inference.build_openrouter_async_client", return_value=MagicMock()),
        patch(
            "manthana_inference.chat_complete_async",
            AsyncMock(return_value=('{"questions": ["q1", "q2"]}', "m")),
        ),
    ):
        out = await decompose_query("hello world", ["allopathy"], "clinical", settings)
    assert isinstance(out, list)
    assert all(isinstance(x, str) for x in out)


@pytest.mark.asyncio
async def test_original_question_always_in_result():
    settings = ResearchSettings(OPENROUTER_API_KEY="x" * 40)
    with (
        patch("manthana_inference.load_cloud_inference_config", return_value=MagicMock()),
        patch("manthana_inference.build_openrouter_async_client", return_value=MagicMock()),
        patch(
            "manthana_inference.chat_complete_async",
            AsyncMock(return_value=('{"questions": ["only other"]}', "m")),
        ),
    ):
        out = await decompose_query("my unique q", ["allopathy"], "clinical", settings)
    assert "my unique q" in out


@pytest.mark.asyncio
async def test_openrouter_failure_returns_original():
    settings = ResearchSettings(OPENROUTER_API_KEY="x" * 40)
    with (
        patch("manthana_inference.load_cloud_inference_config", return_value=MagicMock()),
        patch("manthana_inference.build_openrouter_async_client", return_value=MagicMock()),
        patch(
            "manthana_inference.chat_complete_async",
            AsyncMock(side_effect=RuntimeError("boom")),
        ),
    ):
        out = await decompose_query("fallback q", ["ayurveda"], "clinical", settings)
    assert out == ["fallback q"]


@pytest.mark.asyncio
async def test_short_query_skip_is_orchestrator_behavior():
    """Planner still runs if called; orchestrator skips when len<=6."""
    settings = ResearchSettings(OPENROUTER_API_KEY="")
    out = await decompose_query("short", ["allopathy"], "clinical", settings)
    assert out == ["short"]
