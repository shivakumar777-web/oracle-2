// Shared modality mapping helpers.

export const FRONTEND_TO_BACKEND_MODALITY: Record<string, string> = {
  xray: "xray",
  /** @deprecated Prefer ct_abdomen / ct_chest / ct_cardiac / ct_spine / ct_brain — kept for old clients */
  ct: "ct",
  ct_abdomen: "abdominal_ct",
  ct_chest: "chest_ct",
  ct_cardiac: "cardiac_ct",
  ct_spine: "spine_neuro",
  ct_brain: "ct_brain",
  mri: "mri",
  ultrasound: "ultrasound",
  ecg: "ecg",
  pathology: "pathology",
  mammography: "mammography",
  cytology: "cytology",
  oral_cancer: "oral_cancer",
  lab_report: "lab_report",
  dermatology: "dermatology",
  abdominal_ct: "abdominal_ct",
  chest_ct: "chest_ct",
  cardiac_ct: "cardiac_ct",
  spine_neuro: "spine_neuro",
  brain_ct: "ct_brain",
  head_ct: "ct_brain",
  ncct_brain: "ct_brain",
  ct_brain_vista: "ct_brain_vista",
};

export function canonicalizeModality(id: string): string {
  const key = id.trim();
  return FRONTEND_TO_BACKEND_MODALITY[key] ?? key;
}

