"""
autocomplete.py — Web Autocomplete Router
==========================================
Search suggestions endpoint for medical queries.
"""

from __future__ import annotations

import json
import logging
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import JSONResponse

from config import WebSettings, get_web_settings

logger = logging.getLogger("manthana.web.autocomplete")


# ── Suggestion Templates ───────────────────────────────────────────────

MEDICAL_SUGGESTION_TEMPLATES = {
    "symptom": [
        "{} causes",
        "{} treatment",
        "{} diagnosis",
        "{} symptoms",
        "{} prevention",
    ],
    "drug": [
        "{} side effects",
        "{} dosage",
        "{} interactions",
        "{} uses",
        "{} contraindications",
    ],
    "condition": [
        "{} symptoms",
        "{} treatment",
        "{} prognosis",
        "{} causes",
        "{} types",
    ],
    "procedure": [
        "{} procedure",
        "{} recovery time",
        "{} risks",
        "{} preparation",
        "{} cost",
    ],
}

COMMON_MEDICAL_PREFIXES = [
    "what is",
    "how to treat",
    "symptoms of",
    "causes of",
    "side effects of",
    "interactions with",
    "dosage for",
    "prevention of",
]


def classify_query_type(query: str) -> str:
    """Classify query type for better suggestions."""
    lower_q = query.lower()
    if any(x in lower_q for x in ["mg", "tablet", "capsule", "injection", "dose", "medication"]):
        return "drug"
    if any(x in lower_q for x in ["surgery", "procedure", "operation", "transplant"]):
        return "procedure"
    if any(x in lower_q for x in ["pain", "fever", "cough", "nausea", "rash", "swelling"]):
        return "symptom"
    return "condition"


def generate_suggestions(query: str, category: str) -> List[str]:
    """Generate autocomplete suggestions based on query."""
    suggestions = []
    query_type = classify_query_type(query)

    # Add template-based suggestions
    templates = MEDICAL_SUGGESTION_TEMPLATES.get(query_type, MEDICAL_SUGGESTION_TEMPLATES["condition"])
    for template in templates[:3]:
        suggestions.append(template.format(query))

    # Add prefix-based suggestions
    for prefix in COMMON_MEDICAL_PREFIXES[:3]:
        suggestions.append(f"{prefix} {query}")

    # Add category-specific suggestions
    if category == "ayurveda":
        suggestions.append(f"{query} ayurvedic treatment")
        suggestions.append(f"{query} herbal remedies")
    elif category == "allopathy":
        suggestions.append(f"{query} evidence-based treatment")
        suggestions.append(f"{query} clinical guidelines")

    return suggestions[:7]


# ── Router Factory ───────────────────────────────────────────────────

def create_autocomplete_router(limiter) -> APIRouter:
    """Create the autocomplete router."""
    router = APIRouter(tags=["autocomplete"])

    @router.get("/search/autocomplete")
    @limiter.limit("300/minute")
    async def autocomplete(
        request: Request,
        q: str = Query(..., min_length=1, description="Query prefix"),
        category: str = Query(default="medical", description="Search category"),
        lang: Optional[str] = Query(default="en", description="Language code"),
        settings: WebSettings = Depends(get_web_settings),
    ):
        """Get autocomplete suggestions for medical queries."""
        rid = getattr(request.state, "request_id", "unknown")

        suggestions = generate_suggestions(q, category)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "web",
                "data": {
                    "query": q,
                    "suggestions": suggestions,
                    "category": category,
                },
                "error": None,
                "request_id": rid,
            },
        )

    return router
