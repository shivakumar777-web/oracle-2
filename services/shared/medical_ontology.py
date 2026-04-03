"""
medical_ontology.py — Manthana Shared Medical Ontology
========================================================
Single source of truth for ICD-10, RadLex, and RADS mappings.
Used by api.py, ai-router, and report enrichment.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

# ═══════════════════════════════════════════════════════════════════════
#  ICD-10 LOOKUP DATABASE
# ═══════════════════════════════════════════════════════════════════════

ICD10_DB: Dict[str, List[Dict[str, str]]] = {
    "pneumothorax":          [{"code": "J93.9",  "description": "Pneumothorax, unspecified"}],
    "tuberculosis":          [{"code": "A15.9",  "description": "Respiratory tuberculosis, unspecified"}],
    "diabetes":              [{"code": "E11",    "description": "Type 2 diabetes mellitus"}],
    "hypertension":          [{"code": "I10",    "description": "Essential (primary) hypertension"}],
    "pneumonia":             [{"code": "J18.9",  "description": "Pneumonia, unspecified organism"}],
    "asthma":                [{"code": "J45.9",  "description": "Asthma, unspecified"}],
    "copd":                  [{"code": "J44.9",  "description": "COPD, unspecified"}],
    "myocardial infarction": [{"code": "I21.9",  "description": "Acute myocardial infarction, unspecified"}],
    "heart failure":         [{"code": "I50.9",  "description": "Heart failure, unspecified"}],
    "stroke":                [{"code": "I63.9",  "description": "Cerebral infarction, unspecified"}],
    "epilepsy":              [{"code": "G40.9",  "description": "Epilepsy, unspecified"}],
    "anemia":                [{"code": "D64.9",  "description": "Anaemia, unspecified"}],
    "sepsis":                [{"code": "A41.9",  "description": "Sepsis, unspecified organism"}],
    "dengue":                [{"code": "A90",    "description": "Dengue fever (classical)"}],
    "malaria":               [{"code": "B54",    "description": "Unspecified malaria"}],
    "typhoid":               [{"code": "A01.0",  "description": "Typhoid fever"}],
    "pleural effusion":      [{"code": "J90",    "description": "Pleural effusion, not elsewhere classified"}],
    "cardiomegaly":          [{"code": "R93.1",  "description": "Abnormal findings on diagnostic imaging of heart"}],
    "atelectasis":           [{"code": "J98.11", "description": "Atelectasis"}],
    "appendicitis":          [{"code": "K37",    "description": "Unspecified appendicitis"}],
    "cholecystitis":         [{"code": "K81.9",  "description": "Cholecystitis, unspecified"}],
    "cirrhosis":             [{"code": "K74.6",  "description": "Other and unspecified cirrhosis of liver"}],
    "ckd":                   [{"code": "N18.9",  "description": "Chronic kidney disease, unspecified"}],
    "uti":                   [{"code": "N39.0",  "description": "Urinary tract infection, unspecified"}],
    "hypothyroidism":        [{"code": "E03.9",  "description": "Hypothyroidism, unspecified"}],
    "pancreatitis":          [{"code": "K85.9",  "description": "Acute pancreatitis, unspecified"}],
    "meningitis":            [{"code": "G03.9",  "description": "Meningitis, unspecified"}],
    "encephalitis":          [{"code": "G04.9",  "description": "Encephalitis, unspecified"}],
    "dvt":                   [{"code": "I82.9",  "description": "Venous embolism and thrombosis, unspecified"}],
    "pulmonary embolism":    [{"code": "I26.9",  "description": "Pulmonary embolism without acute cor pulmonale"}],
    "fracture":              [{"code": "T14.2",  "description": "Fracture of unspecified body region"}],
    "cellulitis":            [{"code": "L03.9",  "description": "Cellulitis, unspecified"}],
    "anaphylaxis":           [{"code": "T78.2",  "description": "Anaphylactic shock, unspecified"}],
    "dehydration":           [{"code": "E86.0",  "description": "Dehydration"}],
    "covid":                 [{"code": "U07.1",  "description": "COVID-19, virus identified"}],
    "migraine":              [{"code": "G43.9",  "description": "Migraine, unspecified"}],
    "gout":                  [{"code": "M10.9",  "description": "Gout, unspecified"}],
    "osteoarthritis":        [{"code": "M19.9",  "description": "Osteoarthritis, unspecified"}],
    "rheumatoid arthritis":  [{"code": "M06.9",  "description": "Rheumatoid arthritis, unspecified"}],
    "depression":            [{"code": "F32.9",  "description": "Major depressive disorder, single episode, unspecified"}],
    "anxiety":               [{"code": "F41.9",  "description": "Anxiety disorder, unspecified"}],
    "hepatitis b":           [{"code": "B16.9",  "description": "Acute hepatitis B without delta-agent"}],
    "hepatitis c":           [{"code": "B17.1",  "description": "Acute hepatitis C"}],
    "hiv":                   [{"code": "B20",    "description": "HIV disease"}],
    "psoriasis":             [{"code": "L40.9",  "description": "Psoriasis, unspecified"}],
    "eczema":                [{"code": "L30.9",  "description": "Dermatitis, unspecified"}],
    "glaucoma":              [{"code": "H40.9",  "description": "Glaucoma, unspecified"}],
    "cataract":              [{"code": "H26.9",  "description": "Cataract, unspecified"}],
    "iron deficiency":       [{"code": "E61.1",  "description": "Iron deficiency"}],
    "obesity":               [{"code": "E66.9",  "description": "Obesity, unspecified"}],
    "hyperlipidemia":        [{"code": "E78.5",  "description": "Hyperlipidaemia, unspecified"}],
    "peptic ulcer":          [{"code": "K27.9",  "description": "Peptic ulcer, unspecified"}],
    "gastritis":             [{"code": "K29.7",  "description": "Gastritis, unspecified"}],
    "kidney stones":         [{"code": "N20.0",  "description": "Calculus of kidney"}],
    "gallstones":            [{"code": "K80.2",  "description": "Calculus of gallbladder without cholecystitis"}],
}

ICD10_TERMS: List[str] = sorted(ICD10_DB.keys())


# ═══════════════════════════════════════════════════════════════════════
#  REPORT ENRICHMENT — ICD-10 + RadLex (in-memory)
# ═══════════════════════════════════════════════════════════════════════

REPORT_ICD10_RADLEX: Dict[str, Dict[str, str]] = {
    "pleural effusion": {
        "icd10_code": "J90",
        "icd10_description": "Pleural effusion",
        "radlex_id": "RID34539",
        "radlex_label": "Pleural effusion",
        "radlex_url": "https://radlex.org/RID/RID34539",
        "reference_url": "https://radiopaedia.org/articles/pleural-effusion-1",
    },
    "cardiomegaly": {
        "icd10_code": "R93.1",
        "icd10_description": "Abnormal findings on diagnostic imaging of heart",
        "radlex_id": "RID443424",
        "radlex_label": "Cardiomegaly",
        "radlex_url": "https://radlex.org/RID/RID443424",
        "reference_url": "https://radiopaedia.org/articles/cardiomegaly",
    },
    "atelectasis": {
        "icd10_code": "J98.11",
        "icd10_description": "Atelectasis",
        "radlex_id": "RID38866",
        "radlex_label": "Atelectasis",
        "radlex_url": "https://radlex.org/RID/RID38866",
        "reference_url": "https://radiopaedia.org/articles/atelectasis",
    },
    "pneumonia": {
        "icd10_code": "J18.9",
        "icd10_description": "Pneumonia, unspecified organism",
        "radlex_id": "RID39276",
        "radlex_label": "Pneumonia",
        "radlex_url": "https://radlex.org/RID/RID39276",
        "reference_url": "https://radiopaedia.org/articles/consolidation",
    },
    "pneumothorax": {
        "icd10_code": "J93.9",
        "icd10_description": "Pneumothorax, unspecified",
        "radlex_id": "RID39277",
        "radlex_label": "Pneumothorax",
        "radlex_url": "https://radlex.org/RID/RID39277",
        "reference_url": "https://radiopaedia.org/articles/pneumothorax",
    },
    "lung opacity": {
        "icd10_code": "R91",
        "icd10_description": "Abnormal finding of lung field",
        "radlex_id": "RID39278",
        "radlex_label": "Lung opacity",
        "radlex_url": "https://radlex.org/RID/RID39278",
        "reference_url": "https://radiopaedia.org/articles/lung-opacity",
    },
}


def lookup_icd_radlex(label: str) -> Dict[str, Optional[str]]:
    """Look up ICD-10 and RadLex metadata for a finding label.

    Falls back to ICD10_DB if not in REPORT_ICD10_RADLEX.
    """
    key = label.lower().strip()
    meta = REPORT_ICD10_RADLEX.get(key, {})
    if not meta and key in ICD10_DB:
        codes = ICD10_DB[key]
        c = codes[0] if codes else {}
        return {
            "icd10_code": c.get("code"),
            "icd10_description": c.get("description"),
            "radlex_id": None,
            "radlex_label": None,
            "radlex_url": None,
            "reference_url": None,
        }
    return {
        "icd10_code": meta.get("icd10_code"),
        "icd10_description": meta.get("icd10_description"),
        "radlex_id": meta.get("radlex_id"),
        "radlex_label": meta.get("radlex_label"),
        "radlex_url": meta.get("radlex_url"),
        "reference_url": meta.get("reference_url"),
    }


def infer_rads_system(modality: str) -> Dict[str, str]:
    """Infer RADS scoring system from imaging modality."""
    m = modality.lower()
    if "lung" in m or ("chest" in m and "ct" in m):
        return {
            "system": "Lung-RADS",
            "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads",
        }
    if "mammogram" in m or "breast" in m:
        return {
            "system": "BI-RADS",
            "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Bi-Rads",
        }
    if "liver" in m:
        return {
            "system": "LI-RADS",
            "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/LI-RADS",
        }
    if "prostate" in m:
        return {
            "system": "PI-RADS",
            "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/PI-RADS",
        }
    if "thyroid" in m:
        return {
            "system": "TI-RADS",
            "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/TI-RADS",
        }
    return {
        "system": "Lung-RADS",
        "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads",
    }


def enrich_findings_with_ontology(
    findings: List[Any],
    modality: str,
) -> Dict[str, Any]:
    """Enrich imaging findings with ICD-10, RadLex, and RADS metadata.

    Single source of truth for report enrichment. Used by api.py and ai-router.

    Args:
        findings: List of dict-like objects with label, confidence, severity.
        modality: Imaging modality (e.g. chest_xray, mammogram).

    Returns:
        {
            "enriched_findings": [...],
            "rads_meta": {"system": str, "reference": str},
            "rads_score": {"system", "score", "meaning", "action", "reference"},
            "triage_level": "ROUTINE" | "URGENT",
        }
    """
    enriched_findings: List[Dict[str, Any]] = []
    for f in findings:
        label = str(getattr(f, "label", None) or (f.get("label") if isinstance(f, dict) else "") or "")
        confidence = getattr(f, "confidence", None) or (f.get("confidence") if isinstance(f, dict) else None)
        severity = str(getattr(f, "severity", None) or (f.get("severity") if isinstance(f, dict) else "") or "")
        base: Dict[str, Any] = {"label": label, "confidence": confidence, "severity": severity}
        base.update(lookup_icd_radlex(label))
        base.setdefault("differential", [])
        enriched_findings.append(base)

    rads_meta = infer_rads_system(modality)
    rads_score: Dict[str, Any] = {
        "system": rads_meta["system"],
        "score": "3",
        "meaning": "Probably benign",
        "action": "6-month imaging follow-up",
        "reference": rads_meta["reference"],
    }

    triage_level = "ROUTINE"
    for f in findings:
        sev = str(getattr(f, "severity", None) or (f.get("severity") if isinstance(f, dict) else "") or "").lower()
        conf = getattr(f, "confidence", None) or (f.get("confidence") if isinstance(f, dict) else None) or 0
        if sev in ("severe", "critical"):
            triage_level = "URGENT"
            break
        if conf >= 0.85:
            triage_level = "URGENT"
            break

    return {
        "enriched_findings": enriched_findings,
        "rads_meta": rads_meta,
        "rads_score": rads_score,
        "triage_level": triage_level,
    }


def icd10_lookup(query: str) -> List[Dict[str, Any]]:
    """Fuzzy substring search across ICD-10 terms.

    Priority:
      1. Exact match
      2. Prefix match
      3. Substring match
      4. Code/description search
      5. Fallback: unknown condition
    """
    q = query.strip().lower()

    exact = ICD10_DB.get(q)
    if exact:
        return [{"term": q, **c} for c in exact]

    prefix_matches: List[Dict[str, Any]] = []
    substr_matches: List[Dict[str, Any]] = []

    for term in ICD10_TERMS:
        if term.startswith(q):
            for c in ICD10_DB[term]:
                prefix_matches.append({"term": term, **c})
        elif q in term:
            for c in ICD10_DB[term]:
                substr_matches.append({"term": term, **c})

    if not prefix_matches and not substr_matches:
        for term, codes in ICD10_DB.items():
            for c in codes:
                if q in c["code"].lower() or q in c["description"].lower():
                    substr_matches.append({"term": term, **c})

    combined = prefix_matches + substr_matches
    if combined:
        return combined[:10]

    return [{"code": "R69", "description": f"Unknown condition: {query}"}]
