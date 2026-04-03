import json
import logging
import uuid
from enum import Enum
from typing import Any, Dict, Optional, Tuple

from PIL import Image
import numpy as np


logger = logging.getLogger("manthana-shared-utils")


class DetectedFileType(str, Enum):
    XRAY = "xray"
    DICOM = "dicom"
    ECG_CSV = "ecg_csv"
    ECG_IMAGE = "ecg_image"
    FUNDUS = "fundus"
    SKIN = "skin"
    ORAL = "oral"
    MRI = "mri"
    EEG = "eeg"
    SMILES = "smiles"
    TEXT = "text"


DISCLAIMER = (
    "For research and educational use only. "
    "This analysis is AI-generated and NOT a substitute for professional "
    "medical advice, diagnosis, or treatment. Always consult a qualified "
    "healthcare provider."
)


def generate_request_id() -> str:
    """
    Generate a new UUID4 request identifier.
    """
    return str(uuid.uuid4())


def format_response(
    *,
    status: str,
    service: str,
    data: Optional[Dict[str, Any]],
    error: Optional[Dict[str, Any]],
    request_id: str,
    disclaimer: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Create a standardized JSON response envelope used by all services.
    """
    payload: Dict[str, Any] = {
        "status": status,
        "service": service,
        "data": data,
        "error": error,
        "request_id": request_id,
    }
    if disclaimer:
        payload["disclaimer"] = disclaimer
    return payload


def _normalize_filename(name: Optional[str]) -> str:
    return (name or "").lower()


def detect_file_type(
    filename: Optional[str],
    content_type: Optional[str],
) -> DetectedFileType:
    """
    Detect the logical medical file type from filename and content-type.

    Returns a DetectedFileType value indicating how the router or services
    should treat the incoming payload.
    """
    name = _normalize_filename(filename)
    ctype = (content_type or "").lower()

    if name.endswith(".dcm") or "dicom" in ctype:
        return DetectedFileType.DICOM

    if name.endswith(".nii") or name.endswith(".nii.gz"):
        return DetectedFileType.MRI

    if name.endswith(".edf"):
        return DetectedFileType.EEG

    if name.endswith(".csv") or "text/csv" in ctype:
        # Differentiate ECG CSV by common keywords
        if "ecg" in name or "ekg" in name:
            return DetectedFileType.ECG_CSV
        return DetectedFileType.TEXT

    if ctype.startswith("image/") or any(
        name.endswith(ext) for ext in (".png", ".jpg", ".jpeg", ".tif", ".tiff")
    ):
        # Heuristics based on filename hints
        if any(k in name for k in ("fundus", "retina", "eye")):
            return DetectedFileType.FUNDUS
        if any(k in name for k in ("skin", "derm", "lesion")):
            return DetectedFileType.SKIN
        if any(k in name for k in ("oral", "mouth", "tongue")):
            return DetectedFileType.ORAL
        if any(k in name for k in ("ecg", "ekg")):
            return DetectedFileType.ECG_IMAGE
        # Default medical image type for imaging services
        return DetectedFileType.XRAY

    # Very lightweight SMILES heuristic: contains typical SMILES chars and no spaces
    if filename is None and content_type is None:
        # Fallback; caller should reclassify based on body content
        return DetectedFileType.TEXT

    return DetectedFileType.TEXT


def preprocess_image(
    pil_image: Image.Image,
    target_size: Tuple[int, int] = (224, 224),
) -> np.ndarray:
    """
    Resize and normalize a PIL image into a NCHW NumPy tensor suitable for
    common medical CNN backbones.
    """
    if pil_image.mode != "L" and pil_image.mode != "RGB":
        pil_image = pil_image.convert("RGB")

    pil_resized = pil_image.resize(target_size)
    arr = np.asarray(pil_resized).astype("float32") / 255.0

    if arr.ndim == 2:
        arr = np.expand_dims(arr, axis=-1)

    # Convert HWC to CHW
    arr = np.transpose(arr, (2, 0, 1))
    # Add batch dimension: NCHW
    arr = np.expand_dims(arr, axis=0)
    return arr


def json_log(logger_name: str, level: str, **fields: Any) -> None:
    """
    Emit a single JSON-formatted log line to the configured logger.
    """
    logger_obj = logging.getLogger(logger_name)
    record = json.dumps(fields, default=str)
    logger_obj.log(getattr(logging, level.upper(), logging.INFO), record)

