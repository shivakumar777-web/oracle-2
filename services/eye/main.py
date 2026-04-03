import sys
import os
import io
import logging
from typing import Dict, Optional

# Add project root to path for shared module access
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Add ai-tools to path
AI_TOOLS = os.path.join(PROJECT_ROOT, "ai-tools")
if AI_TOOLS not in sys.path:
    sys.path.insert(0, AI_TOOLS)

import numpy as np
try:
    import torch
except ImportError:
    torch = None
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id


logger = logging.getLogger("manthana-eye")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


DR_RECOMMENDATIONS: Dict[int, str] = {
    0: "Annual monitoring",
    1: "6-month follow-up",
    2: "Refer ophthalmologist within 1 month",
    3: "Urgent ophthalmology referral within 1 week",
    4: "Emergency — same day ophthalmology",
}

DR_SEVERITY: Dict[int, str] = {
    0: "No DR",
    1: "Mild",
    2: "Moderate",
    3: "Severe",
    4: "Proliferative",
}


class DRResult(BaseModel):
    grade: int
    severity: str
    confidence: float
    recommendation: str


try:
    from transformers import pipeline  # type: ignore[import]

    _TRANSFORMERS_AVAILABLE = True
except Exception:  # pragma: no cover
    pipeline = None  # type: ignore[assignment]
    _TRANSFORMERS_AVAILABLE = False

DR_MODEL = None
DR_DEVICE = "cpu"
DR_MODEL_ID = "ClementP/FundusDRGrading-resnet50"


def _label_to_grade(label: str) -> Optional[int]:
    l = (label or "").lower()
    # Common label styles
    if l in {"0", "no_dr", "no dr", "nodr"}:
        return 0
    if "mild" in l or l == "1":
        return 1
    if "moderate" in l or l == "2":
        return 2
    if "severe" in l or l == "3":
        return 3
    if "prolifer" in l or "pdr" in l or l == "4":
        return 4
    # Sometimes labels like "grade_2"
    for g in range(5):
        if f"grade_{g}" in l or f"grade {g}" in l:
            return g
    return None


def _load_dr_model() -> None:
    """Load a fine-tuned DR grading model once at startup.

    Uses HuggingFace `image-classification` pipeline for CPU inference.
    Falls back to heuristic if anything fails.
    """
    global DR_MODEL
    if not _TRANSFORMERS_AVAILABLE or pipeline is None:
        DR_MODEL = None
        logger.warning("transformers not available; DR model disabled (heuristic fallback).")
        return
    try:
        DR_MODEL = pipeline(
            "image-classification",
            model=os.getenv("EYE_DR_MODEL_ID", DR_MODEL_ID),
            device=-1,
        )
        logger.info("Loaded DR model pipeline: %s", os.getenv("EYE_DR_MODEL_ID", DR_MODEL_ID))
    except Exception as exc:  # pragma: no cover
        DR_MODEL = None
        logger.warning("Failed to load DR model, using heuristic fallback: %s", exc)


def estimate_dr_grade(image: Image.Image) -> DRResult:
    arr = np.asarray(image.convert("L")).astype("float32")
    intensity = arr.mean() / 255.0
    grade = int(min(4, max(0, round(intensity * 4))))
    raw_confidence = float(max(0.5, 0.5 + (intensity - 0.5) * 0.5))
    confidence = float(min(0.65, raw_confidence))
    return DRResult(
        grade=grade,
        severity=DR_SEVERITY[grade],
        confidence=confidence,
        recommendation=DR_RECOMMENDATIONS[grade],
    )


def estimate_dr_grade_ml(image: Image.Image) -> Optional[DRResult]:
    """Estimate DR grade using the HF DR pipeline, if available."""
    if DR_MODEL is None:
        return None
    try:
        outs = DR_MODEL(image.convert("RGB"))
        best = outs[0] if outs else {"label": "unknown", "score": 0.0}
        grade = _label_to_grade(str(best.get("label", "")))
        if grade is None:
            return None
        confidence = float(min(0.82, float(best.get("score", 0.0))))
        return DRResult(
            grade=grade,
            severity=DR_SEVERITY[grade],
            confidence=confidence,
            recommendation=DR_RECOMMENDATIONS[grade],
        )
    except Exception as exc:  # pragma: no cover - robust to runtime issues
        logger.warning("DR ML inference failed, falling back to heuristic: %s", exc)
        return None


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Eye Service",
        description="Diabetic retinopathy and OCT screening.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            os.getenv("FRONTEND_URL", "http://localhost:3001"),
            "http://localhost:3000",
            "http://localhost:3001",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # Attempt to load DR model at startup
    _load_dr_model()

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the eye service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="eye",
            details=None,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Service information.",
    )
    async def info(request: Request):
        request_id = generate_request_id()
        data = {
            "service": "eye",
            "dr_grades": DR_SEVERITY,
            "model": (os.getenv("EYE_DR_MODEL_ID", DR_MODEL_ID) if DR_MODEL is not None else "heuristic-intensity"),
        }
        payload = format_response(
            status="success",
            service="eye",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/fundus",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze fundus image for diabetic retinopathy grade.",
    )
    async def analyze_fundus(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            ml_result = estimate_dr_grade_ml(img)
            if ml_result is not None:
                result = ml_result
                model_used = os.getenv("EYE_DR_MODEL_ID", DR_MODEL_ID)
                model_type = "ml_experimental"
                validated = False
                disclaimer = (
                    "Screening aid only. Validated on EyePACS-style datasets. "
                    "Independent clinical validation is required for the Indian population. "
                    "EyePACS/US cohort. DermaCon-IN or India-specific validation pending."
                )
            else:
                result = estimate_dr_grade(img)
                # Heuristic fallback: cap confidence at 0.50 as per spec
                result.confidence = float(min(result.confidence, 0.50))
                model_used = "heuristic-intensity"
                model_type = "heuristic"
                validated = False
                disclaimer = (
                    "This analysis uses statistical image features, not a validated clinical AI model. "
                    "Results must be interpreted by a qualified medical professional."
                )
        except Exception as exc:
            logger.exception("Fundus analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze fundus image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="eye",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = result.dict()
        data["model"] = model_used
        data["model_type"] = model_type
        data["validated"] = validated
        data["disclaimer"] = disclaimer
        if ml_result is not None:
            data["validation_note"] = "EyePACS/US cohort. DermaCon-IN or India-specific validation pending."
        payload = format_response(
            status="success",
            service="eye",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/oct",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Basic OCT scan analysis using the same severity scheme.",
    )
    async def analyze_oct(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = estimate_dr_grade(img)
        except Exception as exc:
            logger.exception("OCT analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze OCT image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="eye",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = result.dict()
        data["model_type"] = "heuristic"
        data["validated"] = False
        data[
            "disclaimer"
        ] = (
            "This analysis uses statistical image features, not a validated clinical AI model. "
            "Results must be interpreted by a qualified medical professional."
        )
        payload = format_response(
            status="success",
            service="eye",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

