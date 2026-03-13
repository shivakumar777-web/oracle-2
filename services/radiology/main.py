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
import pydicom
import torch
import torchvision

# Ensure local torchxrayvision package (ai-tools) is importable
TORCHXRAYVISION_ROOT = os.path.join(PROJECT_ROOT, "ai-tools", "torchxrayvision")
if TORCHXRAYVISION_ROOT not in sys.path:
    sys.path.insert(0, TORCHXRAYVISION_ROOT)

import torchxrayvision as xrv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
from pydantic import BaseModel, Field
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import (
    DISCLAIMER,
    format_response,
    generate_request_id,
    json_log,
    preprocess_image,
)


logger = logging.getLogger("manthana-radiology")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))


limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


CHEST_CONDITIONS = [
    "Atelectasis",
    "Cardiomegaly",
    "Effusion",
    "Infiltration",
    "Mass",
    "Nodule",
    "Pneumonia",
    "Pneumothorax",
    "Consolidation",
    "Edema",
    "Emphysema",
    "Fibrosis",
    "Pleural Thickening",
    "Hernia",
    "Pleural Effusion",
    "Lung Opacity",
    "Enlarged Cardiomediastinum",
]


class PathologyScore(BaseModel):
    name: str
    score: float
    high_confidence: bool
    critical: bool


class XRayAnalysisResponse(BaseModel):
    pathologies: List[PathologyScore]


class DicomAnalysisResponse(BaseModel):
    pathologies: List[PathologyScore]
    metadata: Dict[str, Any]


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Radiology Service",
        description="Chest X-ray and DICOM analysis using torchxrayvision.",
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

    device = "cuda" if settings.ENABLE_GPU and torch.cuda.is_available() else "cpu"
    logger.info(f"Using device: {device}")

    model = xrv.models.DenseNet(weights="densenet121-res224-all").to(device)
    model.eval()

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.middleware("http")
    async def enforce_max_upload_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if content_length and int(content_length) > max_bytes:
            request_id = getattr(request.state, "request_id", generate_request_id())
            error = ErrorDetail(
                code=413,
                message="Uploaded file too large.",
                details={"max_mb": settings.MAX_UPLOAD_MB},
            )
            payload = format_response(
                status="error",
                service="radiology",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=413, content=payload)
        return await call_next(request)

    def run_model(arr: Any) -> List[PathologyScore]:
        with torch.no_grad():
            if isinstance(arr, torch.Tensor):
                tensor = arr.to(device)
            else:
                tensor = torch.from_numpy(arr).to(device)
            outputs = model(tensor)
            scores = outputs.cpu().numpy()[0]
        results: List[PathologyScore] = []
        labels = list(model.pathologies)
        for idx, name in enumerate(labels):
            score = float(scores[idx])
            high = score > 0.3
            critical = score > 0.5
            results.append(
                PathologyScore(
                    name=name,
                    score=score,
                    high_confidence=high,
                    critical=critical,
                )
            )
        return results

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the radiology service.",
    )
    async def health(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        details = {"model_loaded": True}
        return HealthResponse(
            status="healthy",
            service="radiology",
            details=details,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Service information and model details.",
    )
    async def info(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        data = {
            "service": "radiology",
            "model": "torchxrayvision DenseNet densenet121-res224-all",
            "device": device,
            "conditions": CHEST_CONDITIONS,
            "thresholds": {"high_confidence": 0.3, "critical": 0.5},
        }
        payload = format_response(
            status="success",
            service="radiology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/conditions",
        response_model=BaseResponse,
        tags=["radiology"],
        description="List all detectable chest conditions.",
    )
    async def conditions(request: Request):
        request_id = getattr(request.state, "request_id", generate_request_id())
        data = {"conditions": CHEST_CONDITIONS}
        payload = format_response(
            status="success",
            service="radiology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/xray",
        response_model=BaseResponse,
        tags=["radiology"],
        description=(
            "Analyze a chest X-ray image (PNG/JPG/DICOM) and return "
            "pathology confidence scores."
        ),
    )
    async def analyze_xray(
        request: Request,
        file: UploadFile = File(...),
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        try:
            suffix = (file.filename or "").lower()
            if suffix.endswith(".dcm"):
                ds = pydicom.dcmread(file.file)
                arr = ds.pixel_array.astype("float32")
                img = Image.fromarray(arr)
                arr = preprocess_image(img)
                pathologies = run_model(arr)
            else:
                contents = await file.read()

                # Convert to GRAYSCALE (L mode) — torchxrayvision needs 1 channel
                img = Image.open(io.BytesIO(contents))

                # Handle all color modes → force grayscale
                if img.mode != "L":
                    img = img.convert("L")

                # Normalize to [0, 1] range using torchxrayvision normalize
                img_np = np.array(img).astype(np.float32)
                img_np = xrv.datasets.normalize(img_np, 255)

                # Shape must be (1, H, W) — add channel dim
                img_np = img_np[None, ...]

                # Resize to 224x224 using torchxrayvision utils
                transform = torchvision.transforms.Compose(
                    [
                        xrv.datasets.XRayCenterCrop(),
                        xrv.datasets.XRayResizer(224),
                    ]
                )
                img_np = transform(img_np)

                # Add batch dim → (1, 1, 224, 224)
                img_tensor = torch.from_numpy(img_np).unsqueeze(0)
                pathologies = run_model(img_tensor)
        except Exception as exc:
            logger.exception("X-ray analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze X-ray image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="radiology",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = {
            "pathologies": [p.dict() for p in pathologies],
        }
        payload = format_response(
            status="success",
            service="radiology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/dicom",
        response_model=BaseResponse,
        tags=["radiology"],
        description=(
            "Analyze a DICOM chest X-ray and return pathologies plus "
            "relevant DICOM metadata."
        ),
    )
    async def analyze_dicom(
        request: Request,
        file: UploadFile = File(...),
        settings: Settings = Depends(get_settings),
    ):
        request_id = getattr(request.state, "request_id", generate_request_id())
        try:
            ds = pydicom.dcmread(file.file)
            arr = ds.pixel_array.astype("float32")
            img = Image.fromarray(arr)
            tensor = preprocess_image(img)
            pathologies = run_model(tensor)
            metadata: Dict[str, Any] = {}
            for tag in ("PatientID", "PatientAge", "PatientSex", "StudyDate", "StudyDescription"):
                if hasattr(ds, tag):
                    metadata[tag] = str(getattr(ds, tag))
        except Exception as exc:
            logger.exception("DICOM analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze DICOM file.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="radiology",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = {
            "pathologies": [p.dict() for p in pathologies],
            "dicom_metadata": metadata,
        }
        payload = format_response(
            status="success",
            service="radiology",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

