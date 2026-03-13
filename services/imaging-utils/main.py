import sys
import os
import base64
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

import nibabel as nib
import numpy as np
import pydicom
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


logger = logging.getLogger("manthana-imaging-utils")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class DicomConvertResponse(BaseModel):
    images: List[str]
    metadata: Dict[str, Any]


class NiftiConvertResponse(BaseModel):
    slices: List[str]
    volume_info: Dict[str, Any]


class MetadataResponse(BaseModel):
    metadata: Dict[str, Any]


class PreprocessResponse(BaseModel):
    image_base64: str


WINDOW_PRESETS = {
    "lung": {"center": -600, "width": 1500},
    "bone": {"center": 400, "width": 1800},
    "soft": {"center": 40, "width": 400},
    "brain": {"center": 40, "width": 80},
}


def apply_window(arr: np.ndarray, center: float, width: float) -> np.ndarray:
    low = center - width / 2
    high = center + width / 2
    arr = np.clip(arr, low, high)
    arr = (arr - low) / (high - low)
    arr = (arr * 255).astype("uint8")
    return arr


def encode_png(arr: np.ndarray) -> str:
    img = Image.fromarray(arr)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode("ascii")


def extract_dicom_metadata(ds: pydicom.dataset.FileDataset) -> Dict[str, Any]:
    fields = [
        "PatientID",
        "PatientName",
        "PatientAge",
        "PatientSex",
        "StudyDate",
        "StudyDescription",
        "Modality",
        "SeriesDescription",
    ]
    meta: Dict[str, Any] = {}
    for f in fields:
        if hasattr(ds, f):
            meta[f] = str(getattr(ds, f))
    return meta


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Imaging Utils Service",
        description="Utility service for medical imaging conversions and preprocessing.",
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
        description="Health check for the imaging utils service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="imaging-utils",
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
            "service": "imaging-utils",
            "presets": WINDOW_PRESETS,
        }
        payload = format_response(
            status="success",
            service="imaging-utils",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/convert/dicom-to-png",
        response_model=BaseResponse,
        tags=["convert"],
        description="Convert a DICOM file to PNG with windowing presets.",
    )
    async def convert_dicom_to_png(
        request: Request,
        file: UploadFile = File(...),
        preset: str = "soft",
    ):
        request_id = generate_request_id()
        try:
            ds = pydicom.dcmread(file.file)
            arr = ds.pixel_array.astype("float32")
            if preset in WINDOW_PRESETS:
                params = WINDOW_PRESETS[preset]
                arr8 = apply_window(arr, params["center"], params["width"])
            else:
                arr8 = (arr / np.max(arr) * 255).astype("uint8")
            img_b64 = encode_png(arr8)
            metadata = extract_dicom_metadata(ds)
            data = DicomConvertResponse(images=[img_b64], metadata=metadata).dict()
        except Exception as exc:
            logger.exception("DICOM conversion error")
            error = ErrorDetail(
                code=500,
                message="Failed to convert DICOM to PNG.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="imaging-utils",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="imaging-utils",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/convert/nifti-to-png",
        response_model=BaseResponse,
        tags=["convert"],
        description="Convert a NIfTI file to a set of PNG slices.",
    )
    async def convert_nifti_to_png(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = nib.load(file.file)
            data = img.get_fdata()
            mid_slice = data.shape[2] // 2
            slice_arr = data[:, :, mid_slice]
            slice_norm = (slice_arr - slice_arr.min()) / (
                (slice_arr.max() - slice_arr.min()) or 1.0
            )
            arr8 = (slice_norm * 255).astype("uint8")
            img_b64 = encode_png(arr8)
            volume_info = {
                "shape": list(data.shape),
                "zooms": list(img.header.get_zooms()),
            }
            data_out = NiftiConvertResponse(
                slices=[img_b64],
                volume_info=volume_info,
            ).dict()
        except Exception as exc:
            logger.exception("NIfTI conversion error")
            error = ErrorDetail(
                code=500,
                message="Failed to convert NIfTI to PNG.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="imaging-utils",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="imaging-utils",
            data=data_out,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/metadata/extract",
        response_model=BaseResponse,
        tags=["metadata"],
        description="Extract metadata from DICOM, NIfTI, or PNG images.",
    )
    async def metadata_extract(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        metadata: Dict[str, Any] = {}
        try:
            if file.filename.lower().endswith(".dcm"):
                ds = pydicom.dcmread(file.file)
                metadata = extract_dicom_metadata(ds)
            elif file.filename.lower().endswith((".nii", ".nii.gz")):
                img = nib.load(file.file)
                metadata = {
                    "shape": list(img.shape),
                    "zooms": list(img.header.get_zooms()),
                }
            else:
                img = Image.open(file.file)
                metadata = {
                    "mode": img.mode,
                    "size": img.size,
                    "format": img.format,
                }
        except Exception as exc:
            logger.exception("Metadata extraction error")
            error = ErrorDetail(
                code=500,
                message="Failed to extract metadata.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="imaging-utils",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = MetadataResponse(metadata=metadata).dict()
        payload = format_response(
            status="success",
            service="imaging-utils",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/preprocess/normalize",
        response_model=BaseResponse,
        tags=["preprocess"],
        description="Normalize, window, and resize medical images.",
    )
    async def preprocess_normalize(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(file.file).convert("L")
            img_resized = img.resize((256, 256))
            arr = np.asarray(img_resized).astype("float32")
            arr = (arr - arr.mean()) / (arr.std() + 1e-6)
            arr_norm = (arr - arr.min()) / ((arr.max() - arr.min()) or 1.0)
            arr8 = (arr_norm * 255).astype("uint8")
            img_b64 = encode_png(arr8)
            data = PreprocessResponse(image_base64=img_b64).dict()
        except Exception as exc:
            logger.exception("Preprocess error")
            error = ErrorDetail(
                code=500,
                message="Failed to preprocess image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="imaging-utils",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        payload = format_response(
            status="success",
            service="imaging-utils",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

