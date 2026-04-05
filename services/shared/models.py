"""
models.py — Manthana Shared Pydantic Models
=============================================
Canonical request / response schemas used across the AI Router,
clinical micro-services, and the legacy Manthana API.

Backward compatibility:
  • ``BaseResponse``, ``ErrorDetail``, ``HealthResponse``,
    ``FileAnalysisRequest`` retain their original field names and types.
  • New models are additive — no existing contract is broken.
"""

from __future__ import annotations

import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ═══════════════════════════════════════════════════════════════════════
#  ENUMS
# ═══════════════════════════════════════════════════════════════════════

class ResponseStatus(str, Enum):
    """Allowed values for ``BaseResponse.status``."""
    SUCCESS = "success"
    ERROR   = "error"


class ServiceHealth(str, Enum):
    """Downstream service health states."""
    ONLINE   = "online"
    OFFLINE  = "offline"
    DEGRADED = "degraded"
    UNKNOWN  = "unknown"


# ═══════════════════════════════════════════════════════════════════════
#  ERROR DETAIL
# ═══════════════════════════════════════════════════════════════════════

class ErrorDetail(BaseModel):
    """Structured error payload embedded in ``BaseResponse.error``."""

    code: int = Field(
        ...,
        description="HTTP status code associated with the error.",
    )
    message: str = Field(
        ...,
        description="Human-readable error summary.",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional additional structured error details.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "code": 502,
                "message": "Failed to call downstream clinical service.",
                "details": {"error": "Connection refused"},
            }
        }
    )


# ═══════════════════════════════════════════════════════════════════════
#  BASE RESPONSE — universal JSON envelope
# ═══════════════════════════════════════════════════════════════════════

class BaseResponse(BaseModel):
    """Standardised JSON envelope returned by every Manthana endpoint.

    ``error`` accepts both an ``ErrorDetail`` instance **and** a plain
    ``dict`` (auto-coerced) so that ``format_response()`` can pass raw
    dicts without Pydantic validation overhead at the edge.
    """

    status: str = Field(
        ...,
        description='Overall status: "success" or "error".',
    )
    service: str = Field(
        ...,
        description="Logical service name that produced this response.",
    )
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Successful result payload.",
    )
    error: Optional[Union[ErrorDetail, Dict[str, Any]]] = Field(
        default=None,
        description="Error information when status is 'error'.",
    )
    request_id: str = Field(
        ...,
        description="Per-request unique identifier (UUID-4).",
    )
    disclaimer: Optional[str] = Field(
        default=None,
        description="Medical-use disclaimer when applicable.",
    )

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "status": "success",
                "service": "ai-router",
                "data": {"router": "online"},
                "error": None,
                "request_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
                "disclaimer": None,
            }
        }
    )


# ═══════════════════════════════════════════════════════════════════════
#  HEALTH RESPONSE
# ═══════════════════════════════════════════════════════════════════════

class HealthResponse(BaseModel):
    """Returned by ``GET /health`` on every micro-service."""

    status: str = Field(
        ...,
        description='Health status: typically "healthy" or "degraded".',
    )
    service: str = Field(
        ...,
        description="Logical service name.",
    )
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional additional health details (e.g. GPU status).",
    )
    request_id: str = Field(
        ...,
        description="Per-request unique identifier.",
    )


class RouterHealthData(BaseModel):
    """Payload inside ``BaseResponse.data`` for the router health check."""

    router: str = Field(default="online")
    services: Dict[str, str] = Field(
        default_factory=dict,
        description="Map of service name → status (online/offline/degraded).",
    )
    healthy_count: int = Field(default=0)
    total_count: int = Field(default=0)


# ═══════════════════════════════════════════════════════════════════════
#  FILE ANALYSIS REQUEST
# ═══════════════════════════════════════════════════════════════════════

