/* ═══ STRUCTURED REPORTING STANDARDS — Manthana Radiologist Copilot ═══
   ACR-standard RADS classification tables + auto-scoring engine
   for all 12 modalities.
   ═══════════════════════════════════════════════════════════════════════ */

import type { Finding, Severity } from "./types";

/* ═══ CORE TYPES ═══ */

export interface RADSCategory {
  code: string;
  label: string;
  description: string;
  risk: string;
  recommendation: string;
  severity: Severity;       // maps to existing UI severity colors
}

export interface RADSDefinition {
  standard: string;
  fullName: string;
  version: string;
  applicableModalities: string[];
  categories: RADSCategory[];
}

export interface ScoredReport {
  standard: string;
  version: string;
  category: RADSCategory;
  scoringBasis: string;     // explanation of how category was determined
  sections: ReportSection[];
}

export interface ReportSection {
  title: string;
  content: string;
}

/* ═══ BI-RADS (Mammography) ═══ */
const BIRADS: RADSDefinition = {
  standard: "BI-RADS",
  fullName: "Breast Imaging Reporting and Data System",
  version: "5th Edition (ACR 2013)",
  applicableModalities: ["mammography"],
  categories: [
    { code: "0",  label: "Incomplete",         description: "Need additional imaging evaluation",            risk: "N/A",   recommendation: "Recall for additional imaging (spot compression, ultrasound, MRI)", severity: "warning" },
    { code: "1",  label: "Negative",            description: "No abnormality found",                         risk: "0%",    recommendation: "Routine annual screening mammography",                              severity: "clear" },
    { code: "2",  label: "Benign",              description: "Definitively benign finding",                   risk: "0%",    recommendation: "Routine annual screening mammography",                              severity: "clear" },
    { code: "3",  label: "Probably Benign",     description: "Finding with very low probability of malignancy", risk: "<2%",  recommendation: "Short-interval follow-up at 6 months, then every 6–12 months for 2–3 years", severity: "info" },
    { code: "4A", label: "Low Suspicion",       description: "Low suspicion for malignancy",                  risk: "2–10%", recommendation: "Tissue sampling (biopsy) should be considered",                     severity: "warning" },
    { code: "4B", label: "Moderate Suspicion",   description: "Moderate suspicion for malignancy",             risk: "10–50%",recommendation: "Tissue sampling (biopsy) recommended",                             severity: "warning" },
    { code: "4C", label: "High Suspicion",       description: "High suspicion for malignancy",                 risk: "50–95%",recommendation: "Tissue sampling (biopsy) strongly recommended",                     severity: "critical" },
    { code: "5",  label: "Highly Suggestive",    description: "Highly suggestive of malignancy",               risk: ">95%",  recommendation: "Tissue sampling (biopsy) and surgical consultation required",        severity: "critical" },
    { code: "6",  label: "Known Malignancy",     description: "Biopsy-proven malignancy, pre-treatment",       risk: "100%",  recommendation: "Surgical excision or treatment per oncology recommendation",         severity: "critical" },
  ],
};

/* ═══ LUNG-RADS (CT Chest / Lung Screening) ═══ */
const LUNG_RADS: RADSDefinition = {
  standard: "Lung-RADS",
  fullName: "Lung CT Screening Reporting and Data System",
  version: "Version 1.1 (ACR 2019)",
  applicableModalities: [
    "ct",
    "ct_chest",
    "chest_ct",
    "ct_abdomen",
    "abdominal_ct",
    "ct_cardiac",
    "cardiac_ct",
    "ct_spine",
    "spine_neuro",
    "spine_mri",
    "mri",
    "brain_mri",
  ],
  categories: [
    { code: "1",  label: "Negative",         description: "No pulmonary nodules; benign findings",      risk: "<1%",   recommendation: "Continue annual LDCT screening",                               severity: "clear" },
    { code: "2",  label: "Benign",            description: "Benign appearance or behavior nodules",      risk: "<1%",   recommendation: "Continue annual LDCT screening",                               severity: "clear" },
    { code: "3",  label: "Probably Benign",   description: "Probably-benign finding; short-term follow-up suggested", risk: "1–2%", recommendation: "6-month LDCT follow-up",                           severity: "info" },
    { code: "4A", label: "Suspicious",        description: "Suspicious finding; additional workup",      risk: "5–15%", recommendation: "3-month LDCT follow-up; PET-CT may be considered",             severity: "warning" },
    { code: "4B", label: "Very Suspicious",   description: "Very suspicious finding",                   risk: ">15%",  recommendation: "Chest CT with or without contrast, PET-CT, tissue sampling",   severity: "critical" },
    { code: "4X", label: "Category 3/4 + Growth", description: "Prior category 3/4 with growth or new suspicious feature", risk: ">15%", recommendation: "Tissue sampling recommended", severity: "critical" },
  ],
};

