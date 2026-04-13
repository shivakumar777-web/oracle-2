"""
Query decomposition — split complex questions into sub-queries for parallel retrieval.
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any, List

from config import ResearchSettings

logger = logging.getLogger("manthana.research.planner")

DECOMPOSE_SYSTEM_PROMPT = """You are a medical research planner.
Given a research question and medical domains, generate focused
sub-questions that together cover the full research need.
Return ONLY a JSON object with key "questions" whose value is an array of strings. No explanation.
Each sub-question must be answerable by searching medical literature.
Maximum 5 sub-questions. Minimum 2."""


async def decompose_query(
    question: str,
    domains: List[str],
    intent: str,
    settings: ResearchSettings,
) -> List[str]:
    """Decompose a research question via OpenRouter; on failure return [question]."""
    k1 = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    k2 = (settings.OPENROUTER_API_KEY_2 or os.environ.get("OPENROUTER_API_KEY_2") or "").strip()
    keys = [k for k in (k1, k2) if k and len(k) >= 8]
    if not keys:
        return [question]

    prompt = f"""
Research question: {question}
Medical domains: {", ".join(domains)}
Research intent: {intent}

Generate focused sub-questions as JSON only.
"""
    messages = [
        {"role": "system", "content": DECOMPOSE_SYSTEM_PROMPT},
        {"role": "user", "content": prompt},
    ]
    try:
        from manthana_inference import (
            build_openrouter_async_client,
            chat_complete_async,
            load_cloud_inference_config,
        )

        path = (os.environ.get("CLOUD_INFERENCE_CONFIG_PATH") or "").strip()
        cfg = load_cloud_inference_config(Path(path) if path else None)
        last_err: Exception | None = None
        for api_key in keys:
            try:
                client = build_openrouter_async_client(api_key, cfg)
                raw, _model, *_ = await chat_complete_async(
                    client,
                    cfg,
                    "research_planner",
                    messages,
                    response_format={"type": "json_object"},
                )
                raw = (raw or "").strip()
                parsed: Any = json.loads(raw)
                if isinstance(parsed, list):
                    questions = [str(q).strip() for q in parsed if str(q).strip()]
                else:
                    questions = parsed.get("questions") or parsed.get("sub_questions") or []
                    questions = [str(q).strip() for q in questions if str(q).strip()]
                if question not in questions:
                    questions.insert(0, question)
                return questions[:5]
            except Exception as e:
                last_err = e
                logger.debug("planner openrouter attempt failed: %s", e)
        logger.warning("Query decomposition failed: %s — using original query", last_err)
        return [question]
    except Exception as e:
        logger.warning("Query decomposition failed: %s — using original query", e)
        return [question]
