/**
 * Labs scan tiers: modality → light | ct_mri | medium.
 * Pro and Pro Plus share the same monthly caps (see labsLimitsForPlan); higher-volume tiers are sales-led.
 */

export type LabsScanTier = "light" | "ct_mri" | "medium";

const LIGHT = new Set([
  "xray",
  "ecg",
  "dermatology",
  "lab_report",
  "oral_cancer",
]);

/** Premium gateway modalities — same monthly bucket as CT/MRI for Labs caps. */
const PREMIUM_CT = new Set(["ct_brain_vista", "premium_ct_unified"]);

/** USG, mammography, pathology, cytology — shared 15/mo cap on Pro (10% bucket). */
const MEDIUM = new Set([
  "ultrasound",
  "mammography",
  "pathology",
  "cytology",
]);

/** CT + MRI (2D DICOM slices; Pro disables video upload for these in UI). */
function isCtOrMriModality(m: string): boolean {
  if (m === "ct") return true;
  if (m.startsWith("ct_")) return true;
  if (m === "brain_mri" || m === "spine_mri") return true;
  if (m === "mri") return true;
  if (m.includes("chest_ct") || m.includes("abdomen_ct") || m.includes("head_ct")) return true;
  if (m.includes("ct_") || m.includes("_ct")) return true;
  return false;
}

/**
 * Resolve tier from modality string sent to the gateway (e.g. `ct_brain`, `xray`, `chest_ct`).
 */
export function labsScanTierForModality(modalityId: string): LabsScanTier {
  const m = (modalityId || "").toLowerCase().trim();
  if (!m) return "light";
  if (PREMIUM_CT.has(m)) return "ct_mri";
  if (MEDIUM.has(m)) return "medium";
  if (isCtOrMriModality(m)) return "ct_mri";
  if (LIGHT.has(m)) return "light";
  return "light";
}

export const PRO_LABS_LIMITS = {
  totalMonthly: 150,
  dailyMax: 15,
  lightMonthly: 120,
  ctMriMonthly: 15,
  mediumMonthly: 15,
} as const;

/** Legacy higher caps — reserved for a future `premium_modalities` (sales) tier; Pro Plus (₹999) uses Pro caps. */
export const PREMIUM_LABS_LIMITS = {
  totalMonthly: 450,
  dailyMax: 40,
  lightMonthly: 360,
  ctMriMonthly: 45,
  mediumMonthly: 45,
} as const;

export const PREMIUM_CT_LIMITS = {
  totalMonthly: 50,
  dailyMax: 5,
  lightMonthly: 0,
  ctMriMonthly: 50,
  mediumMonthly: 0,
} as const;

export type PaidLabsPlan = "pro" | "proplus" | "premium" | "enterprise";

export function labsLimitsForPlan(plan: PaidLabsPlan) {
  if (plan === "premium" || plan === "enterprise") return PREMIUM_CT_LIMITS;
  return PRO_LABS_LIMITS;
}
