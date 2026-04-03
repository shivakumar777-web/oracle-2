"""
Unit tests for services/pathology/main.py pure functions.
"""
import pytest
from services.pathology.main import _map_patch_label_to_tissue


class TestMapPatchLabelToTissue:
    """Tests for _map_patch_label_to_tissue."""

    def test_tumor(self):
        assert _map_patch_label_to_tissue("adenocarcinoma") == "tumor"
        assert _map_patch_label_to_tissue("carcinoma") == "tumor"
        assert _map_patch_label_to_tissue("malignant") == "tumor"

    def test_inflammatory(self):
        assert _map_patch_label_to_tissue("inflammation") == "inflammatory"
        assert _map_patch_label_to_tissue("inflammatory") == "inflammatory"

    def test_normal(self):
        assert _map_patch_label_to_tissue("normal") == "normal"
        assert _map_patch_label_to_tissue("benign") == "normal"
        assert _map_patch_label_to_tissue("healthy") == "normal"

    def test_benign_like_fallback(self):
        assert _map_patch_label_to_tissue("unknown") == "benign_like"
