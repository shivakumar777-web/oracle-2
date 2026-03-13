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

import neurokit2 as nk
import numpy as np
import pandas as pd
from fastapi import FastAPI, File, HTTPException, Path, Request, UploadFile
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


logger = logging.getLogger("manthana-ecg")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class ECGReport(BaseModel):
    heart_rate: float
    hrv_sdnn: float
    rr_intervals: List[float]
    peaks_count: int
    arrhythmia_flags: List[str]
    signal_quality: float


ANALYSIS_STORE: Dict[str, ECGReport] = {}


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana ECG Service",
        description="ECG signal analysis using NeuroKit2.",
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

    @app.middleware("http")
    async def enforce_max_upload_size(request: Request, call_next):
        content_length = request.headers.get("content-length")
        max_bytes = settings.MAX_UPLOAD_MB * 1024 * 1024
        if content_length and int(content_length) > max_bytes:
            request_id = generate_request_id()
            error = ErrorDetail(
                code=413,
                message="Uploaded file too large.",
                details={"max_mb": settings.MAX_UPLOAD_MB},
            )
            payload = format_response(
                status="error",
                service="ecg",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=413, content=payload)
        return await call_next(request)

    def analyze_signal(signal: np.ndarray, sampling_rate: int = 500) -> ECGReport:
        processed, info = nk.ecg_process(signal, sampling_rate=sampling_rate)
        hr = float(np.nanmean(processed["ECG_Rate"]))
        hrv = float(np.nanstd(processed["ECG_Rate"]))
        rr = np.diff(info["ECG_R_Peaks"]) / sampling_rate
        rr_list = [float(x) for x in rr]
        peaks_count = int(len(info["ECG_R_Peaks"]))
        flags: List[str] = []
        if hr > 100:
            flags.append("tachycardia")
        if hr < 50:
            flags.append("bradycardia")
        quality = float(np.clip(1.0 - np.mean(np.abs(np.diff(signal)) / (np.std(signal) + 1e-6)), 0.0, 1.0))
        return ECGReport(
            heart_rate=hr,
            hrv_sdnn=hrv,
            rr_intervals=rr_list,
            peaks_count=peaks_count,
            arrhythmia_flags=flags,
            signal_quality=quality,
        )

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the ECG service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="ecg",
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
            "service": "ecg",
            "library": "neurokit2",
        }
        payload = format_response(
            status="success",
            service="ecg",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/ecg",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze ECG from CSV (time, voltage) or image.",
    )
    async def analyze_ecg(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            if file.filename.lower().endswith(".csv"):
                df = pd.read_csv(file.file)
                if "voltage" in df.columns:
                    signal = df["voltage"].to_numpy(dtype=float)
                else:
                    # assume single-column
                    signal = df.iloc[:, 1].to_numpy(dtype=float)
            else:
                img = Image.open(io.BytesIO(await file.read())).convert("L")
                arr = np.asarray(img).astype("float32")
                signal = arr.mean(axis=0)
            report = analyze_signal(signal)
            analysis_id = generate_request_id()
            ANALYSIS_STORE[analysis_id] = report
        except Exception as exc:
            logger.exception("ECG analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze ECG data.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="ecg",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = {"analysis_id": analysis_id, "report": report.dict()}
        payload = format_response(
            status="success",
            service="ecg",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/image",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Analyze ECG waveform from an image.",
    )
    async def analyze_image(
        request: Request,
        file: UploadFile = File(...),
    ):
        request_id = generate_request_id()
        try:
            img = Image.open(io.BytesIO(await file.read())).convert("L")
            arr = np.asarray(img).astype("float32")
            signal = arr.mean(axis=0)
            report = analyze_signal(signal)
            analysis_id = generate_request_id()
            ANALYSIS_STORE[analysis_id] = report
        except Exception as exc:
            logger.exception("ECG image analysis error")
            error = ErrorDetail(
                code=500,
                message="Failed to analyze ECG image.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="ecg",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=500, content=payload)

        data = {"analysis_id": analysis_id, "report": report.dict()}
        payload = format_response(
            status="success",
            service="ecg",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/report/{analysis_id}",
        response_model=BaseResponse,
        tags=["reports"],
        description="Retrieve a clinical-style ECG report by analysis ID.",
    )
    async def report(
        request: Request,
        analysis_id: str = Path(..., description="Analysis identifier."),
    ):
        request_id = generate_request_id()
        report = ANALYSIS_STORE.get(analysis_id)
        if not report:
            error = ErrorDetail(
                code=404,
                message="Analysis not found.",
                details={"analysis_id": analysis_id},
            )
            payload = format_response(
                status="error",
                service="ecg",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=404, content=payload)
        text_summary = (
            f"Heart rate: {report.heart_rate:.1f} bpm, "
            f"HRV (SDNN): {report.hrv_sdnn:.2f}, "
            f"R-peaks: {report.peaks_count}, "
            f"Arrhythmia flags: {', '.join(report.arrhythmia_flags) or 'none'}."
        )
        data = {"analysis_id": analysis_id, "summary": text_summary, "report": report.dict()}
        payload = format_response(
            status="success",
            service="ecg",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

