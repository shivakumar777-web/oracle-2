"""
Unit tests for ai-router main.py pure helper functions.
"""
import os
import sys
import importlib.util
import pytest

from services.shared.medical_ontology import infer_rads_system, lookup_icd_radlex

# Load ai-router main (dir has hyphen)
_router_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "services", "ai-router"))
if _router_dir not in sys.path:
    sys.path.insert(0, _router_dir)
_spec = importlib.util.spec_from_file_location("ai_router_main", os.path.join(_router_dir, "main.py"))
_mod = importlib.util.module_from_spec(_spec)
sys.modules["ai_router_main"] = _mod
_spec.loader.exec_module(_mod)

_detect_route_for_file = _mod._detect_route_for_file
_pick_downstream_endpoint = _mod._pick_downstream_endpoint
_merge_and_deduplicate = _mod._merge_and_deduplicate
CircuitBreaker = _mod.CircuitBreaker


class TestLookupIcdRadlex:
    def test_pleural_effusion(self):
        r = lookup_icd_radlex("pleural effusion")
        assert r["icd10_code"] == "J90"
        assert r["radlex_id"] == "RID34539"

    def test_unknown(self):
        r = lookup_icd_radlex("unknown_xyz")
        assert r["icd10_code"] is None


class TestInferRadsSystem:
    def test_lung(self):
        assert infer_rads_system("lung_ct")["system"] == "Lung-RADS"

    def test_mammogram(self):
        assert infer_rads_system("mammogram")["system"] == "BI-RADS"

    def test_liver(self):
        assert infer_rads_system("liver")["system"] == "LI-RADS"

    def test_default(self):
        assert infer_rads_system("other")["system"] == "Lung-RADS"


class TestDetectRouteForFile:
    def test_type_hint_radiology(self):
        assert _detect_route_for_file("x.png", "image/png", "chest xray") == "radiology"

    def test_type_hint_ecg(self):
        assert _detect_route_for_file("x.csv", "text/csv", "ecg") == "ecg"

    def test_filename_ecg(self):
        assert _detect_route_for_file("ecg_lead1.csv", "text/csv", None) == "ecg"

    def test_default_radiology(self):
        assert _detect_route_for_file("scan.png", "image/png", None) == "radiology"


class TestPickDownstreamEndpoint:
    def test_ecg(self):
        assert _pick_downstream_endpoint("ecg", "x.csv") == "/analyze/ecg"

    def test_brain_mri(self):
        assert _pick_downstream_endpoint("brain", "scan.nii.gz") == "/analyze/mri"

    def test_brain_eeg(self):
        assert _pick_downstream_endpoint("brain", "eeg.edf") == "/analyze/eeg"


class TestMergeAndDeduplicate:
    def test_merges(self):
        a = [{"id": "1", "title": "A"}]
        b = [{"id": "2", "title": "B"}]
        out = _merge_and_deduplicate(a, b)
        assert len(out) == 2

    def test_dedup_by_id(self):
        a = [{"id": "1", "title": "A"}]
        b = [{"id": "1", "title": "A2"}]
        out = _merge_and_deduplicate(a, b)
        assert len(out) == 1
        assert out[0]["title"] == "A"


@pytest.mark.asyncio
class TestCircuitBreaker:
    async def test_closed_initial(self):
        cb = CircuitBreaker(failure_threshold=3, reset_timeout=60)
        assert await cb.can_call("srv") is True

    async def test_on_success(self):
        cb = CircuitBreaker()
        await cb.on_success("srv")
        assert await cb.state("srv") == "closed"

    async def test_on_failure_opens(self):
        cb = CircuitBreaker(failure_threshold=2, reset_timeout=1)
        await cb.on_failure("srv")
        await cb.on_failure("srv")
        assert await cb.state("srv") == "open"
        assert await cb.can_call("srv") is False
