/* ═══ CONSTANTS — Manthana Radiologist Copilot ═══ */
import type { Modality } from "./types";

export const BRAND = "Manthana Radiologist Copilot";

export const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || "http://localhost:8000";

/** Same-origin proxy base (`app/api/[...path]/route.ts`) — optional; main client still uses `GATEWAY_URL` + JWT. */
export const API_BASE = "/api";

export const MODALITIES: Modality[] = [
  {
    id: "auto",
    label: "Auto-Detect",
    icon: "AUTO",
    port: 8000,
    description: "AI auto-detects modality and routes to the correct service",
    models: ["All"],
  },
  {
    id: "xray",
    label: "X-Ray",
    icon: "XRAY",
    port: 8001,
    description: "Any body X-ray — chest, bone, abdomen, spine, skull (auto-detects region)",
    models: ["MedRAX-2", "CheXagent", "YOLOv8", "TotalSeg"],
  },
  {
    id: "ct_abdomen",
    label: "CT Abdomen / Pelvis",
    icon: "CT",
    port: 8008,
    description:
      "Abdominopelvic CT — TotalSegmentator, mask-based metrics, optional Comp2Comp on adequate DICOM series; narrative policy is env-controlled.",
    models: ["TotalSegmentator", "Comp2Comp", "Manthana analysis"],
  },
  {
    id: "ct_chest",
    label: "CT Chest",
    icon: "CT",
    port: 8008,
    description:
      "Thoracic CT — routed to the same analysis service as abdomen/pelvis with explicit chest context (intentional product contract; see backend docs).",
    models: ["TotalSegmentator", "Comp2Comp", "Manthana analysis"],
  },
  {
    id: "ct_cardiac",
    label: "CT Cardiac",
    icon: "CT",
    port: 8004,
    description:
      "Cardiac CT — TotalSegmentator heart-chamber task + aortic proxy metrics; optional LLM narrative when enabled in ops config.",
    models: ["TotalSegmentator-heartchambers", "Manthana analysis"],
  },
  {
    id: "ct_spine",
    label: "CT Spine / Neuro",
    icon: "CT",
    port: 8010,
    description:
      "Spine / neuro CT — vertebrae segmentation and structured spine metrics; narrative provider order controlled by CT_SPINE_NARRATIVE_POLICY.",
    models: ["TotalSegmentator-vertebrae", "Manthana analysis"],
  },
  {
    id: "ct_brain",
    label: "CT Brain (NCCT)",
    icon: "CT",
    port: 8017,
    description:
      "Non-contrast head CT — ICH risk scoring via deploy-time TorchScript; narrative order from CT_BRAIN_NARRATIVE_POLICY; not a substitute for full neuroradiology read.",
    models: ["Manthana Neuro CT Engine", "Manthana Report AI"],
  },
  {
    id: "brain_mri",
    label: "Brain MRI",
    icon: "MRI",
    port: 8002,
    description:
      "Brain / head MRI — TotalSegmentator total_mr volumetrics, optional SynthSeg parcellation, optional Prima, clinical LLM narrative (policy-controlled). Does not auto-route spine or MSK studies.",
    models: ["TotalSegmentator-MRI", "SynthSeg", "Prima", "Manthana Report AI"],
  },
  {
    id: "spine_mri",
    label: "Spine / Neuro MRI",
    icon: "MRI",
    port: 8010,
    description:
      "Spine MRI — same spine_neuro service as CT spine; TotalSeg vertebrae_mr when MR is detected. Not for brain-only exams.",
    models: ["TotalSegmentator-vertebrae", "Manthana analysis"],
  },
  {
    id: "ultrasound",
    label: "Ultrasound",
    icon: "USG",
    port: 8009,
    description: "Ultrasound image & video analysis",
    models: ["OpenUS", "MedSAM2"],
  },
  {
    id: "ecg",
    label: "ECG",
    icon: "ECG",
    port: 8013,
    description: "12-lead ECG analysis — photo or digital",
    models: ["ecg-fm", "HeartLang"],
  },
  {
    id: "pathology",
    label: "Pathology",
    icon: "PATH",
    port: 8005,
    description: "Whole slide image analysis — tissue classification",
    models: ["Virchow"],
  },
  {
    id: "mammography",
    label: "Mammography",
    icon: "MAM",
    port: 8012,
    description:
      "Mirai 5-year breast cancer risk (requires four standard views). Single-image upload: qualitative assessment only.",
    models: ["Mirai"],
  },
  {
    id: "cytology",
    label: "Cytology",
    icon: "CYTO",
    port: 8011,
    description: "Cell-level analysis — Pap smear, FNA",
    models: ["Virchow Cell"],
  },
  {
    id: "oral_cancer",
    label: "Oral Cancer",
    icon: "ORAL",
    port: 8014,
    description: "Oral lesion screening from phone photos",
    models: ["EfficientNet-B3"],
  },
  {
    id: "lab_report",
    label: "Lab Reports",
    icon: "LAB",
    port: 8015,
    description: "Blood, urine, biochemistry & any lab report — PDF or text",
    models: ["Clinical-LLM"],
  },
  {
    id: "dermatology",
    label: "Dermatology",
    icon: "DERM",
    port: 8016,
    description:
      "Skin lesions, rashes, pigmentation — structured screening and narrative report",
    models: ["Manthana Derm Engine"],
  },
];

/** Browser file input `accept` by modality — oral cancer is clinical photos only. */
export function getUploadAcceptTypes(modality: string): string {
  if (modality === "lab_report") {
    return "application/pdf,.pdf,.txt,.csv,.tsv,text/*,image/*";
  }
  if (modality === "oral_cancer" || modality === "dermatology") {
    return "image/jpeg,image/png,image/webp,image/*";
  }
  if (modality === "ecg") {
    return "image/*,.csv,.edf";
  }
  if (modality === "ct" || modality.startsWith("ct_")) {
    return (
      "application/zip,.zip,image/jpeg,image/png,.jpg,.jpeg,.png," +
      "application/dicom,.dcm,.dic,.nii,.nii.gz,.edf,.csv,.svs,.mp4"
    );
  }
  return "image/*,.dcm,.nii,.nii.gz,.edf,.csv,.svs,.mp4";
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