class FileAnalysisRequest(BaseModel):
    """Generic request schema for router-driven file analysis.

    The actual binary file content is passed separately as ``UploadFile``.
    """

    type_hint: Optional[str] = Field(
        default=None,
        description=(
            "Caller-provided hint for the type of analysis "
            "(e.g. 'xray', 'ecg', 'fundus', 'skin', 'brain')."
        ),
    )
    patient_id: Optional[str] = Field(
        default=None,
        description="Optional patient identifier for audit trails.",
    )
    clinical_notes: Optional[str] = Field(
        default=None,
        description="Optional free-text clinical notes to accompany the file.",
    )
    urgency: Optional[str] = Field(
        default=None,
        description="Priority level: 'routine', 'urgent', or 'stat'.",
    )

    @field_validator("urgency")
    @classmethod
    def _validate_urgency(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        v = v.lower().strip()
        if v not in ("routine", "urgent", "stat"):
            return "routine"
        return v


# ═══════════════════════════════════════════════════════════════════════
#  ORACLE (Q&A) MODELS
# ═══════════════════════════════════════════════════════════════════════

class OracleQueryRequest(BaseModel):
    """Request body for ``POST /query``."""

    query: Optional[str] = Field(default=None, max_length=5000, description="Question text (alias: 'question').")
    question: Optional[str] = Field(default=None, max_length=5000, description="Question text (alias: 'query').")

    @property
    def text(self) -> str:
        return (self.query or self.question or "")[:5000]


class OracleSourceSet(BaseModel):
    """Source breakdown returned in ``POST /query`` data."""

    meilisearch: List[Dict[str, Any]] = Field(default_factory=list)
    qdrant: List[Dict[str, Any]] = Field(default_factory=list)
    perplexica: List[Dict[str, Any]] = Field(default_factory=list)
    combined: List[Dict[str, Any]] = Field(default_factory=list)


class OracleResult(BaseModel):
    """Payload inside ``BaseResponse.data`` for ``POST /query``."""

    question: str
    answer: str
    sources: OracleSourceSet


# ═══════════════════════════════════════════════════════════════════════
#  DEEP RESEARCH MODELS
# ═══════════════════════════════════════════════════════════════════════

class DeepResearchSection(BaseModel):
    """One section of a deep research report."""

    id: str = Field(..., description="Section slug (e.g. 'summary', 'findings').")
    title: str = Field(..., description="Human-readable section title.")
    content: str = Field(..., description="Markdown content of the section.")


class DeepResearchCitation(BaseModel):
    """One citation in a deep research report."""

    id: int = Field(..., description="Citation index (matches [n] in content).")
    authors: str = Field(default="")
    title: str = Field(default="Untitled")
    journal: str = Field(default="")
    year: int = Field(default=0)
    doi: Optional[str] = None
    pmid: Optional[str] = None
    url: Optional[str] = None


class DeepResearchRequest(BaseModel):
    """Request body for ``POST /deep-research``."""

    query: Optional[str] = Field(default=None, max_length=2000, description="Research question.")
    question: Optional[str] = Field(default=None, max_length=2000, description="Alias for query.")
    domains: List[str] = Field(default_factory=list, max_length=20, description="Medical domains (e.g. allopathy, ayurveda).")
    subdomains: List[str] = Field(default_factory=list, max_length=50, description="Subdomain filters.")
    subdomain_map: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Per-domain subdomain ids. Keys = domain ids (allopathy, ayurveda, …).",
    )
    intent: Optional[str] = Field(default="clinical", max_length=100)
    depth: Optional[str] = Field(default="comprehensive", max_length=50)
    sources: List[str] = Field(default_factory=list, max_length=30)
    output_format: Optional[str] = Field(default="structured", max_length=50)
    citation_style: Optional[str] = Field(default="vancouver", max_length=50)
    lang: Optional[str] = Field(default="en", max_length=10)
    deep: Optional[bool] = Field(
        default=True,
        description=(
            "If True: enables query decomposition (when not focused) and source scoring. "
            "If False: fast path — single-query retrieval, no scoring."
        ),
    )
    target_seconds: Optional[float] = Field(
        default=None,
        description="Optional wall-clock cap for retrieval + synthesis (seconds).",
    )

    @model_validator(mode="after")
    def _flatten_subdomains_from_map(self) -> "DeepResearchRequest":
        if self.subdomain_map and not self.subdomains:
            flat: List[str] = []
            for vals in self.subdomain_map.values():
                flat.extend(vals)
            self.subdomains = sorted({str(s) for s in flat})
        return self

    @property
    def question_text(self) -> str:
        return (self.query or self.question or "").strip()[:2000]


