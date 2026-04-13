"""
Multi-provider LLM: OpenRouter (SSOT) → optional Ollama offline fallback.
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path
from typing import Awaitable, Callable, Dict, List, Tuple

import httpx

from config import ResearchSettings

logger = logging.getLogger("manthana.research.llm_router")


def _openrouter_keys(settings: ResearchSettings) -> List[str]:
    keys: List[str] = []
    k1 = (settings.OPENROUTER_API_KEY or os.environ.get("OPENROUTER_API_KEY") or "").strip()
    k2 = (settings.OPENROUTER_API_KEY_2 or os.environ.get("OPENROUTER_API_KEY_2") or "").strip()
    for k in (k1, k2):
        if k and len(k) >= 8 and k not in keys:
            keys.append(k)
    return keys


def _load_cfg():
    from manthana_inference import load_cloud_inference_config

    path = (os.environ.get("CLOUD_INFERENCE_CONFIG_PATH") or "").strip()
    return load_cloud_inference_config(Path(path) if path else None)


async def _call_openrouter(
    messages: List[Dict[str, str]],
    max_tokens: int,
    temperature: float,
    settings: ResearchSettings,
    log_fn: Callable[[str], None] | None,
) -> str:
    from manthana_inference import build_openrouter_async_client, chat_complete_async, resolve_role

    keys = _openrouter_keys(settings)
    if not keys:
        raise ValueError("OpenRouter API key not configured")
    cfg = _load_cfg()
    role_cfg = resolve_role(cfg, "research_synthesis")
    # Allow caller overrides while keeping YAML model/fallbacks
    rc = role_cfg.model_copy(update={"max_tokens": max_tokens, "temperature": temperature})
    last_err: Exception | None = None
    for api_key in keys:
        try:
            client = build_openrouter_async_client(api_key, cfg)
            text, _model, *_ = await chat_complete_async(
                client,
                cfg,
                "research_synthesis",
                messages,
                role_cfg=rc,
            )
            return text
        except Exception as e:
            last_err = e
            if log_fn:
                log_fn(f"OpenRouter key failed ({e}), trying next...")
    raise RuntimeError(f"OpenRouter failed: {last_err}")


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
    providers: List[Tuple[str, Callable[..., Awaitable[str]]]] = []

    if _openrouter_keys(settings):
        async def _or() -> str:
            return await _call_openrouter(messages, max_tokens, temperature, settings, log_fn)

        providers.append(("openrouter", _or))

    if (settings.RESEARCH_OLLAMA_URL or "").strip():

        async def _ollama_fn() -> str:
            return await _call_ollama(messages, max_tokens, temperature, settings)

        providers.append(("ollama", _ollama_fn))

    last_error: Exception | None = None
    for name, fn in providers:
        try:
            if log_fn:
                log_fn(f"Attempting synthesis with {name}...")
            content = await fn()
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
