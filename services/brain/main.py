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

import mne
import nibabel as nib
import numpy as np
from fastapi import FastAPI, File, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from nilearn import datasets, input_data
from nilearn.connectome import ConnectivityMeasure
from pydantic import BaseModel
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id


logger = logging.getLogger("manthana-brain")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class MRIAnalysis(BaseModel):
    regions: List[str]
    volumes: Dict[str, float]
    anomalies: List[str]


class EEGAnalysis(BaseModel):
    bands: Dict[str, float]
    artifact_flags: List[str]


class ConnectivityAnalysis(BaseModel):
    matrix: List[List[float]]
    regions: List[str]


def analyze_mri_image(img: nib.spatialimages.SpatialImage) -> MRIAnalysis:
    data = img.get_fdata()
    mean_intensity = float(np.mean(data))
    regions = ["whole_brain"]
    volumes = {"whole_brain": float(data.size * np.prod(img.header.get_zooms()))}
    anomalies: List[str] = []
    if mean_intensity > 0.8:
        anomalies.append("hyperintense_regions_suspected")
    elif mean_intensity < 0.2:
        anomalies.append("hypointense_regions_suspected")
    return MRIAnalysis(regions=regions, volumes=volumes, anomalies=anomalies)


def analyze_eeg_raw(raw: mne.io.BaseRaw) -> EEGAnalysis:
    sfreq = raw.info["sfreq"]
    data, _ = raw[:]
    psd, freqs = mne.time_frequency.psd_array_welch(
        data, sfreq=sfreq, fmin=0.5, fmax=100.0, average="mean"
    )
    psd_mean = psd.mean(axis=0)

    def band_power(fmin: float, fmax: float) -> float:
        mask = (freqs >= fmin) & (freqs < fmax)
        return float(psd_mean[mask].sum())

    bands = {
        "delta": band_power(0.5, 4),
        "theta": band_power(4, 8),
        "alpha": band_power(8, 13),
        "beta": band_power(13, 30),
        "gamma": band_power(30, 100),
    }
    artifacts: List[str] = []
    if bands["beta"] > bands["alpha"] * 2:
        artifacts.append("muscle_activity_suspected")
    return EEGAnalysis(bands=bands, artifact_flags=artifacts)


def analyze_connectivity(time_series: np.ndarray) -> ConnectivityAnalysis:
    conn = ConnectivityMeasure(kind="correlation")
    matrix = conn.fit_transform([time_series])[0]
    matrix_list = matrix.tolist()
    regions = [f"region_{i}" for i in range(matrix.shape[0])]
    return ConnectivityAnalysis(matrix=matrix_list, regions=regions)


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Brain Service",
        description="Brain MRI, EEG, and connectivity analysis.",
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
        description="Health check for the brain service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="brain",
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
            "service": "brain",
            "capabilities": ["mri", "eeg", "connectivity"],
        }
        payload = format_response(
            status="success",
            service="brain",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/mri",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze brain MRI NIfTI or DICOM files.",
    )
    async def analyze_mri(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            if file.filename.lower().endswith((".nii", ".nii.gz")):
                img = nib.load(file.file)
            else:
                data = nib.load(file.file)
                img = data
            result = analyze_mri_image(img)
        except Exception as exc:
            logger.exception("MRI analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze MRI.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="brain",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        payload = format_response(
            status="success",
            service="brain",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/eeg",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze EEG data (EDF or CSV).",
    )
    async def analyze_eeg(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            if file.filename.lower().endswith(".edf"):
                raw = mne.io.read_raw_edf(file.file, preload=True, verbose=False)
            else:
                import pandas as pd

                df = pd.read_csv(file.file)
                sfreq = 256.0
                data = df.to_numpy().T
                info = mne.create_info(
                    ch_names=[f"ch{i}" for i in range(data.shape[0])],
                    sfreq=sfreq,
                    ch_types="eeg",
                )
                raw = mne.io.RawArray(data, info)
            result = analyze_eeg_raw(raw)
        except Exception as exc:
            logger.exception("EEG analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze EEG.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="brain",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        payload = format_response(
            status="success",
            service="brain",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/connectivity",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Perform basic functional connectivity analysis on fMRI time series.",
    )
    async def analyze_connectivity_endpoint(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = nib.load(file.file)
            masker = input_data.NiftiLabelsMasker(
                labels_img=datasets.fetch_atlas_aal().maps, standardize=True
            )
            time_series = masker.fit_transform(img)
            result = analyze_connectivity(time_series.T)
        except Exception as exc:
            logger.exception("Connectivity analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze connectivity.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="brain",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)
        payload = format_response(
            status="success",
            service="brain",
            data=result.dict(),
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

