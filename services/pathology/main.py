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


logger = logging.getLogger("manthana-pathology")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class SlideRegion(BaseModel):
    x: int
    y: int
    width: int
    height: int
    label: str
    abnormality_score: float


class SlideAnalysis(BaseModel):
    tissue_type: str
    cell_density: float
    abnormality_score: float
    regions: List[SlideRegion]


class TileAnalysis(BaseModel):
    classification: str
    confidence: float


def analyze_slide_image(image: Image.Image) -> SlideAnalysis:
    arr = np.asarray(image.convert("L")).astype("float32") / 255.0
    cell_density = float(arr.mean())
    abnormality = float(min(1.0, abs(cell_density - 0.5) * 2))
    tissue = "tumor" if abnormality > 0.6 else "benign_like"
    h, w = arr.shape
    regions = [
        SlideRegion(
            x=int(w * 0.25),
            y=int(h * 0.25),
            width=int(w * 0.2),
            height=int(h * 0.2),
            label="region_of_interest",
            abnormality_score=abnormality,
        )
    ]
    return SlideAnalysis(
        tissue_type=tissue,
        cell_density=cell_density,
        abnormality_score=abnormality,
        regions=regions,
    )


def analyze_tile(image: Image.Image) -> TileAnalysis:
    arr = np.asarray(image.convert("L")).astype("float32") / 255.0
    intensity = float(arr.mean())
    if intensity > 0.6:
        classification = "high_cellularity"
    elif intensity > 0.3:
        classification = "intermediate_cellularity"
    else:
        classification = "low_cellularity"
    confidence = float(0.5 + abs(intensity - 0.5))
    return TileAnalysis(classification=classification, confidence=min(0.99, confidence))


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Pathology Service",
        description="Digital pathology analysis for WSI and tiles.",
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
        description="Health check for the pathology service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="pathology",
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
            "service": "pathology",
            "capabilities": ["slide", "tile"],
        }
        payload = format_response(
            status="success",
            service="pathology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/slide",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze a whole slide image or large tile.",
    )
    async def analyze_slide(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = analyze_slide_image(img)
        except Exception as exc:
            logger.exception("Slide analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze slide.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="pathology",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="pathology",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/tile",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze a 224x224 patch from a histopathology slide.",
    )
    async def analyze_tile_endpoint(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            result = analyze_tile(img)
        except Exception as exc:
            logger.exception("Tile analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze tile.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="pathology",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="pathology",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

