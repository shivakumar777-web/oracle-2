"""
Evidence-based herb-drug interaction data.

Curated from systematic reviews (PMC3575928, PMC3339338, Natural Standard)
and literature. Schema: herb_keys, drug_name, severity, evidence_level,
mechanism, citation_pmid, recommendation.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# Evidence table: (herb_search_terms, drug_normalized, severity, evidence_level, mechanism, pmid, recommendation)
# herb_search_terms: list of strings to match herb name (lowercase)
# severity: mild | moderate | severe | contraindicated
HERB_DRUG_EVIDENCE: List[Tuple[List[str], str, str, str, str, Optional[str], str]] = [
    # St. John's wort (Hypericum perforatum)
    (["st john's wort", "st johns wort", "hypericum", "sjw"], "warfarin", "moderate", "systematic_review",
     "CYP3A4/CYP2C9 induction; may reduce anticoagulant effect.", "16907661",
     "Monitor INR closely. Dose adjustment may be needed. Consult prescriber."),
    (["st john's wort", "st johns wort", "hypericum"], "ssri", "moderate", "case_report",
     "Serotonin syndrome risk when combined with SSRIs.", "16907661",
     "Avoid combination or use with caution. Monitor for serotonin syndrome."),
    (["st john's wort", "st johns wort", "hypericum"], "oral contraceptive", "moderate", "clinical_trial",
     "CYP3A4 induction may reduce contraceptive efficacy.", "16907661",
     "Consider alternative contraception. Consult prescriber."),
    (["st john's wort", "st johns wort", "hypericum"], "immunosuppressant", "severe", "case_report",
     "CYP3A4 induction reduces cyclosporine/tacrolimus levels; transplant rejection risk.", "16907661",
     "Contraindicated. Do not combine. Consult transplant team."),
    # Ginkgo biloba
    (["ginkgo", "ginkgo biloba"], "warfarin", "moderate", "systematic_review",
     "Platelet inhibition; additive anticoagulant effect.", "3575928",
     "Monitor bleeding risk. Consider avoiding before surgery."),
    (["ginkgo", "ginkgo biloba"], "aspirin", "mild", "case_report",
     "Additive antiplatelet effect; bleeding risk.", "3575928",
     "Monitor for bleeding. Discontinue before surgery."),
    (["ginkgo", "ginkgo biloba"], "anticoagulant", "moderate", "systematic_review",
     "Additive anticoagulant/antiplatelet effect.", "3575928",
     "Monitor INR and bleeding signs. Consult prescriber."),
    # Ashwagandha (Withania somnifera)
    (["ashwagandha", "withania somnifera"], "sedative", "moderate", "preclinical",
     "CNS depressant; additive sedation with benzodiazepines, barbiturates.", "3339338",
     "Use with caution. Avoid driving/operating machinery. Reduce dose if sedated."),
    (["ashwagandha", "withania somnifera"], "thyroid", "moderate", "clinical_study",
     "May increase T3/T4; interacts with thyroid hormone replacement.", "3339338",
     "Monitor thyroid function. Dose adjustment may be needed."),
    (["ashwagandha", "withania somnifera"], "immunosuppressant", "mild", "preclinical",
     "Immunomodulatory effects; theoretical interaction.", "3339338",
     "Monitor. Consult prescriber if on transplant meds."),
    (["ashwagandha", "withania somnifera"], "warfarin", "mild", "case_report",
     "Limited data; theoretical CYP interaction.", "18367983",
     "Monitor INR. Consult prescriber."),
    # Turmeric / Curcumin
    (["turmeric", "curcumin", "curcuma longa"], "warfarin", "moderate", "case_report",
     "Antiplatelet effect; additive anticoagulation.", "3575928",
     "Monitor INR. Discontinue before surgery."),
    (["turmeric", "curcumin"], "nsaid", "mild", "preclinical",
     "Additive GI irritation; antiplatelet effect.", "3575928",
     "Use with caution. Monitor for bleeding."),
    (["turmeric", "curcumin"], "chemotherapy", "moderate", "preclinical",
     "May affect drug metabolism; limited clinical data.", "3575928",
     "Consult oncologist before use during chemotherapy."),
    # Garlic
    (["garlic", "allium sativum"], "warfarin", "moderate", "clinical_trial",
     "Antiplatelet effect; additive anticoagulation.", "3575928",
     "Monitor INR. Discontinue 7–10 days before surgery."),
    (["garlic", "allium sativum"], "anticoagulant", "moderate", "systematic_review",
     "Additive anticoagulant effect.", "3575928",
     "Monitor bleeding risk. Consult prescriber."),
    # Ginseng
    (["ginseng", "panax ginseng"], "warfarin", "moderate", "clinical_trial",
     "May reduce INR; variable effect.", "3575928",
     "Monitor INR closely. Dose adjustment may be needed."),
    (["ginseng", "panax ginseng"], "hypoglycemic", "mild", "case_report",
     "Additive hypoglycemia with diabetes medications.", "3575928",
     "Monitor blood glucose. Adjust diabetes meds if needed."),
    # Valerian
    (["valerian", "valeriana officinalis"], "sedative", "moderate", "preclinical",
     "Additive CNS depression with benzodiazepines, alcohol.", "3575928",
     "Avoid driving. Reduce doses. Do not combine with alcohol."),
    (["valerian", "valeriana officinalis"], "benzodiazepine", "moderate", "case_report",
     "Additive sedation.", "3575928",
     "Use with caution. Avoid driving."),
    # Kava
    (["kava", "kava kava", "piper methysticum"], "benzodiazepine", "moderate", "case_report",
     "Additive CNS depression; hepatotoxicity risk.", "3575928",
     "Avoid combination. Hepatotoxicity reported."),
    (["kava", "kava kava"], "alcohol", "severe", "case_report",
     "Additive hepatotoxicity and CNS depression.", "3575928",
     "Contraindicated. Do not combine with alcohol."),
    # Ginger
    (["ginger", "zingiber officinale"], "warfarin", "mild", "case_report",
     "Antiplatelet effect; theoretical bleeding risk.", "3575928",
     "Monitor INR. Discontinue before surgery."),
    (["ginger", "zingiber officinale"], "anticoagulant", "mild", "preclinical",
     "Additive anticoagulant effect.", "3575928",
     "Monitor bleeding risk."),
    # Green tea
    (["green tea", "camellia sinensis", "egcg"], "warfarin", "mild", "case_report",
     "Vitamin K content may reduce warfarin effect.", "3575928",
     "Consistent intake. Monitor INR."),
    # Tulsi (Holy basil)
    (["tulsi", "holy basil", "ocimum sanctum", "ocimum tenuiflorum"], "anticoagulant", "mild", "preclinical",
     "Antiplatelet effect; theoretical interaction.", "3575928",
     "Monitor bleeding risk. Consult prescriber."),
    (["tulsi", "holy basil", "ocimum sanctum"], "hypoglycemic", "mild", "preclinical",
     "May enhance hypoglycemic effect.", "3575928",
     "Monitor blood glucose."),
    # Amla / Amalaki
    (["amla", "amalaki", "emblica officinalis", "indian gooseberry"], "hypoglycemic", "mild", "preclinical",
     "May enhance hypoglycemic effect of diabetes medications.", "3575928",
     "Monitor blood glucose."),
    (["amla", "amalaki", "emblica officinalis"], "anticoagulant", "mild", "preclinical",
     "Vitamin C and antioxidants; theoretical interaction.", "3575928",
     "Monitor. Limited clinical data."),
    # Echinacea
    (["echinacea"], "immunosuppressant", "moderate", "preclinical",
     "Immunostimulant; may reduce immunosuppressant efficacy.", "3575928",
     "Avoid in transplant patients. Consult prescriber."),
    # Feverfew
    (["feverfew", "tanacetum parthenium"], "anticoagulant", "moderate", "case_report",
     "Antiplatelet effect; additive anticoagulation.", "3575928",
     "Monitor bleeding risk. Discontinue before surgery."),
    # Saw palmetto
    (["saw palmetto", "serenoa repens"], "anticoagulant", "mild", "case_report",
     "Theoretical antiplatelet effect.", "3575928",
     "Monitor. Limited data."),
    # Milk thistle
    (["milk thistle", "silymarin", "silybum marianum"], "cyp3a4 substrate", "mild", "clinical_trial",
     "May inhibit CYP3A4; variable effect on drug levels.", "3575928",
     "Monitor drug levels if narrow therapeutic index."),
    # Cat's claw
    (["cat's claw", "cats claw", "uncaria tomentosa"], "immunosuppressant", "moderate", "preclinical",
     "Immunostimulant; may reduce immunosuppressant efficacy.", "3575928",
     "Avoid in transplant patients."),
    (["cat's claw", "cats claw"], "anticoagulant", "mild", "preclinical",
     "Antiplatelet effect.", "3575928",
     "Monitor bleeding risk."),
]


def lookup_herb_drug_evidence(herb: str, drug: str) -> Optional[Dict[str, Any]]:
    """
    Look up evidence-based herb-drug interaction.

    Args:
        herb: Herb name (any language/common name)
        drug: Drug name (generic or class)

    Returns:
        Dict with severity, evidence_level, mechanism, citation_pmid, recommendation, citation_url
        or None if no match
    """
    herb_lower = herb.lower().strip()
    drug_lower = drug.lower().strip()

    for herb_terms, drug_norm, severity, evidence_level, mechanism, pmid, recommendation in HERB_DRUG_EVIDENCE:
        herb_match = any(term in herb_lower for term in herb_terms)
        drug_match = drug_norm in drug_lower or drug_lower in drug_norm
        if herb_match and drug_match:
            citation_url = f"https://pubmed.ncbi.nlm.nih.gov/{pmid}" if pmid else None
            return {
                "severity": severity,
                "evidence_level": evidence_level,
                "mechanism": mechanism,
                "citation_pmid": pmid,
                "citation_url": citation_url,
                "recommendation": recommendation,
            }
    return None