/* ═══ TI-RADS (Thyroid Ultrasound) — ACR Points System ═══ */
const TI_RADS: RADSDefinition = {
  standard: "ACR TI-RADS",
  fullName: "Thyroid Imaging Reporting and Data System",
  version: "ACR 2017",
  applicableModalities: ["ultrasound"],
  categories: [
    { code: "TR1", label: "Benign",               description: "0 points",  risk: "<2%",   recommendation: "No FNA required",                                              severity: "clear" },
    { code: "TR2", label: "Not Suspicious",        description: "2 points",  risk: "<5%",   recommendation: "No FNA required",                                              severity: "clear" },
    { code: "TR3", label: "Mildly Suspicious",     description: "3 points",  risk: "5–10%", recommendation: "FNA if ≥2.5 cm; follow-up if ≥1.5 cm",                         severity: "info" },
    { code: "TR4", label: "Moderately Suspicious", description: "4–6 points",risk: "10–20%",recommendation: "FNA if ≥1.5 cm; follow-up if ≥1.0 cm",                         severity: "warning" },
    { code: "TR5", label: "Highly Suspicious",     description: "≥7 points", risk: ">20%",  recommendation: "FNA if ≥1.0 cm; follow-up if ≥0.5 cm",                         severity: "critical" },
  ],
};

/* ═══ PI-RADS (Prostate MRI) ═══ */
const PI_RADS: RADSDefinition = {
  standard: "PI-RADS",
  fullName: "Prostate Imaging Reporting and Data System",
  version: "Version 2.1 (ACR 2019)",
  applicableModalities: ["prostate_mri"],
  categories: [
    { code: "1", label: "Very Low",      description: "Clinically significant cancer is highly unlikely to be present", risk: "<5%",   recommendation: "Routine follow-up per urology guidelines",        severity: "clear" },
    { code: "2", label: "Low",           description: "Clinically significant cancer is unlikely to be present",        risk: "5–10%", recommendation: "Routine follow-up; repeat MRI if clinical concern", severity: "clear" },
    { code: "3", label: "Intermediate",  description: "Equivocal — clinically significant cancer may be present",       risk: "10–20%",recommendation: "Use clinical parameters (PSA density, history) to determine biopsy", severity: "info" },
    { code: "4", label: "High",          description: "Clinically significant cancer is likely to be present",          risk: "25–40%",recommendation: "MRI-targeted biopsy recommended",                   severity: "warning" },
    { code: "5", label: "Very High",     description: "Clinically significant cancer is highly likely to be present",   risk: ">60%",  recommendation: "MRI-targeted biopsy strongly recommended",         severity: "critical" },
  ],
};

/* ═══ LI-RADS (Liver CT/MRI) ═══ */
const LI_RADS: RADSDefinition = {
  standard: "LI-RADS",
  fullName: "Liver Imaging Reporting and Data System",
  version: "Version 2018 (ACR)",
  applicableModalities: [
    "ct",
    "ct_abdomen",
    "abdominal_ct",
    "ct_chest",
    "chest_ct",
    "ct_cardiac",
    "cardiac_ct",
    "ct_spine",
    "spine_neuro",
    "mri",
  ],
  categories: [
    { code: "LR-1", label: "Definitely Benign",       description: "100% certainty of benignity",         risk: "0%",    recommendation: "Return to routine surveillance",              severity: "clear" },
    { code: "LR-2", label: "Probably Benign",          description: "High likelihood of benignity",        risk: "<5%",   recommendation: "Return to routine surveillance",              severity: "clear" },
    { code: "LR-3", label: "Intermediate Probability", description: "Intermediate probability of HCC",     risk: "~30%",  recommendation: "Repeat diagnostic imaging in 3–6 months",     severity: "info" },
    { code: "LR-4", label: "Probably HCC",             description: "High probability of HCC",             risk: "~75%",  recommendation: "Multidisciplinary discussion; consider biopsy",severity: "warning" },
    { code: "LR-5", label: "Definitely HCC",           description: "100% certainty of HCC",               risk: ">95%",  recommendation: "Treat as HCC without need for biopsy",        severity: "critical" },
    { code: "LR-M", label: "Probably Malignant (non-HCC)", description: "Probably or definitely malignant, not HCC-specific", risk: "High", recommendation: "Biopsy recommended; multidisciplinary discussion", severity: "critical" },
  ],
};

