"""
Unit tests for services/shared/utils.py.
"""
import pytest
import logging
from services.shared.utils import (
    DetectedFileType,
    detect_file_type,
    detect_smiles,
    format_response,
    generate_request_id,
    json_log,
    preprocess_image,
    validate_file_content,
)


class TestDetectFileType:
    """Tests for detect_file_type."""

    def test_dicom_extension(self):
        assert detect_file_type("scan.dcm", None) == DetectedFileType.DICOM
        assert detect_file_type("scan.dicom", None) == DetectedFileType.DICOM

    def test_mri_extension(self):
        assert detect_file_type("brain.nii.gz", None) == DetectedFileType.MRI
        assert detect_file_type("scan.nii", None) == DetectedFileType.MRI
        assert detect_file_type("scan.nrrd", None) == DetectedFileType.MRI

    def test_eeg_extension(self):
        assert detect_file_type("eeg.edf", None) == DetectedFileType.EEG
        assert detect_file_type("eeg.edf", "application/octet-stream") == DetectedFileType.EEG

    def test_ecg_csv(self):
        assert detect_file_type("ecg_lead1.csv", None) == DetectedFileType.ECG_CSV
        assert detect_file_type("ekg_data.csv", "text/csv") == DetectedFileType.ECG_CSV
        assert detect_file_type("data.csv", None) == DetectedFileType.TEXT

    def test_smiles_molecule(self):
        assert detect_file_type("mol.pdb", None) == DetectedFileType.MOLECULE
        assert detect_file_type("compound.sdf", None) == DetectedFileType.MOLECULE

    def test_pathology_image(self):
        assert detect_file_type("slide.svs", None) == DetectedFileType.PATHOLOGY
        assert detect_file_type("biopsy.ndpi", None) == DetectedFileType.PATHOLOGY

    def test_image_keyword_fundus(self):
        assert detect_file_type("fundus_image.png", "image/png") == DetectedFileType.FUNDUS
        assert detect_file_type("retina_scan.jpg", "image/jpeg") == DetectedFileType.FUNDUS

    def test_image_keyword_skin(self):
        assert detect_file_type("skin_lesion.png", "image/png") == DetectedFileType.SKIN
        assert detect_file_type("derm_photo.jpg", None) == DetectedFileType.SKIN

    def test_image_default_xray(self):
        assert detect_file_type("scan.png", "image/png") == DetectedFileType.XRAY
        assert detect_file_type("xray.jpg", "image/jpeg") == DetectedFileType.XRAY

    def test_dicom_mime(self):
        assert detect_file_type("file.bin", "application/dicom") == DetectedFileType.DICOM

    def test_unknown_empty(self):
        assert detect_file_type("", "") == DetectedFileType.UNKNOWN

    def test_text_fallback(self):
        assert detect_file_type("notes.txt", "text/plain") == DetectedFileType.TEXT

    def test_nii_gz_before_nii(self):
        assert detect_file_type("scan.nii.gz", None) == DetectedFileType.MRI


class TestValidateFileContent:
    """Tests for validate_file_content."""

    def test_dicom_valid(self):
        # 128-byte preamble + "DICM" at offset 128
        data = b"\x00" * 128 + b"DICM" + b"\x00" * 100
        ok, err = validate_file_content(data, DetectedFileType.DICOM)
        assert ok is True
        assert err is None

    def test_dicom_invalid_no_magic(self):
        data = b"\x00" * 132  # No "DICM"
        ok, err = validate_file_content(data, DetectedFileType.DICOM)
        assert ok is False
        assert "DICM" in (err or "")

    def test_dicom_too_short(self):
        data = b"\x00" * 100
        ok, err = validate_file_content(data, DetectedFileType.DICOM)
        assert ok is False
        assert err is not None

    def test_image_valid_png(self):
        # Minimal valid PNG (1x1 pixel)
        png_header = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        # Simplified: use a real tiny PNG from PIL
        from PIL import Image
        from io import BytesIO
        img = Image.new("RGB", (1, 1), color=(0, 0, 0))
        buf = BytesIO()
        img.save(buf, format="PNG")
        data = buf.getvalue()
        ok, err = validate_file_content(data, DetectedFileType.XRAY)
        assert ok is True
        assert err is None

    def test_image_invalid_garbage(self):
        data = b"not an image at all\x00\x01\x02"
        ok, err = validate_file_content(data, DetectedFileType.XRAY)
        assert ok is False
        assert err is not None

    def test_empty_file(self):
        ok, err = validate_file_content(b"", DetectedFileType.TEXT)
        assert ok is False
        assert "empty" in (err or "").lower()

    def test_ecg_csv_valid(self):
        data = b"lead1,lead2\n0.1,0.2\n0.3,0.4\n"
        ok, err = validate_file_content(data, DetectedFileType.ECG_CSV)
        assert ok is True

    def test_unknown_skips_validation(self):
        ok, err = validate_file_content(b"anything", DetectedFileType.UNKNOWN)
        assert ok is True
        assert err is None


