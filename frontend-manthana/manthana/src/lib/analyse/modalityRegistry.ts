/**
 * 95-modality registry for AI orchestration UI (mirrors gateway/modality_registry.py).
 */
import type { Modality, ModalityGroupDef } from "./types";

const ORCH_MODELS = ["Manthana AI Orchestration", "OpenRouter"];

type Row = { id: string; group: string; label: string; icon: string };

const ROWS: Row[] = [
  { id: "xray", group: "xray", label: "Chest X-Ray", icon: "XRAY" },
  { id: "xray_bone", group: "xray", label: "Bone / Skeletal", icon: "XRAY" },
  { id: "xray_abdomen", group: "xray", label: "Abdominal X-Ray", icon: "XRAY" },
  { id: "xray_spine", group: "xray", label: "Spine X-Ray", icon: "XRAY" },
  { id: "xray_pelvis", group: "xray", label: "Pelvis X-Ray", icon: "XRAY" },
  { id: "xray_skull", group: "xray", label: "Skull X-Ray", icon: "XRAY" },
  { id: "xray_dental", group: "xray", label: "Dental / OPG", icon: "XRAY" },
  { id: "xray_hand_wrist", group: "xray", label: "Hand / Wrist", icon: "XRAY" },
  { id: "xray_knee", group: "xray", label: "Knee X-Ray", icon: "XRAY" },
  { id: "xray_shoulder", group: "xray", label: "Shoulder X-Ray", icon: "XRAY" },
  { id: "xray_ankle_foot", group: "xray", label: "Ankle / Foot", icon: "XRAY" },
  { id: "ct_abdomen", group: "ct", label: "CT Abdomen / Pelvis", icon: "CT" },
  { id: "ct_chest", group: "ct", label: "CT Chest", icon: "CT" },
  { id: "ct_cardiac", group: "ct", label: "CT Cardiac", icon: "CT" },
  { id: "ct_spine", group: "ct", label: "CT Spine / Neuro", icon: "CT" },
  { id: "ct_brain", group: "ct", label: "CT Brain (NCCT)", icon: "CT" },
  { id: "ct_angiography", group: "ct", label: "CT Angiography (CTA)", icon: "CT" },
  { id: "ct_pulmonary_pe", group: "ct", label: "CTPA — PE", icon: "CT" },
  { id: "ct_liver", group: "ct", label: "CT Liver / Hepatic", icon: "CT" },
  { id: "ct_kidney", group: "ct", label: "CT KUB", icon: "CT" },
  { id: "ct_neck", group: "ct", label: "CT Neck", icon: "CT" },
  { id: "ct_sinuses", group: "ct", label: "CT Sinuses", icon: "CT" },
  { id: "ct_whole_body", group: "ct", label: "CT Whole Body", icon: "CT" },
  { id: "ct_pet_fusion", group: "ct", label: "CT PET Fusion", icon: "CT" },
  { id: "ct_dual_energy", group: "ct", label: "CT Dual Energy", icon: "CT" },
  { id: "ct_perfusion", group: "ct", label: "CT Perfusion Brain", icon: "CT" },
  { id: "brain_mri", group: "mri", label: "Brain MRI", icon: "MRI" },
  { id: "spine_mri", group: "mri", label: "Spine / Neuro MRI", icon: "MRI" },
  { id: "cardiac_mri", group: "mri", label: "Cardiac MRI", icon: "MRI" },
  { id: "breast_mri", group: "mri", label: "Breast MRI", icon: "MRI" },
  { id: "liver_mri", group: "mri", label: "MRI Liver / MRCP", icon: "MRI" },
  { id: "prostate_mri", group: "mri", label: "Prostate MRI", icon: "MRI" },
  { id: "knee_mri", group: "mri", label: "Knee MRI", icon: "MRI" },
  { id: "shoulder_mri", group: "mri", label: "Shoulder MRI", icon: "MRI" },
  { id: "abdomen_mri", group: "mri", label: "MRI Abdomen", icon: "MRI" },
  { id: "fetal_mri", group: "mri", label: "Fetal MRI", icon: "MRI" },
  { id: "mri_perfusion", group: "mri", label: "MRI Perfusion / DWI", icon: "MRI" },
  { id: "mri_spectroscopy", group: "mri", label: "MRI Spectroscopy", icon: "MRI" },
  { id: "wbmri", group: "mri", label: "Whole Body MRI", icon: "MRI" },
  { id: "mri_pet_fusion", group: "mri", label: "MRI PET Fusion", icon: "MRI" },
  { id: "pet_ct", group: "nuclear", label: "PET/CT", icon: "NUC" },
  { id: "pet_mri", group: "nuclear", label: "PET/MRI", icon: "NUC" },
  { id: "spect", group: "nuclear", label: "SPECT", icon: "NUC" },
  { id: "bone_scan", group: "nuclear", label: "Bone Scan", icon: "NUC" },
  { id: "thyroid_scan", group: "nuclear", label: "Thyroid Scan", icon: "NUC" },
  { id: "renal_scan", group: "nuclear", label: "Renal Scan", icon: "NUC" },
  { id: "myocardial_perf", group: "nuclear", label: "Myocardial Perfusion", icon: "NUC" },
  { id: "ultrasound", group: "ultrasound", label: "General Ultrasound", icon: "USG" },
  { id: "echo_cardiac", group: "ultrasound", label: "Echocardiography", icon: "USG" },
  { id: "us_abdomen", group: "ultrasound", label: "USG Abdomen", icon: "USG" },
  { id: "us_pelvis", group: "ultrasound", label: "USG Pelvis", icon: "USG" },
  { id: "us_obstetric", group: "ultrasound", label: "Obstetric USG", icon: "USG" },
  { id: "us_thyroid", group: "ultrasound", label: "Thyroid US", icon: "USG" },
  { id: "us_breast", group: "ultrasound", label: "Breast US", icon: "USG" },
  { id: "us_scrotum", group: "ultrasound", label: "Scrotal US", icon: "USG" },
  { id: "us_doppler", group: "ultrasound", label: "Doppler US", icon: "USG" },
  { id: "us_musculo", group: "ultrasound", label: "MSK US", icon: "USG" },
  { id: "us_guided_biopsy", group: "ultrasound", label: "US Biopsy / FNAC", icon: "USG" },
  { id: "us_carotid", group: "ultrasound", label: "Carotid Doppler", icon: "USG" },
  { id: "ecg", group: "cardiac_functional", label: "ECG / 12-lead", icon: "ECG" },
  { id: "holter_monitor", group: "cardiac_functional", label: "Holter", icon: "ECG" },
  { id: "spirometry", group: "cardiac_functional", label: "Spirometry / PFT", icon: "ECG" },
  { id: "nerve_conduction", group: "cardiac_functional", label: "NCS / EMG", icon: "ECG" },
  { id: "fluoroscopy", group: "specialized", label: "Fluoroscopy", icon: "SPEC" },
  { id: "angiography", group: "specialized", label: "DSA", icon: "SPEC" },
  { id: "dexa_scan", group: "specialized", label: "DEXA", icon: "SPEC" },
  { id: "endoscopy", group: "specialized", label: "Endoscopy", icon: "SPEC" },
  { id: "bronchoscopy", group: "specialized", label: "Bronchoscopy", icon: "SPEC" },
  { id: "oct_retinal", group: "specialized", label: "OCT Retinal", icon: "SPEC" },
  { id: "fundus_photo", group: "specialized", label: "Fundus Photo", icon: "SPEC" },
  { id: "colposcopy", group: "specialized", label: "Colposcopy", icon: "SPEC" },
  { id: "thermography", group: "specialized", label: "Thermography", icon: "SPEC" },
  { id: "capsule_endoscopy", group: "specialized", label: "Capsule Endoscopy", icon: "SPEC" },
  { id: "pathology", group: "pathology", label: "Pathology Slides", icon: "PATH" },
  { id: "cytology", group: "pathology", label: "Cytology", icon: "PATH" },
  { id: "immunohistochem", group: "pathology", label: "IHC Slides", icon: "PATH" },
  { id: "surgical_specimen", group: "pathology", label: "Surgical Specimen", icon: "PATH" },
  { id: "genetics_karyotype", group: "pathology", label: "Karyotype", icon: "PATH" },
  { id: "mammography", group: "oncology", label: "Mammography", icon: "ONC" },
  { id: "oral_cancer", group: "oncology", label: "Oral Cancer Imaging", icon: "ONC" },
  { id: "dermatology", group: "oncology", label: "Dermatology", icon: "ONC" },
  { id: "wound_care", group: "oncology", label: "Wound / Ulcer", icon: "ONC" },
  { id: "ophthalmology", group: "ophthalmology_dental", label: "Ophthalmology", icon: "EYE" },
  { id: "dental_cbct", group: "ophthalmology_dental", label: "Dental CBCT", icon: "EYE" },
  { id: "ortho_implant", group: "ophthalmology_dental", label: "Implant X-Ray", icon: "EYE" },
  { id: "lab_report", group: "reports", label: "Lab Reports", icon: "LAB" },
  { id: "blood_report", group: "reports", label: "CBC / Blood", icon: "LAB" },
  { id: "urine_report", group: "reports", label: "Urine Analysis", icon: "LAB" },
  { id: "culture_report", group: "reports", label: "Culture", icon: "LAB" },
  { id: "biopsy_report", group: "reports", label: "Biopsy Report", icon: "LAB" },
  { id: "genetic_report", group: "reports", label: "Genetic Report", icon: "LAB" },
  { id: "radiology_report", group: "reports", label: "Radiology Text", icon: "LAB" },
  { id: "discharge_summary", group: "reports", label: "Discharge Summary", icon: "LAB" },
  { id: "prescription_ocr", group: "reports", label: "Prescription OCR", icon: "LAB" },
  { id: "surgical_notes", group: "reports", label: "Surgical Notes", icon: "LAB" },
];

