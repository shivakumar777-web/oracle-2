"""
knowledge.py — Knowledge Panel AI Summary Router
=================================================
Provides a minimal AI summary for the knowledge panel sidebar.
Single Groq call per unique entity, cached in Redis for 24 hours.
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from config import WebSettings, get_web_settings

import sys

PROJECT_ROOT = "/opt/manthana"
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)
from services.shared.envelopes import create_web_response

logger = logging.getLogger("manthana.web.knowledge")

GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

SYSTEM_PROMPT = (
    "You are a concise medical reference assistant. "
    "Provide a 2-3 sentence summary suitable for a medical professional. "
    "Be factual and cite no sources. Do not use markdown formatting."
)


def _cache_key(entity: str, domain: str) -> str:
    h = hashlib.sha256(f"{entity}:{domain}".lower().encode()).hexdigest()[:16]
    return f"web:knowledge:{h}"


async def _groq_complete(
    prompt: str,
    api_key: str,
    model: str = "llama-3.3-70b-versatile",
    max_tokens: int = 200,
) -> Optional[str]:
    """Single Groq chat completion with tight token limit."""
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(
                GROQ_API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {"role": "user", "content": prompt},
                    ],
                    "max_tokens": max_tokens,
                    "temperature": 0.3,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning(f"Groq knowledge call failed: {exc}")
        return None


def create_knowledge_router() -> APIRouter:
    """Create the knowledge panel router."""
    router = APIRouter(tags=["knowledge"])

    @router.get("/knowledge/summary")
    async def knowledge_summary(
        request: Request,
        entity: str = Query(..., description="Medical entity name"),
        domain: str = Query(default="allopathy", description="allopathy|ayurveda"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """
        Generate a 2-3 sentence medical summary for the knowledge panel.
        Uses Groq (fast, cheap). Cached in Redis for 24 hours.
        """
        rid = getattr(request.state, "request_id", "unknown")
        redis_client = getattr(request.app.state, "redis", None)
        key = _cache_key(entity, domain)

        # Check Redis cache first
        if redis_client:
            try:
                cached = await redis_client.get(key)
                if cached:
                    data = json.loads(cached)
                    return JSONResponse(
                        status_code=200,
                        content=create_web_response(
                            {**data, "cached": True}, rid
                        ),
                    )
            except Exception:
                pass

        api_key = settings.WEB_GROQ_API_KEY
        if not api_key:
            return JSONResponse(
                status_code=200,
                content=create_web_response(
                    {
                        "entity": entity,
                        "domain": domain,
                        "summary": None,
                        "cached": False,
                        "reason": "no_api_key",
                    },
                    rid,
                ),
            )

        domain_label = "Ayurvedic medicine" if domain == "ayurveda" else "modern medicine"
        prompt = (
            f"In 2-3 sentences, summarize '{entity}' for a medical professional. "
            f"Domain: {domain_label}."
        )

        start = time.time()
        summary = await _groq_complete(
            prompt,
            api_key,
            model=settings.WEB_GROQ_MODEL,
            max_tokens=200,
        )
        elapsed = int((time.time() - start) * 1000)

        payload = {
            "entity": entity,
            "domain": domain,
            "summary": summary,
            "elapsed": elapsed,
            "cached": False,
        }

        # Cache for 24 hours
        if redis_client and summary:
            try:
                await redis_client.setex(
                    key,
                    settings.WEB_KNOWLEDGE_CACHE_TTL,
                    json.dumps(payload),
                )
            except Exception:
                pass

        return JSONResponse(
            status_code=200,
            content=create_web_response(payload, rid),
        )

    return router