class DeepResearchResult(BaseModel):
    """Payload inside ``BaseResponse.data`` for ``POST /deep-research``."""

    query: str
    domains_consulted: List[str] = Field(default_factory=list)
    subdomains_consulted: List[str] = Field(default_factory=list)
    intent: str = Field(default="clinical")
    sections: List[DeepResearchSection] = Field(default_factory=list)
    citations: List[DeepResearchCitation] = Field(default_factory=list)
    sources_searched: int = Field(default=0)
    time_taken_seconds: int = Field(default=0)
    generated_at: str = Field(default="")
    integrative_mode: bool = Field(default=False)
    followup_questions: List[str] = Field(
        default_factory=list,
        description="Suggested follow-up questions (typically 3).",
    )
    citation_style: Optional[str] = Field(
        default=None,
        description="Citation style used for synthesis / export (e.g. vancouver, apa).",
    )
    provider_used: Optional[str] = Field(
        default=None,
        description="LLM provider that produced synthesis (openrouter, ollama).",
    )


# ═══════════════════════════════════════════════════════════════════════
#  SEARCH MODELS (Manthana Web)
# ═══════════════════════════════════════════════════════════════════════

class SearchResult(BaseModel):
    """Single enriched web search result."""

    title: str = ""
    url: str = ""
    snippet: str = ""
    source: str = ""
    domain: str = ""
    engine: str = ""
    publishedDate: Optional[str] = None
    trustScore: int = Field(default=45, ge=0, le=100)
    isPeerReviewed: bool = False
    isOfficial: bool = False
    isOpenAccess: bool = False
    thumbnail: Optional[str] = None
    type: str = Field(default="article", description="article/video/image/pdf/trial/guideline/preprint")


class ImageResult(BaseModel):
    """Single image search result."""

    url: str
    title: str = ""
    source: str = ""
    sourceUrl: str = ""
    thumbnail: str = ""


class VideoResult(BaseModel):
    """Single video search result."""

    url: str
    title: str = ""
    thumbnail: str = ""
    source: str = ""
    publishedDate: str = ""


class SearchResponseData(BaseModel):
    """Payload inside ``BaseResponse.data`` for ``GET /search``."""

    query: str
    category: str = "medical"
    total: int = 0
    page: int = 1
    results: List[SearchResult] = Field(default_factory=list)
    images: List[ImageResult] = Field(default_factory=list)
    videos: List[VideoResult] = Field(default_factory=list)
    relatedQuestions: List[str] = Field(default_factory=list)
    enginesUsed: List[str] = Field(default_factory=list)
    localResults: List[Dict[str, Any]] = Field(default_factory=list)
    elapsed: float = 0.0
    synthesis: Optional[str] = None


# ═══════════════════════════════════════════════════════════════════════
#  CHAT MODELS
# ═══════════════════════════════════════════════════════════════════════

class ChatMessage(BaseModel):
    """Single message in a chat conversation."""

    role: str = Field(default="user", max_length=20, description="'user', 'assistant', or 'system'.")
    content: str = Field(default="", max_length=10000)


class ChatRequest(BaseModel):
    """Request body for ``POST /chat``."""

    message: str = Field(..., min_length=1, max_length=4000, description="User message text.")
    history: List[ChatMessage] = Field(
        default_factory=list,
        max_length=20,
        description="Previous conversation turns.",
    )
    
    # Mode selector fields for Oracle chat customization
    intensity: Optional[str] = Field(
        default="auto",
        max_length=20,
        description="Query intensity: auto | quick | clinical | deep",
    )
    persona: Optional[str] = Field(
        default="auto",
        max_length=20,
        description="User persona: auto | patient | clinician | researcher | student",
    )
    evidence: Optional[str] = Field(
        default="auto",
        max_length=20,
        description="Evidence filter: auto | gold | all | guidelines | trials",
    )
    domain: Optional[str] = Field(
        default="allopathy",
        max_length=50,
        description="Medical domain context.",
    )
    enable_web: Optional[bool] = Field(
        default=True,
        description="When true, include SearXNG web search results in chat context.",
    )
    enable_trials: Optional[bool] = Field(
        default=False,
        description="When true, include ClinicalTrials.gov results in chat context.",
    )
    experiment_id: Optional[str] = Field(
        default=None,
        max_length=64,
        description="A/B test experiment identifier for analytics.",
    )
    lang: Optional[str] = Field(
        default="en",
        max_length=10,
        description="Language code.",
    )