/* ═══ FLEISCHNER (Incidental Pulmonary Nodules — Chest X-Ray) ═══ */
const FLEISCHNER: RADSDefinition = {
  standard: "Fleischner",
  fullName: "Fleischner Society Guidelines for Incidental Pulmonary Nodules",
  version: "2017 Revision",
  applicableModalities: ["xray"],
  categories: [
    { code: "None",     label: "No Nodule",                description: "No pulmonary nodule detected",           risk: "N/A",  recommendation: "No follow-up necessary",                                           severity: "clear" },
    { code: "<6mm-LR",  label: "<6mm Low Risk",            description: "Solid nodule <6mm, low-risk patient",    risk: "<1%",  recommendation: "No routine follow-up",                                             severity: "clear" },
    { code: "<6mm-HR",  label: "<6mm High Risk",           description: "Solid nodule <6mm, high-risk patient",   risk: "<1%",  recommendation: "Optional CT at 12 months",                                         severity: "info" },
    { code: "6-8mm-LR", label: "6–8mm Low Risk",           description: "Solid nodule 6–8mm, low-risk patient",   risk: "~1%",  recommendation: "CT at 6–12 months, then consider CT at 18–24 months",              severity: "info" },
    { code: "6-8mm-HR", label: "6–8mm High Risk",          description: "Solid nodule 6–8mm, high-risk patient",  risk: "1–5%", recommendation: "CT at 6–12 months, then CT at 18–24 months",                      severity: "warning" },
    { code: ">8mm",     label: ">8mm Any Risk",            description: "Solid nodule >8mm",                      risk: ">5%",  recommendation: "Consider CT at 3 months, PET-CT, or tissue sampling",              severity: "warning" },
    { code: "GGO-6mm",  label: "GGO ≤6mm",                description: "Ground-glass nodule ≤6mm",               risk: "<1%",  recommendation: "No routine follow-up",                                             severity: "clear" },
    { code: "GGO>6mm",  label: "GGO >6mm",                description: "Ground-glass nodule >6mm",               risk: "~2%",  recommendation: "CT at 6–12 months to confirm persistence, then every 2 years for 5 years", severity: "info" },
  ],
};

/* ═══ BETHESDA (Thyroid Cytology / Pathology) ═══ */
const BETHESDA_THYROID: RADSDefinition = {
  standard: "Bethesda",
  fullName: "The Bethesda System for Reporting Thyroid Cytopathology",
  version: "3rd Edition (2023)",
  applicableModalities: ["pathology"],
  categories: [
    { code: "I",   label: "Nondiagnostic",                description: "Insufficient or unsatisfactory sample",  risk: "5–10%",  recommendation: "Repeat FNA with ultrasound guidance",                     severity: "info" },
    { code: "II",  label: "Benign",                        description: "Consistent with benign follicular nodule", risk: "0–3%", recommendation: "Clinical and US follow-up",                               severity: "clear" },
    { code: "III", label: "AUS/FLUS",                      description: "Atypia of undetermined significance",    risk: "6–18%",  recommendation: "Repeat FNA, molecular testing, or lobectomy",             severity: "info" },
    { code: "IV",  label: "Follicular Neoplasm",           description: "Follicular neoplasm or suspicious for FN", risk: "10–40%",recommendation: "Molecular testing or surgical lobectomy",                severity: "warning" },
    { code: "V",   label: "Suspicious for Malignancy",     description: "Suspicious for malignancy",              risk: "45–75%", recommendation: "Near-total thyroidectomy or lobectomy",                   severity: "critical" },
    { code: "VI",  label: "Malignant",                     description: "Malignant",                              risk: "97–99%", recommendation: "Total thyroidectomy per oncologic guidelines",            severity: "critical" },
  ],
};

