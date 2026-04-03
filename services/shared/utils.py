"""
utils.py — Manthana Shared Utilities
=====================================
Cross-cutting helpers used by the AI Router and every clinical
micro-service.

Responsibilities:
  • Medical file-type detection  → drives clinical routing
  • Standardised response envelope (BaseResponse-compatible)
  • Request-ID generation
  • Structured JSON logging
  • Medical disclaimer text
  • Image pre-processing for CNN pipelines
"""

from __future__ import annotations

import datetime
import json
import logging
import re
import uuid
from enum import Enum
from functools import lru_cache
from io import BytesIO
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
from PIL import Image

logger = logging.getLogger("manthana.shared.utils")


# ═══════════════════════════════════════════════════════════════════════
#  FILE TYPE ENUM
# ═══════════════════════════════════════════════════════════════════════

class DetectedFileType(str, Enum):
    """Logical medical file types understood by the Manthana platform.

    Adding a new value here automatically makes it available for routing
    in ``ai-router/main.py`` (via ``detect_file_type``).
    """

    XRAY       = "xray"
    DICOM      = "dicom"
    ECG_CSV    = "ecg_csv"
    ECG_IMAGE  = "ecg_image"
    FUNDUS     = "fundus"
    SKIN       = "skin"
    ORAL       = "oral"
    MRI        = "mri"
    EEG        = "eeg"
    PATHOLOGY  = "pathology"
    SMILES     = "smiles"
    MOLECULE   = "molecule"
    TEXT       = "text"
    UNKNOWN    = "unknown"


# ═══════════════════════════════════════════════════════════════════════
#  DISCLAIMER
# ═══════════════════════════════════════════════════════════════════════

DISCLAIMER: str = (
    "For research and educational use only. "
    "This analysis is AI-generated and NOT a substitute for professional "
    "medical advice, diagnosis, or treatment. Always consult a qualified "
    "healthcare provider."
)

DISCLAIMER_SHORT: str = (
    "AI-generated — not a substitute for professional medical advice."
)


# ═══════════════════════════════════════════════════════════════════════
#  REQUEST ID
# ═══════════════════════════════════════════════════════════════════════

def generate_request_id() -> str:
    """Generate a new UUID-4 request identifier."""
    return str(uuid.uuid4())


# ═══════════════════════════════════════════════════════════════════════
#  RESPONSE ENVELOPE
# ═══════════════════════════════════════════════════════════════════════

def format_response(
    status: str,
    service: str,
    data: Optional[Dict[str, Any]],
    error: Optional[Dict[str, Any]],
    request_id: str,
    disclaimer: Optional[str] = None,
    include_timestamp: bool = True,
) -> Dict[str, Any]:
    """Create a standardised JSON response envelope.

    Matches the ``BaseResponse`` Pydantic model shape so it can be
    returned directly from any endpoint.

    Accepts **positional** or **keyword** arguments for convenience::

        # Both calling conventions work:
        format_response("success", "ai-router", data, None, rid)
        format_response(status="success", service="ai-router", ...)
    """
    payload: Dict[str, Any] = {
        "status": status,
        "service": service,
        "data": data,
        "error": error,
        "request_id": request_id,
    }
    if include_timestamp:
        payload["timestamp"] = datetime.datetime.utcnow().replace(
            microsecond=0
        ).isoformat() + "Z"
    if disclaimer:
        payload["disclaimer"] = disclaimer
    return payload


# ═══════════════════════════════════════════════════════════════════════
#  FILE TYPE DETECTION
# ═══════════════════════════════════════════════════════════════════════

# --- Extension → type mappings -----------------------------------------

