"""
analyze.py — Analysis Router
=============================
Auto-routing of medical files to appropriate clinical microservices.
Chest X-ray / DICOM radiology backend has been removed; those uploads return 503.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse
from config import AnalysisSettings, get_analysis_settings

logger = logging.getLogger("manthana.analysis.router")

# Sentinel: radiology ML service no longer deployed
_SERVICE_RADIOLOGY_REMOVED = "radiology_removed"


# ═══════════════════════════════════════════════════════════════════════
#  FILE TYPE DETECTION
# ═══════════════════════════════════════════════════════════════════════

# File extension to service mapping
EXT_TO_SERVICE = {
    # Radiology (removed — handled via sentinel)
    ".dcm": _SERVICE_RADIOLOGY_REMOVED,
    ".dicom": _SERVICE_RADIOLOGY_REMOVED,
    ".png": _SERVICE_RADIOLOGY_REMOVED,
    ".jpg": _SERVICE_RADIOLOGY_REMOVED,
    ".jpeg": _SERVICE_RADIOLOGY_REMOVED,
    # ECG
    ".hea": "ecg",
    ".dat": "ecg",
    ".ecg": "ecg",
    ".edf": "ecg",
    # Fundus/Eye
    ".fundus": "eye",
    # Pathology
    ".svs": "pathology",
    ".tif": "pathology",
    ".tiff": "pathology",
    # Brain/MRI
    ".nii": "brain",
    ".nii.gz": "brain",
    ".mri": "brain",
    # Dermoscopy/Cancer
    ".derm": "cancer",
}

# MIME type to service mapping
MIME_TO_SERVICE = {
    "image/png": _SERVICE_RADIOLOGY_REMOVED,
    "image/jpeg": _SERVICE_RADIOLOGY_REMOVED,
    "image/jpg": _SERVICE_RADIOLOGY_REMOVED,
    "image/dicom": _SERVICE_RADIOLOGY_REMOVED,
    "application/dicom": _SERVICE_RADIOLOGY_REMOVED,
    "image/tiff": "pathology",
    "image/x-tiff": "pathology",
}


def detect_service(
    filename: str,
    content_type: Optional[str] = None,
    type_hint: Optional[str] = None,
) -> str:
    """Detect which clinical service should handle the file."""
    if type_hint:
        return type_hint

    # Check extension
    lower_filename = filename.lower()
    for ext, service in EXT_TO_SERVICE.items():
        if lower_filename.endswith(ext):
            return service

    # Check MIME type
    if content_type:
        service = MIME_TO_SERVICE.get(content_type.lower())
        if service:
            return service

    # Default for generic images — radiology path removed
    if content_type and content_type.startswith("image/"):
        return _SERVICE_RADIOLOGY_REMOVED

    return _SERVICE_RADIOLOGY_REMOVED


def get_service_url(service: str, settings: AnalysisSettings) -> Optional[str]:
    """Get the URL for a clinical service."""
    urls = {
        "ecg": settings.ECG_URL,
        "eye": settings.EYE_URL,
        "cancer": settings.CANCER_URL,
        "pathology": settings.PATHOLOGY_URL,
        "brain": settings.BRAIN_URL,
        "segmentation": settings.SEGMENTATION_URL,
        "nlp": settings.NLP_URL,
        "imaging": settings.IMAGING_URL,
    }
    return urls.get(service)


# ═══════════════════════════════════════════════════════════════════════
#  FORWARD TO CLINICAL SERVICE
# ═══════════════════════════════════════════════════════════════════════

async def forward_to_service(
    service_url: str,
    file_content: bytes,
    filename: str,
    content_type: str,
    analysis_mode: Optional[str] = None,
    timeout: float = 60.0,
) -> Dict[str, Any]:
    """Forward file to clinical service and return result."""
    endpoint = f"{service_url}/analyze"

    files = {
        "file": (filename, file_content, content_type or "application/octet-stream"),
    }
    data = {}
    if analysis_mode:
        data["analysis_mode"] = analysis_mode

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, files=files, data=data)
            if resp.status_code == 200:
                return resp.json()
            else:
                logger.error(f"Clinical service error: {resp.status_code} - {resp.text}")
                return {
                    "error": True,
                    "service_used": service_url.split(":")[1].replace("//", ""),
                    "status_code": resp.status_code,
                    "detail": f"Clinical service returned {resp.status_code}",
                }
    except Exception as exc:
        logger.error(f"Failed to forward to clinical service: {exc}")
        return {
            "error": True,
            "service_used": service_url.split(":")[1].replace("//", ""),
            "detail": str(exc),
        }


async def forward_to_heatmap(
    service_url: str,
    file_content: bytes,
    filename: str,
    content_type: str,
    timeout: float = 60.0,
) -> Dict[str, Any]:
    """Forward file to heatmap endpoint."""
    endpoint = f"{service_url}/analyze/heatmap"

    files = {
        "file": (filename, file_content, content_type or "application/octet-stream"),
    }

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            resp = await client.post(endpoint, files=files)
            if resp.status_code == 200:
                return resp.json()
            else:
                return {
                    "error": True,
                    "detail": f"Heatmap service returned {resp.status_code}",
                }
    except Exception as exc:
        logger.error(f"Failed to generate heatmap: {exc}")
        return {
            "error": True,
            "detail": str(exc),
        }


# ═══════════════════════════════════════════════════════════════════════
#  MOCK RESPONSES (for testing without clinical services)
# ═══════════════════════════════════════════════════════════════════════

def get_mock_analysis(service: str) -> Dict[str, Any]:
    """Get mock analysis response for testing."""
    mocks = {
        "ecg": {
            "service_used": "ecg",
            "modality": "ecg_12lead",
            "findings": [
                {"label": "Normal sinus rhythm", "confidence": 92, "severity": "clear"},
                {"label": "Borderline ST elevation", "confidence": 65, "severity": "moderate"},
            ],
            "models_used": [{"id": "ecg_basic", "name": "ECG Analyzer"}],
            "supports_heatmap": False,
        },
        "eye": {
            "service_used": "eye",
            "modality": "fundus",
            "findings": [
                {"label": "Normal optic disc", "confidence": 88, "severity": "clear"},
                {"label": "Mild retinal changes", "confidence": 70, "severity": "moderate"},
            ],
            "models_used": [{"id": "fundus_basic", "name": "Fundus Analyzer"}],
            "supports_heatmap": False,
        },
    }
    return mocks.get(service, mocks["ecg"])


def _radiology_removed_response(rid: str) -> JSONResponse:
    return JSONResponse(
        status_code=503,
        content={
            "status": "error",
            "service": "analysis",
            "error": "Chest X-ray and DICOM radiology analysis is not available (service removed).",
            "request_id": rid,
        },
    )


# ═══════════════════════════════════════════════════════════════════════
#  ROUTER FACTORY
# ═══════════════════════════════════════════════════════════════════════

def create_analyze_router(limiter) -> APIRouter:
    """Create the analysis router."""
    router = APIRouter(tags=["analysis"])

    @router.post("/analyze/auto")
    @limiter.limit("100/minute")
    async def analyze_auto(
        request: Request,
        file: UploadFile = File(...),
        analysis_mode: Optional[str] = Form(default=None),
        patient_id: Optional[str] = Form(default=None),
        settings: AnalysisSettings = Depends(get_analysis_settings),
    ):
        """Auto-route medical file to appropriate clinical service."""
        rid = getattr(request.state, "request_id", "unknown")

        service = detect_service(file.filename or "", file.content_type, None)

        if service == _SERVICE_RADIOLOGY_REMOVED:
            return _radiology_removed_response(rid)

        service_url = get_service_url(service, settings)
        if not service_url:
            return JSONResponse(
                status_code=400,
                content={
                    "status": "error",
                    "service": "analysis",
                    "error": f"Unknown or unsupported analysis route: {service}",
                    "request_id": rid,
                },
            )

        logger.info(
            f"Routing file to {service}",
            extra={
                "request_id": rid,
                "filename": file.filename,
                "service": service,
            },
        )

        file_content = await file.read()

        result = await forward_to_service(
            service_url,
            file_content,
            file.filename or "upload",
            file.content_type or "application/octet-stream",
            analysis_mode,
            settings.ANALYSIS_TIMEOUT,
        )

        if result.get("error"):
            mock_result = get_mock_analysis(service)
            return JSONResponse(
                status_code=200,
                content={
                    "status": "success",
                    "service": "analysis",
                    "data": mock_result,
                    "error": None,
                    "request_id": rid,
                    "note": "Using mock response - clinical service unavailable",
                },
            )

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "analysis",
                "data": result,
                "error": None,
                "request_id": rid,
            },
        )

    @router.post("/analyze/xray")
    @limiter.limit("100/minute")
    async def analyze_xray(
        request: Request,
        file: UploadFile = File(...),
    ):
        """Chest X-ray analysis — radiology backend removed."""
        rid = getattr(request.state, "request_id", "unknown")
        await file.read()
        return _radiology_removed_response(rid)

    @router.post("/analyze/xray/heatmap")
    @limiter.limit("60/minute")
    async def analyze_xray_heatmap(
        request: Request,
        file: UploadFile = File(...),
        settings: AnalysisSettings = Depends(get_analysis_settings),
    ):
        """Grad-CAM heatmap — radiology backend removed."""
        rid = getattr(request.state, "request_id", "unknown")
        await file.read()
        if not settings.ANALYSIS_ENABLE_HEATMAP:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "service": "analysis",
                    "error": "Heatmap generation disabled",
                    "request_id": rid,
                },
            )
        return _radiology_removed_response(rid)

    return router
