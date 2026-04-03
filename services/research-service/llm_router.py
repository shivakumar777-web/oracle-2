"""
Multi-provider LLM fallback: Groq → OpenAI → Ollama.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Awaitable, Callable, Dict, List, Tuple

import httpx

from config import ResearchSettings

logger = logging.getLogger("manthana.research.llm_router")

_GROQ_PLACEHOLDER = "your_groq_api_key_here"


def _groq_key(settings: ResearchSettings) -> str:
    key = (settings.RESEARCH_GROQ_API_KEY or "").strip()
    if not key or key == _GROQ_PLACEHOLDER or key.startswith("your_") or len(key) < 20:
        return ""
    return key


async def _call_groq(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    settings: ResearchSettings,
) -> str:
    api_key = _groq_key(settings)
    if not api_key:
        raise ValueError("Groq API key not configured")
    from groq import Groq

    groq = Groq(api_key=api_key)
    model = settings.RESEARCH_GROQ_MODEL

    def _sync() -> str:
        completion = groq.chat.completions.create(
            model=model,
            messages=messages,
            max_completion_tokens=max_tokens,
            temperature=temperature,
            stream=False,
        )
        return completion.choices[0].message.content or ""

    loop = asyncio.get_running_loop()
    return await loop.run_in_executor(None, _sync)


async def _call_openai(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    settings: ResearchSettings,
) -> str:
    if not (settings.RESEARCH_OPENAI_API_KEY or "").strip():
        raise ValueError("OpenAI key not configured")
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.RESEARCH_OPENAI_API_KEY)
    model = settings.RESEARCH_OPENAI_FALLBACK_MODEL or "gpt-4o-mini"
    resp = await client.chat.completions.create(
        model=model,
        messages=messages,
        max_tokens=max_tokens,
        temperature=temperature,
    )
    return resp.choices[0].message.content or ""


async def _call_ollama(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    settings: ResearchSettings,
) -> str:
    base = (settings.RESEARCH_OLLAMA_URL or "").strip().rstrip("/")
    if not base:
        raise ValueError("Ollama URL not configured")
    model = settings.RESEARCH_OLLAMA_MODEL or "llama3.2"
    async with httpx.AsyncClient(timeout=120.0) as client:
        resp = await client.post(
            f"{base}/api/chat",
            json={
                "model": model,
                "messages": messages,
                "stream": False,
                "options": {"temperature": temperature, "num_predict": max_tokens},
            },
        )
        resp.raise_for_status()
        data = resp.json()
        return (data.get("message") or {}).get("content") or ""


async def llm_with_fallback(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    settings: ResearchSettings,
    log_fn: Callable[[str], None] | None = None,
) -> Tuple[str, str]:
    """Returns (content, provider_used)."""
    providers: List[Tuple[str, Callable[..., Awaitable[str]]]] = [
        ("groq", _call_groq),
        ("openai", _call_openai),
        ("ollama", _call_ollama),
    ]
    last_error: Exception | None = None
    for name, fn in providers:
        try:
            if log_fn:
                log_fn(f"Attempting synthesis with {name}...")
            content = await fn(messages, max_tokens, temperature, settings)
            if log_fn:
                log_fn(f"Synthesis completed via {name}.")
            return content, name
        except Exception as e:
            last_error = e
            logger.debug("%s unavailable: %s", name, e)
            if log_fn:
                log_fn(f"{name} unavailable ({e}), trying next provider...")
            continue
    raise RuntimeError(f"All LLM providers failed. Last error: {last_error}")