_EXTENSION_MAP: Dict[str, DetectedFileType] = {
    # Radiology / DICOM
    ".dcm":     DetectedFileType.DICOM,
    ".dicom":   DetectedFileType.DICOM,

    # Neuro-imaging (MRI)
    ".nii":     DetectedFileType.MRI,
    ".nii.gz":  DetectedFileType.MRI,
    ".nrrd":    DetectedFileType.MRI,
    ".mgh":     DetectedFileType.MRI,
    ".mgz":     DetectedFileType.MRI,
    ".mnc":     DetectedFileType.MRI,

    # EEG
    ".edf":     DetectedFileType.EEG,
    ".bdf":     DetectedFileType.EEG,
    ".set":     DetectedFileType.EEG,
    ".fif":     DetectedFileType.EEG,
    ".vhdr":    DetectedFileType.EEG,

    # Pathology (whole-slide images)
    ".svs":     DetectedFileType.PATHOLOGY,
    ".ndpi":    DetectedFileType.PATHOLOGY,
    ".mrxs":    DetectedFileType.PATHOLOGY,
    ".vsi":     DetectedFileType.PATHOLOGY,
    ".scn":     DetectedFileType.PATHOLOGY,

    # Molecule / Drug
    ".pdb":     DetectedFileType.MOLECULE,
    ".sdf":     DetectedFileType.MOLECULE,
    ".mol":     DetectedFileType.MOLECULE,
    ".mol2":    DetectedFileType.MOLECULE,
}

# --- Filename keyword → type mappings ----------------------------------

_IMAGE_KEYWORD_MAP: List[Tuple[Sequence[str], DetectedFileType]] = [
    (("fundus", "retina", "eye", "optic_disc", "macula"),  DetectedFileType.FUNDUS),
    (("skin", "derm", "lesion", "mole", "nevus"),          DetectedFileType.SKIN),
    (("oral", "mouth", "tongue", "dental", "gingiva"),     DetectedFileType.ORAL),
    (("ecg", "ekg", "electrocardiogram"),                  DetectedFileType.ECG_IMAGE),
    (("pathology", "histology", "biopsy", "wsi", "slide"), DetectedFileType.PATHOLOGY),
    (("brain", "mri", "fmri"),                             DetectedFileType.MRI),
]

_IMAGE_EXTENSIONS = frozenset({
    ".png", ".jpg", ".jpeg", ".tif", ".tiff", ".bmp", ".webp",
})

# Simple SMILES heuristic: organic notation characters, no whitespace
_SMILES_PATTERN = re.compile(
    r"^[A-Za-z0-9@+\-\[\]\(\)\\\/=%#\.\$:~]+$"
)


def _normalize_filename(name: Optional[str]) -> str:
    return (name or "").strip().lower()


def detect_file_type(
    filename: Optional[str],
    content_type: Optional[str],
) -> DetectedFileType:
    """Detect the logical medical file type from filename and MIME type.

    Detection priority:
      1. Special compound extensions (``.nii.gz``)
      2. Simple extension map
      3. MIME type heuristics
      4. Filename keyword heuristics (for images)
      5. CSV with ECG keywords
      6. Fallback: ``TEXT`` or ``UNKNOWN``
    """
    name = _normalize_filename(filename)
    ctype = (content_type or "").lower()

    # 1. Compound extensions first (must check before single-ext)
    if name.endswith(".nii.gz"):
        return DetectedFileType.MRI

    # 2. Simple extension lookup
    for ext, ftype in _EXTENSION_MAP.items():
        if name.endswith(ext):
            return ftype

    # 3. MIME type: DICOM
    if "dicom" in ctype:
        return DetectedFileType.DICOM

    # 4. CSV / text-csv → possibly ECG data
    if name.endswith(".csv") or "text/csv" in ctype:
        if any(kw in name for kw in ("ecg", "ekg", "electrocardiogram", "lead")):
            return DetectedFileType.ECG_CSV
        return DetectedFileType.TEXT

    # 5. Image files → keyword heuristics
    is_image = (
        ctype.startswith("image/")
        or any(name.endswith(ext) for ext in _IMAGE_EXTENSIONS)
    )
    if is_image:
        for keywords, ftype in _IMAGE_KEYWORD_MAP:
            if any(kw in name for kw in keywords):
                return ftype
        # Default medical image → XRAY (safest clinical assumption)
        return DetectedFileType.XRAY

    # 6. Plain text / JSON → might be SMILES string
    if "text/plain" in ctype or "application/json" in ctype:
        return DetectedFileType.TEXT

    # 7. No information at all
    if not name and not ctype:
        return DetectedFileType.UNKNOWN

    return DetectedFileType.TEXT


