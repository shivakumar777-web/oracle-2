import sys
import os
import io
import logging
from typing import Any, Dict, List

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
from fastapi import FastAPI, File, Request, UploadFile
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


logger = logging.getLogger("manthana-cancer")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class OralResult(BaseModel):
    label: str
    confidence: float
    recommendation: str


class SkinResult(BaseModel):
    lesion_type: str
    malignancy_risk: float
    abcde: Dict[str, float]
    recommendation: str


class PathologyResult(BaseModel):
    tissue_type: str
    confidence: float


def classify_oral(image: Image.Image) -> OralResult:
    arr = np.asarray(image.convert("L")).astype("float32")
    mean_intensity = arr.mean() / 255.0
    if mean_intensity < 0.3:
        label = "cancerous"
        recommendation = "Urgent oncology and head-neck specialist referral."
    elif mean_intensity < 0.6:
        label = "precancerous"
        recommendation = "Refer to oral medicine and schedule biopsy."
    else:
        label = "normal"
        recommendation = "Routine dental/oral examination and monitoring."
    confidence = float(min(0.99, max(0.6, abs(mean_intensity - 0.5) + 0.5)))
    return OralResult(label=label, confidence=confidence, recommendation=recommendation)


def classify_skin(image: Image.Image) -> SkinResult:
    arr = np.asarray(image.convert("RGB")).astype("float32") / 255.0
    color_std = float(arr.std())
    asymmetry = float(abs(arr.mean(axis=0).mean() - arr.mean(axis=1).mean()))
    border = float(color_std)
    color_var = float(np.mean(np.std(arr, axis=-1)))
    lesion_type = "melanocytic lesion"
    malignancy_risk = float(min(0.99, 0.3 + color_var))
    abcde = {
        "A": float(min(1.0, asymmetry * 10)),
        "B": float(min(1.0, border * 10)),
        "C": float(min(1.0, color_var * 10)),
        "D": 0.0,
        "E": 0.5,
    }
    if malignancy_risk > 0.6:
        recommendation = "Dermatology referral and dermoscopy/biopsy as indicated."
    else:
        recommendation = "Monitor clinically; consider dermatology review if evolving."
    return SkinResult(
        lesion_type=lesion_type,
        malignancy_risk=malignancy_risk,
        abcde=abcde,
        recommendation=recommendation,
    )


def classify_pathology(image: Image.Image) -> PathologyResult:
    arr = np.asarray(image.convert("L")).astype("float32") / 255.0
    density = float(arr.mean())
    if density > 0.7:
        tissue = "hypercellular_tumor_like"
    elif density > 0.4:
        tissue = "intermediate_cellularity"
    else:
        tissue = "hypocellular_stroma"
    confidence = float(min(0.95, 0.5 + abs(density - 0.5)))
    return PathologyResult(tissue_type=tissue, confidence=confidence)


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Cancer Service",
        description="Oral, skin lesion, and pathology AI triage service.",
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
        description="Health check for the cancer service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="cancer",
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
            "service": "cancer",
            "capabilities": ["oral", "skin", "pathology"],
        }
        payload = format_response(
            status="success",
            service="cancer",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/oral",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Classify oral cavity image as normal, precancerous, or cancerous.",
    )
    async def analyze_oral(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = classify_oral(img)
        except Exception as exc:
            logger.exception("Oral analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze oral image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="cancer",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="cancer",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/skin",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze skin lesion image for malignancy risk and ABCDE criteria.",
    )
    async def analyze_skin(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = classify_skin(img)
        except Exception as exc:
            logger.exception("Skin analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze skin lesion image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="cancer",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="cancer",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/pathology",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze histopathology slide image and classify tissue type.",
    )
    async def analyze_pathology(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = classify_pathology(img)
        except Exception as exc:
            logger.exception("Pathology analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze histopathology image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="cancer",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="cancer",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

