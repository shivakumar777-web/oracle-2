/**
 * ECG intake form — constants, QT-prolonging hints, Indian states, sample data.
 * Outputs align with ECG_AI_India_PromptEngineering_Guide patient_context schema.
 */

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi NCR",
  "Jammu and Kashmir",
  "Ladakh",
  "Puducherry",
  "Other / International",
] as const;

/** Substrings matched case-insensitively against medication names */
export const QT_PROLONGING_DRUG_PATTERNS = [
  "azithromycin",
  "clarithromycin",
  "erythromycin",
  "ciprofloxacin",
  "levofloxacin",
  "moxifloxacin",
  "ofloxacin",
  "fluoroquinolone",
  "hydroxychloroquine",
  "chloroquine",
  "amiodarone",
  "sotalol",
  "dofetilide",
  "ibutilide",
  "haloperidol",
  "pimozide",
  "ziprasidone",
  "quetiapine",
  "lithium",
  "tricyclic",
  "amitriptyline",
  "imipramine",
  "fluconazole",
  "itraconazole",
  "voriconazole",
  "ketoconazole",
  "ondansetron",
  "domperidone",
  "digoxin",
  "methadone",
] as const;

export const COMMON_CARDIAC_MED_SUGGESTIONS = [
  "Metformin",
  "Amlodipine",
  "Atorvastatin",
  "Aspirin",
  "Clopidogrel",
  "Ticagrelor",
  "Ramipril",
  "Losartan",
  "Bisoprolol",
  "Carvedilol",
  "Furosemide",
  "Spironolactone",
  "Azithromycin",
  "Amiodarone",
];

export function medicationHasQtRisk(drugName: string): boolean {
  const d = drugName.toLowerCase().trim();
  if (!d) return false;
  return QT_PROLONGING_DRUG_PATTERNS.some((p) => d.includes(p));
}

export type SectionAccent = "orange" | "red" | "blue" | "green";

export const ECG_SECTIONS: {
  id: string;
  title: string;
  accent: SectionAccent;
  shortHint: string;
}[] = [
  { id: "demographics", title: "1. Demographics", accent: "orange", shortHint: "Age & sex required for best interpretation" },
  { id: "presenting", title: "2. Presenting complaint", accent: "orange", shortHint: "Improves acute vs chronic framing" },
  { id: "vitals", title: "3. Vitals", accent: "red", shortHint: "Correlate rate/BP with tracing" },
  { id: "cardiac", title: "4. Cardiac history", accent: "red", shortHint: "Prior MI, devices, valve disease" },
  { id: "medical", title: "5. Medical history", accent: "blue", shortHint: "HTN, DM, CKD, COPD, TB…" },
  { id: "family", title: "6. Family history", accent: "blue", shortHint: "Premature CAD, SCD, channelopathy" },
  { id: "lifestyle", title: "7. Lifestyle", accent: "blue", shortHint: "Smoking, diet, stress" },
  { id: "medications", title: "8. Current medications", accent: "red", shortHint: "QT / digoxin interaction hints" },
  { id: "recent", title: "9. Recent events", accent: "blue", shortHint: "Fever, travel, COVID…" },
  { id: "labs", title: "10. Lab values", accent: "orange", shortHint: "K+, troponin, HbA1c…" },
  { id: "ecg_ctx", title: "11. ECG context", accent: "green", shortHint: "Indication, serial number" },
];

export function accentBorderColor(accent: SectionAccent): string {
  switch (accent) {
    case "red":
      return "rgba(255,80,80,0.35)";
    case "orange":
      return "rgba(200,146,42,0.4)";
    case "blue":
      return "rgba(100,149,237,0.35)";
    case "green":
      return "rgba(0,196,176,0.35)";
    default:
      return "var(--glass-border)";
  }
}