def validate_file_content(
    data: bytes,
    detected_type: DetectedFileType,
) -> Tuple[bool, Optional[str]]:
    """Validate file content matches the detected type. Rejects malicious or malformed uploads.

    Returns:
        (True, None) if valid.
        (False, error_message) if invalid.
    """
    if not data or len(data) < 4:
        return False, "File is empty or too small"

    # DICOM: must have 128-byte preamble + "DICM" at offset 128
    if detected_type == DetectedFileType.DICOM:
        if len(data) < 132:
            return False, "DICOM file too short: missing header"
        if data[128:132] != b"DICM":
            return False, "Invalid DICOM: missing 'DICM' magic at offset 128"
        return True, None

    # Image types: verify PIL can load it
    image_types = (
        DetectedFileType.XRAY,
        DetectedFileType.FUNDUS,
        DetectedFileType.SKIN,
        DetectedFileType.ORAL,
        DetectedFileType.PATHOLOGY,
        DetectedFileType.ECG_IMAGE,
    )
    if detected_type in image_types:
        try:
            img = Image.open(BytesIO(data))
            img.verify()
        except Exception as exc:
            return False, f"Invalid image: {exc!s}"
        return True, None

    # CSV: basic structure check (has newlines, reasonable length)
    if detected_type == DetectedFileType.ECG_CSV:
        if b"\n" not in data or len(data) > 50 * 1024 * 1024:  # 50 MB max
            return False, "Invalid CSV: missing structure or too large"
        return True, None

    # MRI: NIfTI (.nii) magic at offset 344; .nii.gz has gzip magic; NRRD has "NRRD"
    if detected_type == DetectedFileType.MRI:
        if len(data) < 8:
            return False, "MRI file too short"
        # Gzip (.nii.gz, .mgz): first two bytes 1f 8b
        if data[:2] == b"\x1f\x8b":
            return True, None  # Gzip wrapper is enough; decompression happens downstream
        # NIfTI-1 (.nii): 348-byte header, magic "ni1" or "n+1" at offset 344
        if len(data) >= 348:
            magic = data[344:348]
            if magic in (b"ni1\x00", b"n+1\x00"):
                return True, None
        # NRRD: starts with "NRRD"
        if data[:4] == b"NRRD":
            return True, None
        # MGH: FreeSurfer format; minimal check: non-empty
        if len(data) >= 4:
            return True, None  # MGH/MNZ have no simple magic; allow by size
        return False, "Invalid MRI: unrecognized format (expected NIfTI, NRRD, or gzip)"

    # EEG: EDF/BDF have "0       " (8 bytes) version at start
    if detected_type == DetectedFileType.EEG:
        if len(data) < 8:
            return False, "EEG file too short"
        try:
            header = data[:8].decode("ascii", errors="strict")
            if header.startswith("0 ") or header == "0       ":
                return True, None  # EDF version
            if data[:4] == b"BIOS" or data[:4] == b"EDF+":
                return True, None  # BDF/EDF+ variants
        except UnicodeDecodeError:
            pass
        # FIF (MNE): binary format; allow if reasonable size
        if len(data) >= 16:
            return True, None
        return False, "Invalid EEG: unrecognized header (expected EDF/BDF format)"

    # MOLECULE: PDB, SDF, MOL, MOL2 — check for format markers
    if detected_type in (DetectedFileType.MOLECULE, DetectedFileType.SMILES):
        if len(data) < 4:
            return False, "Molecule file too short"
        try:
            text = data[:2000].decode("utf-8", errors="replace")
            # PDB: ATOM, HETATM, or HEADER
            if "ATOM" in text or "HETATM" in text or "HEADER" in text:
                return True, None
            # SDF: record delimiter
            if "$$$$" in text:
                return True, None
            # MOL/MOL2: MDL or Tripos markers
            if "M  END" in text or "@<TRIPOS>MOLECULE" in text:
                return True, None
            # SMILES: single-line notation (when content is short)
            if len(data) < 600 and _SMILES_PATTERN.match(text.strip()):
                return True, None
        except Exception:
            pass
        # Allow if we can't determine (e.g. binary MOL) — minimal size check
        if len(data) >= 10:
            return True, None
        return False, "Invalid molecule: unrecognized format"

    # TEXT, UNKNOWN: minimal validation
    return True, None