const GROUP_LABELS: Record<string, { label: string; icon: string }> = {
  xray: { label: "X-Ray", icon: "XRAY" },
  ct: { label: "CT Scans", icon: "CT" },
  mri: { label: "MRI", icon: "MRI" },
  nuclear: { label: "Nuclear / PET", icon: "NUC" },
  ultrasound: { label: "Ultrasound", icon: "USG" },
  cardiac_functional: { label: "Cardiac / Functional", icon: "ECG" },
  specialized: { label: "Specialized", icon: "SPEC" },
  pathology: { label: "Pathology", icon: "PATH" },
  oncology: { label: "Oncology", icon: "ONC" },
  ophthalmology_dental: { label: "Eye / Dental", icon: "EYE" },
  reports: { label: "Reports & Docs", icon: "LAB" },
};

function rowToModality(r: Row): Modality {
  return {
    id: r.id,
    label: r.label,
    icon: r.icon,
    port: 8000,
    description: `${r.label} — AI orchestration pipeline with clinical Q&A and structured report.`,
    models: ORCH_MODELS,
    group: r.group,
    orchestrationOnly: true,
  };
}

export const ORCHESTRATION_MODALITIES: Modality[] = ROWS.map(rowToModality);

export function buildModalityGroups(): ModalityGroupDef[] {
  const byGroup = new Map<string, Modality[]>();
  for (const m of ORCHESTRATION_MODALITIES) {
    const g = m.group || "other";
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }
  const out: ModalityGroupDef[] = [];
  for (const [gid, modalities] of Array.from(byGroup.entries())) {
    const meta = GROUP_LABELS[gid] || { label: gid, icon: "SPEC" };
    out.push({
      id: gid,
      label: meta.label,
      icon: meta.icon,
      modalities,
    });
  }
  out.sort((a, b) => a.label.localeCompare(b.label));
  return out;
}

export const MODALITY_GROUP_DEFS = buildModalityGroups();

/** Legacy GPU / Modal modalities — not orchestration-only */
export const PREMIUM_GPU_MODALITIES: Modality[] = [
  {
    id: "ct_brain_vista",
    label: "CT Brain VISTA-3D",
    icon: "CT",
    port: 8017,
    description:
      "NVIDIA VISTA-3D — volumetric DICOM/NIfTI. Pro subscription.",
    models: ["NVIDIA VISTA-3D", "MONAI", "Manthana Cloud AI"],
    premium: true,
    tier: "pro",
    multiStep: true,
    strict3D: true,
  },
  {
    id: "premium_ct_unified",
    label: "Premium 3D CT",
    icon: "CT",
    port: 8018,
    description: "Unified VISTA-3D premium pipeline. Premium subscription.",
    models: ["NVIDIA VISTA-3D (127 classes)", "MONAI", "Manthana Cloud AI"],
    premium: true,
    tier: "premium",
    multiStep: true,
    strict3D: true,
  },
];
