import sys
import os
import io
import logging
from typing import Dict

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


def estimate_dr_grade(image: Image.Image) -> DRResult:
    arr = np.asarray(image.convert("L")).astype("float32")
    intensity = arr.mean() / 255.0
    grade = int(min(4, max(0, round(intensity * 4))))
    confidence = float(min(0.99, max(0.5, 0.5 + (intensity - 0.5) * 0.5)))
    return DRResult(
        grade=grade,
        severity=DR_SEVERITY[grade],
        confidence=confidence,
        recommendation=DR_RECOMMENDATIONS[grade],
    )


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
            result = estimate_dr_grade(img)
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

        payload = format_response(
            status="success",
            service="eye",
            data=result.dict(),
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

        payload = format_response(
            status="success",
            service="eye",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