def detect_smiles(text: str) -> bool:
    """Check whether a short string looks like a SMILES molecular notation.

    Useful when the content body is available but filename/MIME give no hints.
    """
    text = text.strip()
    if not text or len(text) > 500 or " " in text:
        return False
    return bool(_SMILES_PATTERN.match(text))


# ═══════════════════════════════════════════════════════════════════════
#  IMAGE PREPROCESSING
# ═══════════════════════════════════════════════════════════════════════

def preprocess_image(
    pil_image: Image.Image,
    target_size: Tuple[int, int] = (224, 224),
    grayscale: bool = False,
) -> np.ndarray:
    """Resize and normalise a PIL image into a NCHW float32 tensor.

    Suitable for common medical CNN backbones (ResNet, DenseNet, etc.).

    Parameters
    ----------
    pil_image : PIL.Image.Image
        Input image in any mode (RGB, L, RGBA, P, etc.).
    target_size : tuple[int, int]
        (width, height) to resize to.  Default ``(224, 224)``.
    grayscale : bool
        If ``True``, convert to single-channel grayscale (common for
        X-ray and DICOM previews).

    Returns
    -------
    np.ndarray
        Float32 tensor with shape ``(1, C, H, W)`` and values in [0, 1].
    """
    # Ensure consistent colour mode
    if grayscale:
        pil_image = pil_image.convert("L")
    elif pil_image.mode not in ("RGB", "L"):
        pil_image = pil_image.convert("RGB")

    pil_resized = pil_image.resize(target_size, Image.LANCZOS)
    arr = np.asarray(pil_resized, dtype=np.float32) / 255.0

    # Guarantee 3-D (H, W, C)
    if arr.ndim == 2:
        arr = np.expand_dims(arr, axis=-1)

    # HWC → CHW → NCHW
    arr = np.transpose(arr, (2, 0, 1))
    arr = np.expand_dims(arr, axis=0)
    return arr


# ═══════════════════════════════════════════════════════════════════════
#  STRUCTURED JSON LOGGING
# ═══════════════════════════════════════════════════════════════════════

@lru_cache(maxsize=64)
def _get_logger(name: str) -> logging.Logger:
    """Cache logger instances to avoid repeated ``getLogger`` lookups."""
    return logging.getLogger(name)


def json_log(logger_name: str, level: str, **fields: Any) -> None:
    """Emit a single JSON-formatted log line.

    Parameters
    ----------
    logger_name : str
        Logger name (e.g. ``"manthana.ai-router"``).
    level : str
        Log level as a string: ``"debug"``, ``"info"``, ``"warning"``,
        ``"error"``, ``"critical"``.
    **fields
        Arbitrary key-value pairs serialised into the JSON line.
    """
    log_obj = _get_logger(logger_name)
    numeric_level = getattr(logging, level.upper(), logging.INFO)

    # Skip serialisation entirely if level is suppressed
    if not log_obj.isEnabledFor(numeric_level):
        return

    try:
        record = json.dumps(fields, default=str, ensure_ascii=False)
    except (TypeError, ValueError):
        record = str(fields)

    log_obj.log(numeric_level, record)
