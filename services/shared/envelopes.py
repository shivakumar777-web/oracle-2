"""
envelopes.py — Service-Specific Response Envelopes
=====================================================
Versioned response envelopes for each service.
Provides type-safe, service-specific response formats.
"""

from __future__ import annotations

from typing import Any, Dict, Generic, List, Optional, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


# ═══════════════════════════════════════════════════════════════════════
#  BASE ENVELOPE
# ═══════════════════════════════════════════════════════════════════════

class BaseEnvelope(BaseModel, Generic[T]):
    """Base response envelope with generic data field."""

    status: str = Field(default="success", description="Overall status: success or error")
    service: str = Field(default="unknown", description="Service that produced this response")
    version: str = Field(default="1.0", description="Envelope version")
    data: Optional[T] = Field(default=None, description="Response data")
    error: Optional[Dict[str, Any]] = Field(default=None, description="Error details if status is error")
    request_id: str = Field(default="", description="Unique request ID for tracing")

    class Config:
        json_encoders = {
            # Add custom encoders if needed
        }


# ═══════════════════════════════════════════════════════════════════════
#  ORACLE SERVICE ENVELOPES
# ═══════════════════════════════════════════════════════════════════════

class OracleChatData(BaseModel):
    """Oracle chat response data."""
    response: str = ""
    sources: List[Dict[str, Any]] = Field(default_factory=list)
    model: str = ""
    tokens_used: int = 0
    streaming: bool = False


class OracleM5Data(BaseModel):
    """Oracle M5 response data."""
    domain_answers: List[Dict[str, Any]] = Field(default_factory=list)
    integrative_summary: str = ""
    domains_consulted: List[str] = Field(default_factory=list)


class OracleResponse(BaseEnvelope[T]):
    """Oracle service response envelope."""
    service: str = "oracle"
    version: str = "1.0"


# ═══════════════════════════════════════════════════════════════════════
#  WEB SERVICE ENVELOPES
# ═══════════════════════════════════════════════════════════════════════

class WebSearchData(BaseModel):
    """Web search response data."""
    query: str = ""
    category: str = "medical"
    total: int = 0
    page: int = 1
    results: List[Dict[str, Any]] = Field(default_factory=list)
    images: List[Dict[str, Any]] = Field(default_factory=list)
    videos: List[Dict[str, Any]] = Field(default_factory=list)
    related_questions: List[str] = Field(default_factory=list)
    engines_used: List[str] = Field(default_factory=list)
    local_results: List[Dict[str, Any]] = Field(default_factory=list)
    elapsed_ms: int = 0
    synthesis: Optional[str] = None  # Always null for Web service


class WebAutocompleteData(BaseModel):
    """Web autocomplete response data."""
    query: str = ""
    suggestions: List[str] = Field(default_factory=list)
    category: str = "medical"


class WebResponse(BaseEnvelope[T]):
    """Web service response envelope."""
    service: str = "web"
    version: str = "1.0"


# ═══════════════════════════════════════════════════════════════════════
#  RESEARCH SERVICE ENVELOPES
# ═══════════════════════════════════════════════════════════════════════

class ResearchDeepResearchData(BaseModel):
    """Deep research response data."""
    query: str = ""
    domains_consulted: List[str] = Field(default_factory=list)
    sections: List[Dict[str, Any]] = Field(default_factory=list)
    citations: List[Dict[str, Any]] = Field(default_factory=list)
    sources_searched: int = 0
    time_taken_seconds: float = 0.0
    sections_count: int = 0
    citations_count: int = 0


class ResearchPlagiarismData(BaseModel):
    """Plagiarism check response data."""
    originality_score: float = 0.0
    matched_percent: float = 0.0
    matches: List[Dict[str, Any]] = Field(default_factory=list)
    sentences_analysed: int = 0
    sources_searched: int = 0
    scan_id: str = ""


class ResearchResponse(BaseEnvelope[T]):
    """Research service response envelope."""
    service: str = "research"
    version: str = "1.0"


# ═══════════════════════════════════════════════════════════════════════
#  ANALYSIS SERVICE ENVELOPES
# ═══════════════════════════════════════════════════════════════════════

class AnalysisImageData(BaseModel):
    """Image analysis response data."""
    service_used: str = ""
    modality: str = ""
    findings: List[Dict[str, Any]] = Field(default_factory=list)
    report: str = ""
    model: str = ""
    models_used: List[Dict[str, Any]] = Field(default_factory=list)
    supports_heatmap: bool = False


class AnalysisHeatmapData(BaseModel):
    """Heatmap generation response data."""
    heatmap_base64: str = ""
    heatmap_pathology: str = ""
    heatmap_confidence: float = 0.0
    findings: List[Dict[str, Any]] = Field(default_factory=list)


class AnalysisReportData(BaseModel):
    """Report enrichment response data."""
    enriched_findings: List[Dict[str, Any]] = Field(default_factory=list)
    rads_score: Optional[Dict[str, Any]] = None
    triage_level: str = "ROUTINE"
    impression: str = ""
    report_standard: str = ""


class AnalysisResponse(BaseEnvelope[T]):
    """Analysis service response envelope."""
    service: str = "analysis"
    version: str = "1.0"


# ═══════════════════════════════════════════════════════════════════════
#  UNIFIED/GATEWAY ENVELOPES
# ═══════════════════════════════════════════════════════════════════════

class HealthData(BaseModel):
    """Health check response data."""
    status: str = "healthy"
    services: Dict[str, Any] = Field(default_factory=dict)


class QueryData(BaseModel):
    """Query response data."""
    question: str = ""
    answer: str = ""
    sources: Dict[str, Any] = Field(default_factory=dict)


class UnifiedResponse(BaseEnvelope[T]):
    """Unified gateway response envelope."""
    service: str = "gateway"
    version: str = "1.0"


# ═══════════════════════════════════════════════════════════════════════
#  HELPER FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def create_success_response(
    service: str,
    data: Any,
    request_id: str = "",
    version: str = "1.0",
) -> Dict[str, Any]:
    """Create a standardized success response."""
    return {
        "status": "success",
        "service": service,
        "version": version,
        "data": data,
        "error": None,
        "request_id": request_id,
    }


def create_error_response(
    service: str,
    code: int,
    message: str,
    request_id: str = "",
    details: Optional[Dict[str, Any]] = None,
    version: str = "1.0",
) -> Dict[str, Any]:
    """Create a standardized error response."""
    return {
        "status": "error",
        "service": service,
        "version": version,
        "data": None,
        "error": {
            "code": code,
            "message": message,
            "details": details or {},
        },
        "request_id": request_id,
    }


# Service-specific response creators
def create_oracle_response(data: Any, request_id: str = "") -> Dict[str, Any]:
    """Create Oracle service response."""
    return create_success_response("oracle", data, request_id, "1.0")


def create_web_response(data: Any, request_id: str = "") -> Dict[str, Any]:
    """Create Web service response."""
    return create_success_response("web", data, request_id, "1.0")


def create_research_response(data: Any, request_id: str = "") -> Dict[str, Any]:
    """Create Research service response."""
    return create_success_response("research", data, request_id, "1.0")


def create_analysis_response(data: Any, request_id: str = "") -> Dict[str, Any]:
    """Create Analysis service response."""
    return create_success_response("analysis", data, request_id, "1.0")
