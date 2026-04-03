"""
Unit tests for services/imaging-utils/main.py pure functions.
imaging-utils has hyphen in dir name; load via importlib.
Requires nibabel, pydicom - skip if not installed.
"""
import base64
import importlib.util
import os
import numpy as np
import pytest

_IMAGING_AVAILABLE = False
apply_window = encode_png = None
try:
    _imaging_path = os.path.join(os.path.dirname(__file__), "..", "services", "imaging-utils", "main.py")
    _spec = importlib.util.spec_from_file_location("imaging_utils_main", _imaging_path)
    _imaging_mod = importlib.util.module_from_spec(_spec)
    _spec.loader.exec_module(_imaging_mod)
    apply_window = _imaging_mod.apply_window
    encode_png = _imaging_mod.encode_png
    _IMAGING_AVAILABLE = True
except ImportError:
    pass


@pytest.mark.skipif(not _IMAGING_AVAILABLE, reason="imaging-utils requires nibabel, pydicom")
class TestApplyWindow:
    """Tests for apply_window."""

    def test_clips_and_normalizes(self):
        arr = np.array([0, 50, 100, 150, 200], dtype=np.float32)
        out = apply_window(arr, center=100, width=100)
        assert out.dtype == np.uint8
        assert out.min() >= 0
        assert out.max() <= 255

    def test_preserves_shape(self):
        arr = np.ones((10, 10), dtype=np.float32) * 40
        out = apply_window(arr, center=40, width=80)
        assert out.shape == (10, 10)


@pytest.mark.skipif(not _IMAGING_AVAILABLE, reason="imaging-utils requires nibabel, pydicom")
class TestEncodePng:
    """Tests for encode_png."""

    def test_returns_base64(self):
        arr = np.zeros((5, 5), dtype=np.uint8)
        encoded = encode_png(arr)
        assert isinstance(encoded, str)
        decoded = base64.b64decode(encoded)
        assert len(decoded) > 0
