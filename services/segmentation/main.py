import sys
import os
import base64
import io
import logging
from typing import Any, Dict, List, Tuple

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
from fastapi import FastAPI, File, Form, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel
from skimage import measure
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id


logger = logging.getLogger("manthana-segmentation")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class SegmentationResult(BaseModel):
    mask_png_base64: str
    contours: List[List[Tuple[float, float]]]
    area_pixels: int
    area_cm2: float


def simple_threshold_segmentation(image: Image.Image) -> np.ndarray:
    gray = np.asarray(image.convert("L")).astype("float32")
    thresh = gray.mean()
    mask = (gray > thresh).astype("uint8")
    return mask


def mask_to_contours(mask: np.ndarray) -> List[List[Tuple[float, float]]]:
    contours = measure.find_contours(mask, 0.5)
    return [[(float(y), float(x)) for x, y in c] for c in contours]


def encode_mask_png(mask: np.ndarray) -> str:
    img = Image.fromarray((mask * 255).astype("uint8"))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Segmentation Service",
        description="Medical image segmentation utilities.",
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
        description="Health check for the segmentation service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="segmentation",
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
            "service": "segmentation",
            "capabilities": ["auto", "interactive", "organ"],
        }
        payload = format_response(
            status="success",
            service="segmentation",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    def build_result(mask: np.ndarray, pixel_spacing: Tuple[float, float]) -> SegmentationResult:
        contours = mask_to_contours(mask)
        area_pixels = int(mask.sum())
        area_cm2 = float(area_pixels * pixel_spacing[0] * pixel_spacing[1] / 100.0)
        b64 = encode_mask_png(mask)
        return SegmentationResult(
            mask_png_base64=b64,
            contours=contours,
            area_pixels=area_pixels,
            area_cm2=area_cm2,
        )

    @app.post(
        "/segment/auto",
        response_model=BaseResponse,
        tags=["segmentation"],
        description="Automatic segmentation using threshold-based heuristic.",
    )
    async def segment_auto(
        request: Request,
        file: UploadFile = File(...),
        pixel_spacing: float = Form(0.1),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            mask = simple_threshold_segmentation(img)
            result = build_result(mask, (pixel_spacing, pixel_spacing))
        except Exception as exc:
            logger.exception("Auto segmentation error")
            error = ErrorDetail(
                code=500,
                message="Failed to segment image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="segmentation",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        data = result.dict()
        data["model_type"] = "heuristic"
        data[
            "disclaimer"
        ] = (
            "This analysis uses statistical image features, not a validated clinical AI model. "
            "Results must be interpreted by a qualified medical professional."
        )
        data["validated"] = False
        payload = format_response(
            status="success",
            service="segmentation",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/segment/interactive",
        response_model=BaseResponse,
        tags=["segmentation"],
        description="Interactive segmentation with point prompts (approximated by thresholding).",
    )
    async def segment_interactive(
        request: Request,
        file: UploadFile = File(...),
        x: int = Form(...),
        y: int = Form(...),
        pixel_spacing: float = Form(0.1),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            mask = simple_threshold_segmentation(img)
            result = build_result(mask, (pixel_spacing, pixel_spacing))
        except Exception as exc:
            logger.exception("Interactive segmentation error")
            error = ErrorDetail(
                code=500,
                message="Failed to segment image interactively.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="segmentation",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        data = result.dict()
        data["model_type"] = "heuristic"
        data[
            "disclaimer"
        ] = (
            "This analysis uses statistical image features, not a validated clinical AI model. "
            "Results must be interpreted by a qualified medical professional."
        )
        data["validated"] = False
        payload = format_response(
            status="success",
            service="segmentation",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/segment/organ",
        response_model=BaseResponse,
        tags=["segmentation"],
        description="Organ-specific segmentation with basic heuristic mask.",
    )
    async def segment_organ(
        request: Request,
        file: UploadFile = File(...),
        organ: str = Form(...),
        pixel_spacing: float = Form(0.1),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read()))
            mask = simple_threshold_segmentation(img)
            result = build_result(mask, (pixel_spacing, pixel_spacing))
            data = result.dict()
            data["organ"] = organ
        except Exception as exc:
            logger.exception("Organ segmentation error")
            error = ErrorDetail(
                code=500,
                message="Failed to segment organ.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="segmentation",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        data["model_type"] = "heuristic"
        data[
            "disclaimer"
        ] = (
            "This analysis uses statistical image features, not a validated clinical AI model. "
            "Results must be interpreted by a qualified medical professional."
        )
        data["validated"] = False
        payload = format_response(
            status="success",
            service="segmentation",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

