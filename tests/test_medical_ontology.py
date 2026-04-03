"""Unit tests for services/shared/medical_ontology.py."""
import pytest
from services.shared.medical_ontology import (
    enrich_findings_with_ontology,
    icd10_lookup,
    infer_rads_system,
    lookup_icd_radlex,
)


class TestIcd10Lookup:
    def test_exact_match(self):
        result = icd10_lookup("diabetes")
        assert len(result) > 0
        assert any(r.get("code") == "E11" for r in result)

    def test_unknown_fallback(self):
        result = icd10_lookup("xyznonexistent123")
        assert len(result) == 1
        assert result[0]["code"] == "R69"


class TestLookupIcdRadlex:
    def test_pleural_effusion(self):
        r = lookup_icd_radlex("pleural effusion")
        assert r["icd10_code"] == "J90"
        assert r["radlex_id"] == "RID34539"

    def test_diabetes_fallback(self):
        r = lookup_icd_radlex("diabetes")
        assert r["icd10_code"] == "E11"
        assert r["radlex_id"] is None


class TestInferRadsSystem:
    def test_lung(self):
        assert infer_rads_system("lung_ct")["system"] == "Lung-RADS"

    def test_mammogram(self):
        assert infer_rads_system("mammogram")["system"] == "BI-RADS"

    def test_liver(self):
        assert infer_rads_system("liver")["system"] == "LI-RADS"


class TestEnrichFindingsWithOntology:
    """Tests for enrich_findings_with_ontology (shared report enrichment)."""

    def test_dict_findings(self):
        findings = [
            {"label": "pleural effusion", "confidence": 0.9, "severity": "moderate"},
            {"label": "cardiomegaly", "confidence": 0.85, "severity": "clear"},
        ]
        out = enrich_findings_with_ontology(findings, "chest_xray")
        assert "enriched_findings" in out
        assert len(out["enriched_findings"]) == 2
        assert out["enriched_findings"][0]["icd10_code"] == "J90"
        assert out["enriched_findings"][1]["icd10_code"] == "R93.1"
        assert out["rads_score"]["system"] == "Lung-RADS"
        assert out["triage_level"] == "URGENT"  # confidence 0.85 >= 0.85

    def test_triage_routine(self):
        findings = [{"label": "atelectasis", "confidence": 0.5, "severity": "clear"}]
        out = enrich_findings_with_ontology(findings, "chest_xray")
        assert out["triage_level"] == "ROUTINE"

    def test_triage_severe(self):
        findings = [{"label": "pneumonia", "confidence": 0.7, "severity": "severe"}]
        out = enrich_findings_with_ontology(findings, "chest_xray")
        assert out["triage_level"] == "URGENT"