/* ═══ BETHESDA CERVICAL (Cytology — Pap Smear) ═══ */
const BETHESDA_CERVICAL: RADSDefinition = {
  standard: "Bethesda Cervical",
  fullName: "The Bethesda System for Cervical Cytology",
  version: "2014 Revision",
  applicableModalities: ["cytology"],
  categories: [
    { code: "NILM",   label: "Negative",           description: "Negative for intraepithelial lesion or malignancy", risk: "<0.1%", recommendation: "Routine screening per guidelines",                      severity: "clear" },
    { code: "ASC-US", label: "ASC-US",              description: "Atypical squamous cells of undetermined significance", risk: "5–10%", recommendation: "HPV testing; if positive → colposcopy",             severity: "info" },
    { code: "ASC-H",  label: "ASC-H",               description: "Atypical squamous cells, cannot exclude HSIL", risk: "25–40%", recommendation: "Colposcopy with biopsy",                                 severity: "warning" },
    { code: "LSIL",   label: "Low-grade SIL",       description: "Low-grade squamous intraepithelial lesion",    risk: "15–30%", recommendation: "Colposcopy for patients ≥25 years",                      severity: "info" },
    { code: "HSIL",   label: "High-grade SIL",      description: "High-grade squamous intraepithelial lesion",   risk: "70–75%", recommendation: "Immediate colposcopy with biopsy; LEEP may be indicated", severity: "critical" },
    { code: "SCC",    label: "Squamous Cell Carcinoma", description: "Squamous cell carcinoma",                  risk: ">95%",   recommendation: "Urgent oncology referral; staging workup",                 severity: "critical" },
  ],
};

/* ═══ MINNESOTA CODE (ECG Classification) ═══ */
const MINNESOTA_ECG: RADSDefinition = {
  standard: "Minnesota Code",
  fullName: "Minnesota Code Classification System for ECG",
  version: "Standard",
  applicableModalities: ["ecg"],
  categories: [
    { code: "Normal",  label: "Normal ECG",              description: "Normal sinus rhythm, no significant abnormality",    risk: "N/A",   recommendation: "No further cardiac evaluation needed from ECG",                  severity: "clear" },
    { code: "Minor",   label: "Minor Abnormalities",     description: "Minor ST-T changes, borderline intervals",           risk: "Low",   recommendation: "Clinical correlation; consider repeat ECG if symptomatic",        severity: "info" },
    { code: "Moderate",label: "Moderate Abnormalities",   description: "ST depression, T-wave inversion, axis deviation",    risk: "Moderate",recommendation: "Cardiology consultation; consider echocardiography or stress test",severity: "warning" },
    { code: "Major",   label: "Major Abnormalities",      description: "Q waves, LBBB, LVH with strain, AFib, long QT",     risk: "High",  recommendation: "Urgent cardiology evaluation; further workup required",            severity: "critical" },
    { code: "Acute",   label: "Acute/Life-threatening",   description: "ST elevation, VT/VF, complete heart block",          risk: "Critical",recommendation: "IMMEDIATE cardiology/emergency evaluation",                      severity: "critical" },
  ],
};

/* ═══ TNM + OED (Oral Cancer) ═══ */
const ORAL_CANCER_TNM: RADSDefinition = {
  standard: "TNM / OED",
  fullName: "AJCC TNM Staging + Oral Epithelial Dysplasia Grading",
  version: "AJCC 8th Edition / WHO 2022",
  applicableModalities: ["oral_cancer"],
  categories: [
    { code: "Normal",   label: "No Lesion",               description: "No suspicious lesion detected",                    risk: "<1%",   recommendation: "Routine oral screening",                                   severity: "clear" },
    { code: "Mild-OED", label: "Mild Dysplasia",           description: "Mild epithelial dysplasia / suspicious early lesion", risk: "5–10%",recommendation: "Biopsy recommended; close follow-up every 3 months",       severity: "info" },
    { code: "Mod-OED",  label: "Moderate Dysplasia",       description: "Moderate epithelial dysplasia",                    risk: "15–25%",recommendation: "Excisional biopsy; referral to oral surgery",              severity: "warning" },
    { code: "Severe-OED",label: "Severe Dysplasia / CIS", description: "Severe dysplasia or carcinoma in situ",            risk: "30–50%",recommendation: "Surgical excision; oncology referral",                      severity: "critical" },
    { code: "T1-T2",    label: "Early Stage (T1–T2)",     description: "Tumor ≤4cm, no nodes",                             risk: "70–90% 5yr survival", recommendation: "Surgical resection ± radiation; oncology team",   severity: "critical" },
    { code: "T3-T4",    label: "Advanced Stage (T3–T4)",  description: "Tumor >4cm or invasion of adjacent structures",    risk: "30–50% 5yr survival", recommendation: "Multimodal treatment: surgery + chemoradiation",  severity: "critical" },
  ],
};

