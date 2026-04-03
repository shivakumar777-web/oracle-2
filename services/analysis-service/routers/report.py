"""
report.py — Report Router
==========================
Report enrichment with ICD-10, RadLex, RADS scoring.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from config import AnalysisSettings, get_analysis_settings

logger = logging.getLogger("manthana.analysis.report")


# ═══════════════════════════════════════════════════════════════════════
#  MODELS
# ═══════════════════════════════════════════════════════════════════════

class FindingInput(BaseModel):
    label: str
    confidence: float
    severity: str = "moderate"


class ReportEnrichRequest(BaseModel):
    modality: str
    findings: List[FindingInput]


class EnrichedFinding(BaseModel):
    label: str
    confidence: float
    severity: str
    icd10_code: str
    icd10_description: str
    radlex_id: str
    radlex_label: str
    radlex_url: str
    reference_url: str
    differential: List[str]


# ═══════════════════════════════════════════════════════════════════════
#  ONTOLOGY DATABASE (simplified - would connect to real DB)
# ═══════════════════════════════════════════════════════════════════════

# Simplified ICD-10 mapping
ICD10_MAPPING = {
    "cardiomegaly": ("I51.7", "Cardiomegaly"),
    "pneumonia": ("J18.9", "Pneumonia, unspecified organism"),
    "pneumothorax": ("J93.9", "Pneumothorax, unspecified"),
    "fracture": ("T14.8", "Other injury of unspecified body region"),
    "infiltrate": ("J98.4", "Other disorders of lung"),
    "mass": ("R22.9", "Localized swelling, mass and lump, unspecified"),
    "nodule": ("R22.9", "Localized swelling, mass and lump, unspecified"),
    "lesion": ("R22.9", "Localized swelling, mass and lump, unspecified"),
    "effusion": ("J91.8", "Pleural effusion in other conditions classified elsewhere"),
    "atelectasis": ("J98.19", "Other atelectasis"),
    "consolidation": ("J18.9", "Pneumonia, unspecified organism"),
}

# Simplified RadLex mapping
RADLEX_MAPPING = {
    "cardiomegaly": ("RID5016", "Cardiomegaly", "https://radlex.org/RID/RID5016"),
    "pneumonia": ("RID5352", "Pneumonia", "https://radlex.org/RID/RID5352"),
    "pneumothorax": ("RID5017", "Pneumothorax", "https://radlex.org/RID/RID5017"),
    "fracture": ("RID4981", "Fracture", "https://radlex.org/RID/RID4981"),
    "infiltrate": ("RID5352", "Infiltrate", "https://radlex.org/RID/RID5352"),
    "mass": ("RID3874", "Mass", "https://radlex.org/RID/RID3874"),
    "nodule": ("RID3875", "Nodule", "https://radlex.org/RID/RID3875"),
    "lesion": ("RID3874", "Lesion", "https://radlex.org/RID/RID3874"),
    "effusion": ("RID5018", "Pleural effusion", "https://radlex.org/RID/RID5018"),
    "atelectasis": ("RID5019", "Atelectasis", "https://radlex.org/RID/RID5019"),
    "consolidation": ("RID5352", "Consolidation", "https://radlex.org/RID/RID5352"),
}

# RADS scoring for lung findings
RADS_CATEGORIES = {
    "cardiomegaly": {"category": "Lung-RADS 3", "meaning": "Probably benign", "action": "6-month follow-up"},
    "nodule": {"category": "Lung-RADS 4A", "meaning": "Suspicious", "action": "3-month follow-up"},
    "mass": {"category": "Lung-RADS 4X", "meaning": "Highly suspicious", "action": "Immediate workup"},
}


def lookup_icd10(label: str) -> tuple[str, str]:
    """Lookup ICD-10 code for a finding label."""
    lower_label = label.lower()
    for key, value in ICD10_MAPPING.items():
        if key in lower_label:
            return value
    return ("R22.9", "Localized swelling, mass and lump, unspecified")


def lookup_radlex(label: str) -> tuple[str, str, str]:
    """Lookup RadLex ID for a finding label."""
    lower_label = label.lower()
    for key, value in RADLEX_MAPPING.items():
        if key in lower_label:
            return value
    return ("RID3874", "Mass", "https://radlex.org/RID/RID3874")


def get_differential(label: str, modality: str) -> List[str]:
    """Get differential diagnoses for a finding."""
    differentials = {
        "cardiomegaly": ["Hypertensive heart disease", "Valvular heart disease", "Cardiomyopathy"],
        "infiltrate": ["Bacterial pneumonia", "Viral pneumonia", "Aspiration"],
        "nodule": ["Granuloma", "Primary lung cancer", "Metastasis"],
        "mass": ["Primary carcinoma", "Metastatic lesion", "Lymphoma"],
    }
    lower_label = label.lower()
    for key, value in differentials.items():
        if key in lower_label:
            return value
    return ["Clinical correlation recommended", "Further imaging if indicated"]


def infer_rads(label: str, modality: str) -> Optional[Dict[str, str]]:
    """Infer RADS category for a finding."""
    if modality not in ["chest_xray", "ct", "lung"]:
        return None
    lower_label = label.lower()
    for key, value in RADS_CATEGORIES.items():
        if key in lower_label:
            return value
    return None


def infer_triage(findings: List[FindingInput]) -> str:
    """Infer triage level from findings."""
    has_critical = any(
        f.severity.lower() in ["critical", "emergency"]
        for f in findings
    )
    has_urgent = any(
        f.severity.lower() in ["urgent", "moderate"]
        for f in findings
    )
    if has_critical:
        return "EMERGENT"
    elif has_urgent:
        return "URGENT"
    return "ROUTINE"


def enrich_findings_with_ontology(
    findings: List[FindingInput],
    modality: str,
) -> Dict[str, Any]:
    """Enrich findings with ICD-10, RadLex, and differential."""
    enriched = []

    for finding in findings:
        icd_code, icd_desc = lookup_icd10(finding.label)
        radlex_id, radlex_label, radlex_url = lookup_radlex(finding.label)

        enriched.append({
            "label": finding.label,
            "confidence": finding.confidence,
            "severity": finding.severity,
            "icd10_code": icd_code,
            "icd10_description": icd_desc,
            "radlex_id": radlex_id,
            "radlex_label": radlex_label,
            "radlex_url": radlex_url,
            "reference_url": radlex_url,
            "differential": get_differential(finding.label, modality),
        })

    # Get RADS score
    rads_score = None
    for finding in findings:
        rads = infer_rads(finding.label, modality)
        if rads:
            rads_score = {
                "system": "Lung-RADS",
                "score": rads["category"],
                "meaning": rads["meaning"],
                "action": rads["action"],
                "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads",
            }
            break

    triage_level = infer_triage(findings)

    # Generate impression
    impression_parts = []
    for finding in findings:
        if finding.severity.lower() == "critical":
            impression_parts.append(f"Critical: {finding.label}")
        elif finding.severity.lower() == "moderate":
            impression_parts.append(f"Moderate: {finding.label}")

    impression = "; ".join(impression_parts) if impression_parts else "No acute findings"

    return {
        "enriched_findings": enriched,
        "rads_score": rads_score,
        "triage_level": triage_level,
        "impression": impression,
        "report_standard": "HL7 FHIR R4 / DICOM SR",
    }


# ═══════════════════════════════════════════════════════════════════════
#  ROUTER FACTORY
# ═══════════════════════════════════════════════════════════════════════

def create_report_router(limiter) -> APIRouter:
    """Create the report router."""
    router = APIRouter(tags=["reports"])

    @router.post("/report/enrich")
    @limiter.limit("60/minute")
    async def enrich_report(
        request: Request,
        body: ReportEnrichRequest,
        settings: AnalysisSettings = Depends(get_analysis_settings),
    ):
        """Enrich findings with ICD-10, RadLex, RADS scoring."""
        rid = getattr(request.state, "request_id", "unknown")

        if not settings.ANALYSIS_ENABLE_ENRICHMENT:
            return JSONResponse(
                status_code=503,
                content={
                    "status": "error",
                    "service": "analysis",
                    "error": "Report enrichment disabled",
                    "request_id": rid,
                },
            )

        # Convert input findings
        input_findings = [
            FindingInput(
                label=f.label,
                confidence=f.confidence,
                severity=f.severity,
            )
            for f in body.findings
        ]

        # Enrich
        enriched = enrich_findings_with_ontology(input_findings, body.modality)

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "analysis",
                "data": enriched,
                "error": None,
                "request_id": rid,
            },
        )

    @router.get("/snomed/lookup")
    @limiter.limit("100/minute")
    async def snomed_lookup(
        request: Request,
        term: str,
        settings: AnalysisSettings = Depends(get_analysis_settings),
    ):
        """SNOMED-CT concept lookup (simplified)."""
        rid = getattr(request.state, "request_id", "unknown")

        # Simplified mock SNOMED lookup
        snomed_concepts = [
            {"conceptId": "123456789", "preferredTerm": f"{term} (disorder)"},
            {"conceptId": "987654321", "preferredTerm": f"{term} (finding)"},
        ]

        return JSONResponse(
            status_code=200,
            content={
                "status": "success",
                "service": "analysis",
                "data": snomed_concepts,
                "error": None,
                "request_id": rid,
            },
        )

    return router
