"""Shared OpenRouter + cloud_inference.yaml wiring for Oracle-2 services."""

from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

from manthana_inference import (
    CloudInferenceConfig,
    build_openrouter_async_client,
    build_openrouter_sync_client,
    load_cloud_inference_config,
    stream_chat_async,
)


@lru_cache
def get_inference_config() -> CloudInferenceConfig:
    path = (os.environ.get("CLOUD_INFERENCE_CONFIG_PATH") or "").strip()
    return load_cloud_inference_config(Path(path) if path else None)


def openrouter_api_keys(settings: Any = None) -> List[str]:
    """Collect OpenRouter keys from optional pydantic settings, then environment."""
    keys: List[str] = []
    if settings is not None:
        for attr in (
            "OPENROUTER_API_KEY",
            "OPENROUTER_API_KEY_2",
            "ORACLE_OPENROUTER_API_KEY",
            "ORACLE_OPENROUTER_API_KEY_2",
        ):
            k = (getattr(settings, attr, None) or "").strip()
            if k and len(k) >= 8 and k not in keys:
                keys.append(k)
    for env_name in (
        "OPENROUTER_API_KEY",
        "OPENROUTER_API_KEY_2",
        "ORACLE_OPENROUTER_API_KEY",
        "ORACLE_OPENROUTER_API_KEY_2",
    ):
        k = (os.environ.get(env_name) or "").strip()
        if k and len(k) >= 8 and k not in keys:
            keys.append(k)
    return keys


def effective_inference_config(settings: Any = None) -> CloudInferenceConfig:
    """Base OpenRouter config from YAML, optional ORACLE_OPENROUTER_BASE_URL override."""
    cfg = get_inference_config()
    if settings is None:
        return cfg
    base = (getattr(settings, "ORACLE_OPENROUTER_BASE_URL", None) or "").strip()
    if base:
        return cfg.model_copy(update={"openrouter_base_url": base.rstrip("/")})
    return cfg


def build_async_client(api_key: str, settings: Any = None) -> Any:
    return build_openrouter_async_client(api_key, effective_inference_config(settings))


def build_sync_client(api_key: str, settings: Any = None) -> Any:
    return build_openrouter_sync_client(api_key, effective_inference_config(settings))


async def stream_role(
    api_key: str,
    role: str,
    messages: List[Dict[str, Any]],
):
    """Yield SSE-style token payloads (content chunks) for one key."""
    client = build_async_client(api_key)
    cfg = get_inference_config()
    async for delta, _model in stream_chat_async(client, cfg, role, messages):
        if delta:
            yield delta