/* ═══ LAB REFERENCE RANGES ═══ */
const LAB_RANGES: RADSDefinition = {
  standard: "Reference Range",
  fullName: "Clinical Laboratory Reference Range Classification",
  version: "WHO / IFCC Standard",
  applicableModalities: ["lab_report"],
  categories: [
    { code: "Normal",    label: "Within Normal Limits", description: "All values within expected reference range",    risk: "N/A",     recommendation: "No immediate action; routine follow-up",                         severity: "clear" },
    { code: "Borderline",label: "Borderline",           description: "Values near the upper/lower limit of normal",   risk: "Low",     recommendation: "Repeat testing in 1–3 months; lifestyle modifications",           severity: "info" },
    { code: "Abnormal",  label: "Abnormal",             description: "Values outside normal reference range",          risk: "Moderate",recommendation: "Clinical correlation; further investigation recommended",         severity: "warning" },
    { code: "Critical",  label: "Critical / Panic",     description: "Values at critical/panic levels requiring immediate attention", risk: "High", recommendation: "IMMEDIATE clinical intervention; notify treating physician", severity: "critical" },
  ],
};

/* ═══ NCCT Brain (AI triage — not an ACR standard) ═══ */
const CT_BRAIN_TRIAGE: RADSDefinition = {
  standard: "NCCT Brain Triage",
  fullName: "ICH-oriented NCCT head summary (AI-assisted; not a standalone diagnostic standard)",
  version: "Manthana internal v1",
  applicableModalities: ["ct_brain", "brain_ct", "head_ct", "ncct_brain"],
  categories: [
    {
      code: "A",
      label: "No critical model flag",
      description: "No automated intracranial hemorrhage pattern met the configured critical threshold.",
      risk: "N/A",
      recommendation: "Clinical correlation per standard pathways; AI does not exclude pathology.",
      severity: "clear",
    },
    {
      code: "B",
      label: "Attention-level output",
      description: "Degraded input, modality hints, or sub-threshold model output requiring attention.",
      risk: "Variable",
      recommendation: "Correlation with history and imaging quality; repeat acquisition if needed.",
      severity: "info",
    },
    {
      code: "C",
      label: "Elevated suspicion",
      description: "Warning-level structured findings without a critical hemorrhage flag.",
      risk: "Moderate",
      recommendation: "Timely review per local stroke/trauma protocols if clinically indicated.",
      severity: "warning",
    },
    {
      code: "D",
      label: "Critical triage flag",
      description: "Suspected intracranial hemorrhage per model threshold — emergency correlation required.",
      risk: "High",
      recommendation: "Immediate clinical correlation and neuroradiology review per governance workflow.",
      severity: "critical",
    },
  ],
};

/* ═══ MASTER REGISTRY ═══ */
/** No general brain-MRI RADS; PI-RADS is prostate-specific (use modality `prostate_mri` when added). */
export const RADS_REGISTRY: Partial<Record<string, RADSDefinition>> = {
  mammography:  BIRADS,
  ct:           LUNG_RADS,
  ct_chest:     LUNG_RADS,
  chest_ct:     LUNG_RADS,
  ct_abdomen:   LUNG_RADS,
  abdominal_ct: LUNG_RADS,
  ct_cardiac:   LUNG_RADS,
  cardiac_ct:   LUNG_RADS,
  ct_spine:     LUNG_RADS,
  spine_neuro:  LUNG_RADS,
  spine_mri:    LUNG_RADS,
  mri:          LUNG_RADS,
  brain_mri:    LUNG_RADS,
  ct_brain:     CT_BRAIN_TRIAGE,
  brain_ct:     CT_BRAIN_TRIAGE,
  head_ct:      CT_BRAIN_TRIAGE,
  ncct_brain:   CT_BRAIN_TRIAGE,
  ultrasound:   TI_RADS,
  prostate_mri: PI_RADS,
  xray:         FLEISCHNER,
  pathology:    BETHESDA_THYROID,
  cytology:     BETHESDA_CERVICAL,
  ecg:          MINNESOTA_ECG,
  oral_cancer:  ORAL_CANCER_TNM,
  lab_report:   LAB_RANGES,
};

