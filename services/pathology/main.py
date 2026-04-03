import sys
import os
import io
import logging
from typing import Any, Dict, List, Optional

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

try:
    from transformers import pipeline  # type: ignore[import]

    _TRANSFORMERS_AVAILABLE = True
except Exception:  # pragma: no cover
    pipeline = None  # type: ignore[assignment]
    _TRANSFORMERS_AVAILABLE = False

PATCH_MODEL = None
PATCH_MODEL_NAME: str = "heuristic-intensity"

_PATCH_DISCLAIMER = (
    "Patch-level classifier. Not a whole-slide analysis system. "
    "Training data predominantly Western. India-specific histopathology validation pending."
)
_INDIA_HEURISTIC_DISCLAIMER = (
    "This analysis uses statistical image features, not a validated clinical AI model. "
    "Training data predominantly Western. India-specific histopathology validation pending. "
    "Results must be interpreted by a qualified medical professional."
)


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
    return TileAnalysis(classification=classification, confidence=min(0.65, confidence))


def _map_patch_label_to_tissue(label: str) -> str:
    l = label.lower()
    if any(k in l for k in ["adenocarcinoma", "carcinoma", "malignant", "cancer", "tumor", "tumour"]):
        return "tumor"
    if any(k in l for k in ["inflammation", "inflammatory"]):
        return "inflammatory"
    if any(k in l for k in ["normal", "benign", "healthy"]):
        return "normal"
    return "benign_like"


def _analyze_patch_ml(image: Image.Image) -> Optional[Dict[str, Any]]:
    if PATCH_MODEL is None:
        return None
    try:
        outs = PATCH_MODEL(image.convert("RGB"))
        best = outs[0] if outs else {"label": "unknown", "score": 0.0}
        label = str(best.get("label", "unknown"))
        score = float(best.get("score", 0.0))
        tissue = _map_patch_label_to_tissue(label)
        abnormality_score = float(min(1.0, max(0.0, score if tissue == "tumor" else (1.0 - score if tissue == "normal" else score))))
        return {
            "label": label,
            "score": score,
            "tissue_type": tissue,
            "abnormality_score": abnormality_score,
        }
    except Exception as exc:  # pragma: no cover
        logger.warning("Patch ML inference failed: %s", exc)
        return None


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

    # Load patch classifier at startup (best-effort)
    global PATCH_MODEL, PATCH_MODEL_NAME
    if _TRANSFORMERS_AVAILABLE and pipeline is not None and PATCH_MODEL is None:
        hf_token = (os.getenv("HF_TOKEN") or "").strip()
        # Prefer CONCH only if token is provided; otherwise a public histopathology classifier
        preferred = "mahmoodlab/conch" if hf_token else "Guldeniz/vit-base-patch16-224-in21k-lung_and_colon"
        try:
            PATCH_MODEL = pipeline(
                "image-classification",
                model=preferred,
                token=hf_token or None,
                device=-1,
            )
            PATCH_MODEL_NAME = preferred
            logger.info("Loaded pathology patch model: %s", preferred)
        except Exception as exc:  # pragma: no cover
            PATCH_MODEL = None
            PATCH_MODEL_NAME = "heuristic-intensity"
            logger.warning("Failed to load pathology patch model, using heuristic: %s", exc)

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
            "model": PATCH_MODEL_NAME,
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

        data = result.dict()
        ml = _analyze_patch_ml(img)
        if ml is not None:
            # Keep existing slide schema, but refine tissue_type + abnormality_score and add model
            data["tissue_type"] = ml["tissue_type"]
            data["abnormality_score"] = float(ml["abnormality_score"])
            data["model"] = PATCH_MODEL_NAME
            data["model_type"] = "ml_experimental"
            data["validated"] = False
            data["disclaimer"] = _PATCH_DISCLAIMER
            data["validation_note"] = "Training data predominantly Western. India-specific histopathology validation pending."
        else:
            data["model"] = "heuristic-intensity"
            data["model_type"] = "heuristic"
            data["validated"] = False
            data["disclaimer"] = _INDIA_HEURISTIC_DISCLAIMER
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

        data = result.dict()
        ml = _analyze_patch_ml(img)
        if ml is not None:
            # Keep existing tile schema: classification + confidence; cap 0.82 for non-India-validated
            data["classification"] = ml["tissue_type"]
            data["confidence"] = float(min(0.82, ml["score"]))
            data["model"] = PATCH_MODEL_NAME
            data["model_type"] = "ml_experimental"
            data["validated"] = False
            data["disclaimer"] = _PATCH_DISCLAIMER
            data["validation_note"] = "Training data predominantly Western. India-specific histopathology validation pending."
            data["abnormality_score"] = float(ml["abnormality_score"])
        else:
            data["model"] = "heuristic-intensity"
            data["model_type"] = "heuristic"
            data["validated"] = False
            data["disclaimer"] = _INDIA_HEURISTIC_DISCLAIMER
        payload = format_response(
            status="success",
            service="pathology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

