"""
Contract tests for research-service deep research prompts (Phase 3.3 intent structures).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

_root = Path(__file__).resolve().parents[1]
_rs = _root / "services" / "research-service"
# Load research-service orchestrator by file path so we never pick up repo-root orchestrator.py
# (which may already be in sys.modules from other tests).
_orch_path = _rs / "orchestrator.py"
_spec = importlib.util.spec_from_file_location("research_service_orchestrator", _orch_path)
if _spec is None or _spec.loader is None:
    raise RuntimeError(f"Cannot load {_orch_path}")
_rs_orch = importlib.util.module_from_spec(_spec)
sys.path.insert(0, str(_root))
sys.path.insert(0, str(_rs))
_spec.loader.exec_module(_rs_orch)
build_deep_research_prompt = _rs_orch.build_deep_research_prompt
_sections_json_template = _rs_orch._sections_json_template


def _prompts(intent: str, output_format: str = "structured"):
    system_prompt, user_prompt = build_deep_research_prompt(
        question="Test question on diabetes management",
        domains=["allopathy"],
        subdomains=[],
        subdomain_map={},
        intent=intent,
        depth="comprehensive",
        context_text="ctx",
        sources_block="1. Source A (pubmed)",
        output_format=output_format,
        citation_style="vancouver",
        lang="en",
    )
    return system_prompt, user_prompt


def test_structured_thesis_sections_in_prompt():
    _, user = _prompts("thesis", "structured")
    assert '"id": "abstract"' in user
    assert "Review of Literature" in user
    assert "abstract (Abstract)" in _prompts("thesis")[0]


def test_structured_prisma_sections_in_prompt():
    _, user = _prompts("systematic-review", "structured")
    assert "Methods (PRISMA)" in user
    assert '"id": "methods"' in user
    assert "PICO" in _prompts("systematic-review")[0]


def test_structured_case_report_sections_in_prompt():
    _, user = _prompts("case-report", "structured")
    assert "Patient Information" in user
    assert '"id": "patient"' in user
    assert "CARE" in _prompts("case-report")[0]


def test_structured_clinical_default_sections():
    _, user = _prompts("clinical", "structured")
    assert "Research Summary" in user
    assert '"id": "summary"' in user


def test_summary_format_single_section_any_intent():
    _, user = _prompts("thesis", "summary")
    assert user.count('"id": "summary"') == 1
    assert "Research Summary" in user
    tpl = _sections_json_template("thesis", "summary")
    assert '"id": "summary"' in tpl
    assert '"id": "abstract"' not in tpl


def test_bullets_format_single_section():
    _, user = _prompts("clinical", "bullets")
    assert '"id": "findings"' in user
    tpl = _sections_json_template("systematic-review", "bullets")
    assert '"id": "findings"' in tpl