/* ═══ AUTO-SCORING ENGINE ═══ */

/**
 * Scores AI findings into the appropriate RADS category for the given modality.
 *
 * Strategy: Use the highest-severity finding's confidence to pick category.
 * - critical ≥70% confidence → highest RADS category
 * - critical <70% or warning → mid-high category
 * - info / clear only → low/benign category
 */
export function scoreFindings(
  modality: string,
  findings: Finding[]
): ScoredReport | null {
  const def = RADS_REGISTRY[modality];
  if (!def || findings.length === 0) return null;

  // Determine worst severity and its confidence
  const severityOrder: Severity[] = ["critical", "warning", "info", "clear"];
  let worstSeverity: Severity = "clear";
  let worstConfidence = 0;
  let worstLabel = "";

  for (const f of findings) {
    const sIdx = severityOrder.indexOf(f.severity);
    const wIdx = severityOrder.indexOf(worstSeverity);
    if (sIdx < wIdx || (sIdx === wIdx && f.confidence > worstConfidence)) {
      worstSeverity = f.severity;
      worstConfidence = f.confidence;
      worstLabel = f.label;
    }
  }

  // Map severity + confidence → category index
  const cats = def.categories;
  let catIndex = 0;

  if (worstSeverity === "critical" && worstConfidence >= 80) {
    catIndex = cats.length - 1;                    // highest
  } else if (worstSeverity === "critical" && worstConfidence >= 60) {
    catIndex = Math.max(0, cats.length - 2);       // second-highest
  } else if (worstSeverity === "warning" && worstConfidence >= 70) {
    catIndex = Math.floor(cats.length * 0.6);      // mid-high
  } else if (worstSeverity === "warning") {
    catIndex = Math.floor(cats.length * 0.45);     // mid
  } else if (worstSeverity === "info") {
    catIndex = Math.min(2, cats.length - 1);       // low
  } else {
    catIndex = Math.min(1, cats.length - 1);       // benign/negative
  }

  const category = cats[catIndex];

  // Build scoring explanation
  const criticalFindings = findings.filter(f => f.severity === "critical");
  const warningFindings = findings.filter(f => f.severity === "warning");
  let basis = `Based on ${findings.length} finding(s): `;
  if (criticalFindings.length > 0) {
    basis += `${criticalFindings.length} critical (primary: "${worstLabel}" at ${worstConfidence}% confidence)`;
  } else if (warningFindings.length > 0) {
    basis += `${warningFindings.length} attention-level finding(s) (primary: "${worstLabel}" at ${worstConfidence}% confidence)`;
  } else {
    basis += `No significant abnormality detected. All findings are informational or normal.`;
  }

  // Build standard report sections
  const sections = buildReportSections(modality, findings, category, def);

  return {
    standard: def.standard,
    version: def.version,
    category,
    scoringBasis: basis,
    sections,
  };
}

/**
 * Builds standard ACR report sections for a given modality.
 */
function buildReportSections(
  modality: string,
  findings: Finding[],
  category: RADSCategory,
  def: RADSDefinition
): ReportSection[] {
  const sections: ReportSection[] = [
    {
      title: "Clinical Indication",
      content: `AI-assisted ${getModalityLabel(modality)} analysis requested for diagnostic evaluation.`,
    },
    {
      title: "Technique",
      content: getModalityTechnique(modality),
    },
    {
      title: "Findings",
      content: findings
        .map(
          (f, i) =>
            `${i + 1}. ${f.label} — ${f.severity.toUpperCase()} (${f.confidence}% confidence)${f.region ? ` [${f.region}]` : ""}${f.description ? `: ${f.description}` : ""}`
        )
        .join("\n"),
    },
    {
      title: `Assessment — ${def.standard} ${category.code}`,
      content: `${category.label}: ${category.description}\nMalignancy/Abnormality Risk: ${category.risk}`,
    },
    {
      title: "Recommendation",
      content: category.recommendation,
    },
  ];

  return sections;
}

