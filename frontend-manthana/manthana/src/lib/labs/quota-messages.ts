import {
  PRO_LABS_LIMITS,
  labsLimitsForPlan,
  type PaidLabsPlan,
} from "@/lib/labs/modality-tier";

/** User-facing copy for Labs quota responses (preflight + record-scan). */
export function labsQuotaMessage(
  code: string,
  limit?: number,
  plan?: PaidLabsPlan
): string {
  const L = plan ? labsLimitsForPlan(plan) : PRO_LABS_LIMITS;
  const brand =
    plan === "enterprise"
      ? "Enterprise"
      : plan === "premium"
      ? "Premium"
      : plan === "proplus"
      ? "Pro Plus"
      : "Pro";
  switch (code) {
    case "daily_cap":
      return `Daily Labs limit reached (${limit ?? L.dailyMax} scans per day on ${brand}).`;
    case "monthly_total":
      return `Monthly Labs limit reached (${limit ?? L.totalMonthly} scans on ${brand}).`;
    case "light_cap":
      return `${brand} light-tier limit reached (${limit ?? L.lightMonthly}/mo: X-ray, ECG, dermatology, lab reports, oral cancer, etc.).`;
    case "ct_mri_cap":
      return `CT/MRI limit reached (${limit ?? L.ctMriMonthly}/mo on ${brand}). Upgrade for enterprise / higher-modality plans via sales if you need more.`;
    case "medium_cap":
      return `${brand} medium-tier limit reached (${limit ?? L.mediumMonthly}/mo: ultrasound, mammography, pathology, cytology).`;
    case "not_pro_active":
      return "Active Pro or Pro Plus subscription is required for Labs scans.";
    case "trial_exhausted":
      return `You have used all ${limit ?? 3} free Manthana Labs trial scans. Upgrade to PRO for full Labs access.`;
    default:
      return "Labs quota exceeded.";
  }
}