# ═══════════════════════════════════════════════════════════════════════
#  REPORT ENRICHMENT MODELS
# ═══════════════════════════════════════════════════════════════════════

class ReportEnrichFinding(BaseModel):
    """Single finding for report enrichment."""

    label: str = Field(..., min_length=1, max_length=500, description="Finding label (e.g. pleural effusion).")
    confidence: Optional[Union[int, float]] = Field(default=None, ge=0, le=100)
    severity: Optional[str] = Field(default=None, max_length=50)


class ReportEnrichRequest(BaseModel):
    """Request body for ``POST /report/enrich``."""

    modality: str = Field(..., min_length=1, max_length=100, description="Imaging modality (e.g. chest_xray, mammogram).")
    findings: List[ReportEnrichFinding] = Field(
        ...,
        min_length=1,
        max_length=200,
        description="List of findings with label, confidence, severity.",
    )


# ═══════════════════════════════════════════════════════════════════════
#  PLAGIARISM MODELS
# ═══════════════════════════════════════════════════════════════════════

class PlagiarismCheckRequest(BaseModel):
    """Request body for ``POST /plagiarism/check``."""

    text: str = Field(..., min_length=1, max_length=100000, description="Full text to check for originality.")
    scanId: Optional[str] = Field(default=None, max_length=100, description="Client-provided scan identifier.")

    @field_validator("text")
    @classmethod
    def _validate_min_words(cls, v: str) -> str:
        words = v.split()
        if len(words) < 50:
            raise ValueError("Minimum 50 words required for analysis")
        return v[:100000]


class PlagiarismHealthResponse(BaseModel):
    """Response for ``GET /plagiarism/health``."""

    status: str = Field(default="ok")
    layers: List[str] = Field(
        default_factory=lambda: ["sentence-transformers", "searxng", "qdrant"],
    )
    cost: str = Field(default="₹0")


# ═══════════════════════════════════════════════════════════════════════
#  DRUG / HERB-DRUG / CLINICAL TRIALS
# ═══════════════════════════════════════════════════════════════════════

class DrugInteractionRequest(BaseModel):
    """Request body for ``POST /interaction/check`` and ``POST /drug-interaction/check``."""

    drugs: List[str] = Field(..., min_length=1, max_length=20, description="List of drug names to check.")


class InteractionCheckEnrichedRequest(BaseModel):
    """Request body for ``POST /interaction/check/enriched``."""

    drug_a: Optional[str] = Field(default=None, max_length=200, description="First drug.")
    drugA: Optional[str] = Field(default=None, max_length=200, description="Alias for drug_a.")
    drug_b: Optional[str] = Field(default=None, max_length=200, description="Second drug.")
    drugB: Optional[str] = Field(default=None, max_length=200, description="Alias for drug_b.")

    @property
    def drug_a_val(self) -> str:
        return (self.drug_a or self.drugA or "").strip()

    @property
    def drug_b_val(self) -> str:
        return (self.drug_b or self.drugB or "").strip()


class HerbDrugRequest(BaseModel):
    """Request body for ``POST /herb-drug/analyze``."""

    herb: str = Field(..., min_length=1, max_length=200, description="Herb name.")
    drug: str = Field(..., min_length=1, max_length=200, description="Drug name.")


class ClinicalTrialsSearchRequest(BaseModel):
    """Request body for ``POST /clinical-trials/search``."""

    query: str = Field(..., min_length=1, max_length=500, description="Search query (condition, drug, intervention).")
    filters: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Optional filters (phase, status, india_only, etc.).")


class ReportPdfRequest(BaseModel):
    """Request body for ``POST /report/pdf`` — flexible for downstream API."""

    model_config = ConfigDict(extra="allow")


# ═══════════════════════════════════════════════════════════════════════
#  SERVICE CATALOG
# ═══════════════════════════════════════════════════════════════════════

class ServiceCapability(BaseModel):
    """Descriptor for a single downstream clinical service."""

    port: int
    url: str = ""
    capabilities: List[str] = Field(default_factory=list)


class ServiceCatalog(BaseModel):
    """Payload inside ``BaseResponse.data`` for ``GET /services``."""

    services: Dict[str, ServiceCapability] = Field(default_factory=dict)
