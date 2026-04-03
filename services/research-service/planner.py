"""
Query decomposition — split complex questions into sub-queries for parallel retrieval.
"""

from __future__ import annotations

import json
import logging
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
    """Decompose a research question via Groq; on failure return [question]."""
    key = (settings.RESEARCH_GROQ_API_KEY or "").strip()
    if not key or len(key) < 20:
        return [question]

    prompt = f"""
Research question: {question}
Medical domains: {", ".join(domains)}
Research intent: {intent}

Generate focused sub-questions as JSON only.
"""
    try:
        from groq import AsyncGroq

        groq = AsyncGroq(api_key=key)
        model = "llama-3.1-8b-instant"
        resp = await groq.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": DECOMPOSE_SYSTEM_PROMPT},
                {"role": "user", "content": prompt},
            ],
            max_completion_tokens=512,
            temperature=0.3,
            response_format={"type": "json_object"},
        )
        raw = (resp.choices[0].message.content or "").strip()
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
        logger.warning("Query decomposition failed: %s — using original query", e)
        return [question]