class TestDetectSmiles:
    """Tests for detect_smiles."""

    def test_valid_smiles(self):
        assert detect_smiles("CC(=O)NC1=CC=C(O)C=C1") is True
        assert detect_smiles("CCO") is True

    def test_invalid_smiles(self):
        assert detect_smiles("") is False
        assert detect_smiles("hello world") is False
        assert detect_smiles("C C") is False
        assert detect_smiles("x" * 501) is False


class TestFormatResponse:
    """Tests for format_response."""

    def test_success_response(self):
        rid = generate_request_id()
        out = format_response("success", "ai-router", {"key": "value"}, None, rid)
        assert out["status"] == "success"
        assert out["service"] == "ai-router"
        assert out["data"] == {"key": "value"}
        assert out["error"] is None
        assert out["request_id"] == rid
        assert "timestamp" in out

    def test_error_response(self):
        rid = generate_request_id()
        out = format_response("error", "nlp", None, {"message": "Failed"}, rid)
        assert out["status"] == "error"
        assert out["error"] == {"message": "Failed"}
        assert out["data"] is None

    def test_with_disclaimer(self):
        rid = generate_request_id()
        out = format_response("success", "radiology", {}, None, rid, disclaimer="AI-generated")
        assert out["disclaimer"] == "AI-generated"

    def test_include_timestamp_false(self):
        rid = generate_request_id()
        out = format_response("success", "test", {}, None, rid, include_timestamp=False)
        assert "timestamp" not in out


class TestJsonLog:
    """Tests for json_log."""

    def test_logs_without_error(self):
        json_log("test.manthana", "info", event="test", key="value")

    def test_handles_invalid_json_serializable(self):
        json_log("test.manthana", "info", bad_obj=object())


class TestGenerateRequestId:
    """Tests for generate_request_id."""

    def test_returns_uuid_format(self):
        rid = generate_request_id()
        assert len(rid) == 36
        assert rid.count("-") == 4


class TestPreprocessImage:
    """Tests for preprocess_image."""

    def test_grayscale_output_shape(self):
        from PIL import Image
        import numpy as np
        img = Image.new("L", (100, 100), color=128)
        arr = preprocess_image(img, grayscale=True)
        assert arr.shape == (1, 1, 224, 224)
        assert arr.dtype == np.float32
        assert 0 <= arr.min() <= arr.max() <= 1

    def test_rgb_output_shape(self):
        from PIL import Image
        import numpy as np
        img = Image.new("RGB", (50, 50), color=(255, 0, 0))
        arr = preprocess_image(img)
        assert arr.shape == (1, 3, 224, 224)
        assert arr.dtype == np.float32

    def test_rgba_converted(self):
        from PIL import Image
        import numpy as np
        img = Image.new("RGBA", (50, 50), color=(255, 0, 0, 128))
        arr = preprocess_image(img)
        assert arr.shape == (1, 3, 224, 224)

    def test_p_mode_converted(self):
        from PIL import Image
        import numpy as np
        img = Image.new("P", (50, 50))
        arr = preprocess_image(img)
        assert arr.shape == (1, 3, 224, 224)
