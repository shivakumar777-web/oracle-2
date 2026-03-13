from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class ErrorDetail(BaseModel):
    code: int = Field(..., description="HTTP status code associated with the error.")
    message: str = Field(..., description="Human-readable error summary.")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional additional structured error details.",
    )


class BaseResponse(BaseModel):
    status: str = Field(..., description='Overall status: "success" or "error".')
    service: str = Field(..., description="Logical service name.")
    data: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Successful result payload.",
    )
    error: Optional[ErrorDetail] = Field(
        default=None,
        description="Error information when status is error.",
    )
    request_id: str = Field(..., description="Per-request unique identifier.")
    disclaimer: Optional[str] = Field(
        default=None,
        description="Medical use disclaimer when applicable.",
    )


class HealthResponse(BaseModel):
    status: str = Field(..., description='Health status: typically "healthy".')
    service: str = Field(..., description="Logical service name.")
    details: Optional[Dict[str, Any]] = Field(
        default=None,
        description="Optional additional health details.",
    )
    request_id: str = Field(..., description="Per-request unique identifier.")


class FileAnalysisRequest(BaseModel):
    """
    Generic request schema for router-driven file analysis endpoints.
    Note that the actual binary file content is passed separately as UploadFile.
    """

    type_hint: Optional[str] = Field(
        default=None,
        description="Optional caller-provided hint for the type of analysis.",
    )
    patient_id: Optional[str] = Field(
        default=None,
        description="Optional patient identifier for audit trails.",
    )

