/* ═══ CONSTANTS — Manthana Radiologist Copilot ═══ */
import type { Modality } from "./types";
import {
  ORCHESTRATION_MODALITIES,
  PREMIUM_GPU_MODALITIES,
} from "./modalityRegistry";

export const BRAND = "Manthana Radiologist Copilot";

export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

/** Same-origin proxy base (`app/api/[...path]/route.ts`) — optional; main client still uses `GATEWAY_URL` + JWT. */
export const API_BASE = "/api";

/** Feature flag: 95-modality AI orchestration (/ai/*) */
export const AI_ORCHESTRATION_ENABLED =
  process.env.NEXT_PUBLIC_AI_ORCHESTRATION_ENABLED !== "false";

/** Show `dynamic_sections` from interpreter JSON when present (disable until gateway ships). */
export const AI_DYNAMIC_SECTIONS_ENABLED =
  process.env.NEXT_PUBLIC_AI_DYNAMIC_SECTIONS_ENABLED !== "false";

const AUTO_MODALITY: Modality = {
  id: "auto",
  label: "Auto-Detect",
  icon: "AUTO",
  port: 8000,
  description:
    "AI classifies the study into one of 95 modalities, then runs the orchestration pipeline.",
  models: ["Manthana AI Orchestration"],
};

/** Full picker: auto + 95 orchestration modalities + Premium 3D CT (legacy GPU path). */
export const MODALITIES: Modality[] = [
  AUTO_MODALITY,
  ...ORCHESTRATION_MODALITIES,
  ...PREMIUM_GPU_MODALITIES,
];

export type UploadAcceptOptions = { pro2dOnly?: boolean };

const REPORT_DOC_IDS = new Set([
  "lab_report",
  "blood_report",
  "urine_report",
  "culture_report",
  "biopsy_report",
  "genetic_report",
  "radiology_report",
  "discharge_summary",
  "prescription_ocr",
  "surgical_notes",
]);

function stripVideoFromAccept(accept: string): string {
  return accept
    .split(",")
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 0 &&
        !/^video\//i.test(s) &&
        !/\.mp4$/i.test(s) &&
        s.toLowerCase() !== ".mp4"
    )
    .join(",");
}

/** Browser file input `accept` by modality. */
export function getUploadAcceptTypes(
  modality: string,
  opts?: UploadAcceptOptions
): string {
  let accept: string;
  if (modality === "auto") {
    accept =
      "image/*,application/pdf,.pdf,.txt,.csv,application/dicom,.dcm,.dic,.nii,.nii.gz,video/mp4,.mp4";
  } else if (REPORT_DOC_IDS.has(modality)) {
    accept =
      "application/pdf,.pdf,.txt,.csv,.tsv,text/*,image/*,application/json,.json";
  } else if (modality === "premium_ct_unified" || modality === "ct_brain_vista") {
    accept =
      "application/zip,.zip,application/dicom,.dcm,.dic,.nii,.nii.gz";
  } else if (modality === "oral_cancer" || modality === "dermatology") {
    accept = "image/jpeg,image/png,image/webp,image/*";
  } else if (modality === "ecg" || modality === "holter_monitor") {
    accept = "image/*,.csv,.edf,application/pdf,.pdf";
  } else if (modality === "spirometry" || modality === "nerve_conduction") {
    accept = "image/*,application/pdf,.pdf,.csv,.png,.jpg";
  } else if (modality === "pathology" || modality === "immunohistochem") {
    accept =
      "image/jpeg,image/png,image/tiff,.tif,.tiff,.svs,application/octet-stream";
  } else if (modality === "cytology") {
    accept = "image/jpeg,image/png,image/tiff,.tif,.tiff";
  } else if (modality === "dental_cbct" || modality === "ortho_implant") {
    accept =
      "application/dicom,.dcm,.dic,image/jpeg,image/png,.stl,model/stl";
  } else if (modality.startsWith("ct_") || modality === "ct") {
    accept =
      "application/zip,.zip,image/jpeg,image/png,.jpg,.jpeg,.png," +
      "application/dicom,.dcm,.dic,.nii,.nii.gz,.edf,.csv,.svs,.mp4";
  } else {
    accept =
      "image/*,application/dicom,.dcm,.dic,.nii,.nii.gz,.edf,.csv,.svs,.mp4,.avi,video/mp4,video/x-msvideo";
  }
  if (opts?.pro2dOnly) {
    return stripVideoFromAccept(accept);
  }
  return accept;
}

export const SCAN_PHASES = [
  { stage: "received", text: "IMAGE RECEIVED", duration: 600 },
  { stage: "detecting", text: "DETECTING MODALITY…", duration: 800 },
  { stage: "routing", text: "ROUTING TO AI SERVICE…", duration: 600 },
  { stage: "analyzing", text: "ANALYSING PIXEL MATRIX…", duration: 2000 },
  { stage: "heatmap", text: "GENERATING ATTENTION MAP…", duration: 1000 },
  { stage: "extracting", text: "EXTRACTING FINDINGS…", duration: 800 },
  { stage: "complete", text: "ANALYSIS COMPLETE", duration: 0 },
] as const;

export const DISCLAIMER =
  "AI-assisted decision support tool only. Not a diagnostic device. " +
  "All findings require clinical correlation and radiologist verification. " +
  "Do not use as sole basis for diagnosis or treatment decisions.";

export const SEVERITY_CONFIG = {
  critical: {
    color: "var(--critical)",
    bg: "var(--critical-bg)",
    border: "var(--critical-border)",
    label: "Critical",
  },
  warning: {
    color: "var(--warning)",
    bg: "var(--warning-bg)",
    border: "var(--warning-border)",
    label: "Attention",
  },
  info: {
    color: "var(--info)",
    bg: "var(--info-bg)",
    border: "var(--info-border)",
    label: "Noted",
  },
  clear: {
    color: "var(--clear)",
    bg: "var(--clear-bg)",
    border: "var(--clear-border)",
    label: "Normal",
  },
} as const;
