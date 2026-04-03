"""
Unit tests for api.py pure helper functions.
"""
import pytest
from api import _safe_filename_part
from services.shared.medical_ontology import icd10_lookup, infer_rads_system, lookup_icd_radlex


class TestIcd10Lookup:
    """Tests for icd10_lookup."""

    def test_exact_match(self):
        result = icd10_lookup("diabetes")
        assert len(result) > 0
        assert any(r.get("code") == "E11" for r in result)

    def test_prefix_match(self):
        result = icd10_lookup("diab")
        assert len(result) > 0

    def test_substring_match(self):
        result = icd10_lookup("betes")
        assert len(result) > 0

    def test_code_search(self):
        result = icd10_lookup("E11")
        assert len(result) > 0
        assert any(r.get("code") == "E11" for r in result)

    def test_description_search(self):
        result = icd10_lookup("type 2 diabetes")
        assert len(result) > 0

    def test_unknown_fallback(self):
        result = icd10_lookup("xyznonexistent123")
        assert len(result) == 1
        assert result[0]["code"] == "R69"
        assert "Unknown condition" in result[0]["description"]

    def test_strips_whitespace(self):
        result = icd10_lookup("  diabetes  ")
        assert len(result) > 0

    def test_lowercase(self):
        result = icd10_lookup("DIABETES")
        assert len(result) > 0


class TestReportLookupIcdRadlex:
    """Tests for lookup_icd_radlex."""

    def test_in_report_icd10_radlex(self):
        result = lookup_icd_radlex("pleural effusion")
        assert result["icd10_code"] == "J90"
        assert result["radlex_id"] == "RID34539"
        assert result["radlex_label"] == "Pleural effusion"

    def test_in_icd10_db_only(self):
        result = lookup_icd_radlex("diabetes")
        assert result["icd10_code"] == "E11"
        assert result["radlex_id"] is None
        assert result["radlex_label"] is None

    def test_neither_returns_empty_meta(self):
        result = lookup_icd_radlex("unknown_condition_xyz")
        assert result["icd10_code"] is None
        assert result["icd10_description"] is None

    def test_strips_and_lowercases(self):
        result = lookup_icd_radlex("  PLEURAL EFFUSION  ")
        assert result["icd10_code"] == "J90"


class TestReportInferRads:
    """Tests for infer_rads_system."""

    def test_lung(self):
        result = infer_rads_system("lung_ct")
        assert result["system"] == "Lung-RADS"

    def test_chest_ct(self):
        result = infer_rads_system("chest CT scan")
        assert result["system"] == "Lung-RADS"

    def test_mammogram(self):
        result = infer_rads_system("mammogram")
        assert result["system"] == "BI-RADS"

    def test_breast(self):
        result = infer_rads_system("breast imaging")
        assert result["system"] == "BI-RADS"

    def test_liver(self):
        result = infer_rads_system("liver mri")
        assert result["system"] == "LI-RADS"

    def test_prostate(self):
        result = infer_rads_system("prostate")
        assert result["system"] == "PI-RADS"

    def test_thyroid(self):
        result = infer_rads_system("thyroid ultrasound")
        assert result["system"] == "TI-RADS"

    def test_default(self):
        result = infer_rads_system("unknown modality")
        assert result["system"] == "Lung-RADS"
        assert "reference" in result


class TestSafeFilenamePart:
    """Tests for _safe_filename_part."""

    def test_normal(self):
        assert _safe_filename_part("Lung-RADS") == "lung-rads"

    def test_empty(self):
        assert _safe_filename_part("") == "report"

    def test_none_like(self):
        assert _safe_filename_part("   ") == "report"

    def test_special_chars(self):
        assert _safe_filename_part("ACR 2024!") == "acr_2024"

    def test_strips_leading_trailing_underscores(self):
        assert _safe_filename_part("__test__") == "test"