function getModalityLabel(modality: string): string {
  const map: Record<string, string> = {
    xray: "Radiograph",
    ct: "CT",
    ct_brain: "Non-contrast head CT (NCCT)",
    brain_ct: "Non-contrast head CT (NCCT)",
    head_ct: "Non-contrast head CT (NCCT)",
    ncct_brain: "Non-contrast head CT (NCCT)",
    mri: "MRI (brain alias)",
    brain_mri: "Brain MRI",
    spine_mri: "Spine / Neuro MRI",
    ultrasound: "Ultrasound",
    ecg: "ECG/EKG",
    pathology: "Histopathology",
    cytology: "Cytology",
    mammography: "Mammography",
    oral_cancer: "Oral Cancer Screening",
    lab_report: "Laboratory Report",
    prostate_mri: "Prostate MRI",
  };
  return map[modality] || modality;
}

function getModalityTechnique(modality: string): string {
  const map: Record<string, string> = {
    xray: "Posteroanterior (PA) and/or lateral digital radiograph. AI analysis using multi-model ensemble (MedRAX, CheXagent, TotalSegmentator).",
    ct: "Axial CT images acquired with standard protocol. AI segmentation and nodule detection via TotalSegmentator, nnUNet, and MedSAM2.",
    ct_brain:
      "Axial NCCT head series (DICOM preferred). AI hemorrhage-focused scoring from deploy-time TorchScript when configured; governance and human review per ct_product_contract.",
    brain_ct:
      "Axial NCCT head series (DICOM preferred). AI hemorrhage-focused scoring from deploy-time TorchScript when configured; governance and human review per ct_product_contract.",
    head_ct:
      "Axial NCCT head series (DICOM preferred). AI hemorrhage-focused scoring from deploy-time TorchScript when configured; governance and human review per ct_product_contract.",
    ncct_brain:
      "Axial NCCT head series (DICOM preferred). AI hemorrhage-focused scoring from deploy-time TorchScript when configured; governance and human review per ct_product_contract.",
    mri: "Brain MRI: TotalSegmentator total_mr volumetrics and SynthSeg brain parcellation when volumetric NIfTI is available. Optional Prima. Narrative policy: MRI_NARRATIVE_POLICY / MRI_NARRATIVE_VISION (see mri_product_contract).",
    brain_mri:
      "Brain MRI: TotalSegmentator total_mr volumetrics and SynthSeg brain parcellation when volumetric NIfTI is available. Optional Prima. LLM narrative is not a measurement.",
    spine_mri:
      "Spine MRI: spine_neuro service with TotalSegmentator vertebrae_mr when MR is detected; same structured spine metrics pathway as CT spine.",
    prostate_mri:
      "Multiparametric prostate MRI. PI-RADS–oriented structured reporting when clinically indicated; AI-assisted categorization aligned to PI-RADS.",
    ultrasound: "B-mode ultrasound images analyzed with AI. Feature extraction using OpenUS and MedSAM2 models.",
    ecg: "Standard 12-lead ECG — digital or photographed. AI interpretation using ecg-fm and HeartLang models.",
    pathology: "Whole slide image (WSI) analyzed at 40x magnification. AI tissue classification using Virchow foundation model.",
    cytology: "Cell-level microscopy analysis. AI classification using Virchow Cell model.",
    mammography:
      "Digital mammography: Mirai risk model when a complete four-view exam is available (L-CC, L-MLO, R-CC, R-MLO). Single-image uploads receive qualitative AI assessment only — Mirai risk scores require all four views.",
    oral_cancer: "Clinical photograph of oral cavity. AI lesion detection using EfficientNet-B3 model.",
    lab_report: "Laboratory report data extracted and analyzed by the configured clinical LLM against clinical reference ranges.",
  };
  return map[modality] || "AI-assisted analysis performed.";
}

/**
 * Gets the RADS definition for a modality (for display purposes).
 */
export function getRADSDefinition(modality: string): RADSDefinition | null {
  return RADS_REGISTRY[modality] || null;
}
