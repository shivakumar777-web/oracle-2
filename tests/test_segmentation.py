"""
Unit tests for services/segmentation/main.py pure functions.
"""
import io
import base64
import numpy as np
import pytest
from PIL import Image
from services.segmentation.main import (
    simple_threshold_segmentation,
    mask_to_contours,
    encode_mask_png,
)


class TestSimpleThresholdSegmentation:
    """Tests for simple_threshold_segmentation."""

    def test_returns_mask(self):
        img = Image.new("L", (10, 10), color=128)
        mask = simple_threshold_segmentation(img)
        assert mask.shape == (10, 10)
        assert mask.dtype == np.uint8
        assert set(np.unique(mask)).issubset({0, 1})

    def test_binary_output(self):
        img = Image.new("L", (20, 20), color=200)
        mask = simple_threshold_segmentation(img)
        assert np.all((mask == 0) | (mask == 1))


class TestMaskToContours:
    """Tests for mask_to_contours."""

    def test_returns_list(self):
        mask = np.zeros((10, 10), dtype=np.uint8)
        mask[2:8, 2:8] = 1
        contours = mask_to_contours(mask.astype(float))
        assert isinstance(contours, list)


class TestEncodeMaskPng:
    """Tests for encode_mask_png."""

    def test_returns_base64(self):
        mask = np.array([[0, 1], [1, 0]], dtype=np.uint8)
        encoded = encode_mask_png(mask)
        assert isinstance(encoded, str)
        decoded = base64.b64decode(encoded)
        assert len(decoded) > 0
