// Shared CT wizard domain helpers.

export type CtBodyRegion =
  | "chest_ct"
  | "cardiac_ct"
  | "abdominal_ct"
  | "spine_ct"
  | "ct_brain";
export type CtContrastPhase = "non_contrast" | "contrast" | "both_phases";
export type CtUploadPathKind = "dicom" | "image";
export type CtDicomFileBand = "lt30" | "30_80" | "80_300" | "300p";
export type CtImageViewMode = "single" | "multi";

export interface CtWizardState {
  region: CtBodyRegion;
  contrast_phase: CtContrastPhase;
  upload_path: CtUploadPathKind;
  dicom_file_band: CtDicomFileBand;
  image_view_mode: CtImageViewMode;
  scanner_slices: 16 | 32 | 64 | 128 | null;
  /** Optional NCCT brain triage hints (sent when region is ct_brain). */
  brain_trauma_context?: boolean;
  anticoagulant_therapy?: boolean;
  acute_neuro_deficit_symptoms?: boolean;
}

export const CT_WIZARD_INITIAL: CtWizardState = {
  region: "abdominal_ct",
  contrast_phase: "non_contrast",
  upload_path: "dicom",
  dicom_file_band: "30_80",
  image_view_mode: "single",
  scanner_slices: null,
};

/**
 * Representative slice/file count for `patient_context_json.declared_file_count`.
 * Abdomen/chest backend (`_plan_totalseg`): n < 30 skips TotalSeg; 30–79 → fast; ≥80 → full.
 * Other CT services use on-disk DICOM count when available; this value is a planning hint only.
 */
export function declaredFileCountFromWizard(s: CtWizardState): number {
  if (s.upload_path === "image") {
    return s.image_view_mode === "single" ? 1 : 5;
  }
  switch (s.dicom_file_band) {
    case "lt30":
      return 20;
    case "30_80":
      return 55;
    case "80_300":
      return 180;
    case "300p":
      return 450;
    default:
      return 0;
  }
}

export function uploadTypeFromWizard(
  s: CtWizardState,
  firstFile?: File
): "dicom_zip" | "dicom_folder" | "image_files" {
  if (s.upload_path === "image") return "image_files";
  const name = firstFile?.name?.toLowerCase() ?? "";
  if (name.endsWith(".zip")) return "dicom_zip";
  return "dicom_folder";
}

/** Only abdominal + chest CT use `08_abdominal_ct` TotalSeg planning (`totalseg_model`). */
export function totalsegModelFromWizard(
  s: CtWizardState
): "fast" | "full" | undefined {
  if (s.region !== "abdominal_ct" && s.region !== "chest_ct") return undefined;
  if (s.upload_path === "image") return undefined;
  const n = declaredFileCountFromWizard(s);
  if (n < 30) return undefined;
  if (n < 80) return "fast";
  return "full";
}

export type CtDicomBandOption = { id: CtDicomFileBand; label: string };

/** Wizard DICOM dropdown labels aligned with each CT backend’s behavior. */
export function ctDicomBandsForRegion(region: CtBodyRegion): CtDicomBandOption[] {
  const abdomenChest: CtDicomBandOption[] = [
    {
      id: "lt30",
      label: "< 30 DICOM files — TotalSegmentator off (same rule for CT chest via abdomen service)",
    },
    {
      id: "30_80",
      label: "30–79 files — TotalSeg fast tier (80+ for full 3D volumetrics)",
    },
    { id: "80_300", label: "80–300 files — full 3D segmentation path" },
    { id: "300p", label: "300+ files — complete volumetric study" },
  ];
  const cardiac: CtDicomBandOption[] = [
    {
      id: "lt30",
      label: "< 30 files — short series; chamber/aorta metrics may be degraded",
    },
    {
      id: "30_80",
      label: "30–79 files — moderate coverage; more slices improve segmentation",
    },
    { id: "80_300", label: "80–300 files — strong volumetric cardiac CT (preferred)" },
    { id: "300p", label: "300+ files — full volumetric study" },
  ];
  const spine: CtDicomBandOption[] = [
    {
      id: "lt30",
      label: "< 30 files — thin coverage; spine / vertebra metrics often limited",
    },
    {
      id: "30_80",
      label: "30–79 files — partial spine; more slices improve vertebral analysis",
    },
    { id: "80_300", label: "80–300 files — multi-level spine CT (preferred)" },
    { id: "300p", label: "300+ files — long-segment / full study" },
  ];
  const brain: CtDicomBandOption[] = [
    {
      id: "lt30",
      label: "< 30 axial images — pipeline runs; expect degraded-input warnings",
    },
    {
      id: "30_80",
      label: "30–79 images — typical NCCT head coverage",
    },
    { id: "80_300", label: "80+ images — full head series (preferred)" },
    { id: "300p", label: "300+ — complete volumetric acquisition" },
  ];

  switch (region) {
    case "abdominal_ct":
    case "chest_ct":
      return abdomenChest;
    case "cardiac_ct":
      return cardiac;
    case "spine_ct":
      return spine;
    case "ct_brain":
      return brain;
    default:
      return abdomenChest;
  }
}

export function ctQualityMessage(
  band: CtDicomFileBand,
  region: CtBodyRegion
): { level: "bad" | "mid" | "good" | "best"; text: string } {
  if (region === "abdominal_ct" || region === "chest_ct") {
    switch (band) {
      case "lt30":
        return {
          level: "bad",
          text: "Backend: fewer than 30 DICOM instances → TotalSegmentator not run; no organ volumes. Upload 30+ (80+ for full 3D). CT chest uses this same service.",
        };
      case "30_80":
        return {
          level: "mid",
          text: "Backend: TotalSeg runs in fast tier; quality tier is “degraded” vs full until 80+ slices.",
        };
      case "80_300":
        return {
          level: "good",
          text: "Backend: full 3D TotalSeg path — segmentation and volume estimates per pipeline.",
        };
      case "300p":
        return {
          level: "best",
          text: "Backend: complete volumetric study — best match for full metrics when deployed.",
        };
      default:
        return { level: "mid", text: "" };
    }
  }
  if (region === "cardiac_ct") {
    switch (band) {
      case "lt30":
        return {
          level: "bad",
          text: "Backend: very short series or single-slice input is flagged degraded — chamber segmentation needs a full axial cardiac CT when possible.",
        };
      case "30_80":
        return {
          level: "mid",
          text: "Moderate slice count; more axial images improve heart-chamber and aorta proxy outputs.",
        };
      case "80_300":
        return {
          level: "good",
          text: "Strong volumetric input — aligns with reliable TotalSeg heart-chamber task on typical studies.",
        };
      case "300p":
        return { level: "best", text: "Full volumetric study — optimal for cardiac CT analysis." };
      default:
        return { level: "mid", text: "" };
    }
  }
  if (region === "spine_ct") {
    switch (band) {
      case "lt30":
        return {
          level: "bad",
          text: "Backend: single-slice or thin coverage → degraded findings; full spine CT series is preferred for vertebra metrics.",
        };
      case "30_80":
        return {
          level: "mid",
          text: "Partial coverage; more slices improve vertebra labeling and height-style metrics.",
        };
      case "80_300":
        return {
          level: "good",
          text: "Good volumetric spine CT — suitable for multi-level vertebrae segmentation when the model succeeds.",
        };
      case "300p":
        return { level: "best", text: "Extended coverage — best for long-segment spine evaluation." };
      default:
        return { level: "mid", text: "" };
    }
  }
  switch (band) {
    case "lt30":
      return {
        level: "bad",
        text: "No 30-slice gate in CT Brain service — analysis still runs. Thin/single-slice input triggers degraded warnings; deploy TorchScript for ICH scores.",
      };
    case "30_80":
      return {
        level: "mid",
        text: "Typical NCCT head range; classifier resamples volume — always correlate clinically.",
      };
    case "80_300":
      return {
        level: "good",
        text: "Full head axial coverage — preferred for robust NCCT inference.",
      };
    case "300p":
      return {
        level: "best",
        text: "Very large series — supported; model resamples to fixed depth.",
      };
    default:
      return { level: "mid", text: "" };
  }
}

export function ctImageUploadHint(region: CtBodyRegion): { title: string; body: string } {
  const tail =
    "Volumetric DICOM (or NIfTI) from the scanner is always preferred over photos.";
  switch (region) {
    case "abdominal_ct":
    case "chest_ct":
      return {
        title: "Photo / image upload",
        body: `JPG or PNG only produce a 2D bitmap. Backend sets upload_type=image_files → TotalSegmentator is not run; no organ volumes. ${tail}`,
      };
    case "cardiac_ct":
      return {
        title: "Photo / image upload",
        body: `Single 2D view — chamber TotalSeg expects volumetric DICOM; output will be degraded. ${tail}`,
      };
    case "spine_ct":
      return {
        title: "Photo / image upload",
        body: `Single view cannot replace a spine CT series; vertebra metrics will be limited. ${tail}`,
      };
    case "ct_brain":
      return {
        title: "Photo / image upload",
        body: `One image may run through the NCCT head path but is far less reliable than a full DICOM series; expect degraded behavior. ${tail}`,
      };
  }
}

export function gatewayModalityForCtRegion(region: CtBodyRegion): string {
  return region;
}

/** First-class CT product buttons in the UI (replaces a single generic “CT Scan”). */
export const CT_PRODUCT_MODALITY_IDS = [
  "ct_abdomen",
  "ct_chest",
  "ct_cardiac",
  "ct_spine",
  "ct_brain",
] as const;

export type CtProductModalityId = (typeof CT_PRODUCT_MODALITY_IDS)[number];

export function isCtProductModality(id: string): id is CtProductModalityId {
  return (CT_PRODUCT_MODALITY_IDS as readonly string[]).includes(id);
}

export function ctBodyRegionForProductModality(id: string): CtBodyRegion {
  switch (id) {
    case "ct_abdomen":
      return "abdominal_ct";
    case "ct_chest":
      return "chest_ct";
    case "ct_cardiac":
      return "cardiac_ct";
    case "ct_spine":
      return "spine_ct";
    case "ct_brain":
      return "ct_brain";
    default:
      return CT_WIZARD_INITIAL.region;
  }
}

/** Gateway `modality` form value for a CT product button. */
export function gatewayBackendModalityForProduct(id: string): string {
  switch (id) {
    case "ct_abdomen":
      return "abdominal_ct";
    case "ct_chest":
      return "chest_ct";
    case "ct_cardiac":
      return "cardiac_ct";
    case "ct_spine":
      return "spine_neuro";
    case "ct_brain":
      return "ct_brain";
    default:
      return "abdominal_ct";
  }
}

/** Map service response modality → modality bar id (for labels after analysis). */
export function modalityBarIdFromBackendCt(modality: string): string | undefined {
  switch (modality) {
    case "abdominal_ct":
      return "ct_abdomen";
    case "chest_ct":
      return "ct_chest";
    case "cardiac_ct":
      return "ct_cardiac";
    case "spine_neuro":
      return "ct_spine";
    case "ct_brain":
      return "ct_brain";
    default:
      return undefined;
  }
}

export function buildCtPatientContextJson(
  base: Record<string, unknown> | undefined,
  wizard: CtWizardState,
  files: File[]
): Record<string, unknown> {
  const declared = declaredFileCountFromWizard(wizard);
  const upload_type = uploadTypeFromWizard(wizard, files[0]);
  const totalseg_model = totalsegModelFromWizard(wizard);
  const out: Record<string, unknown> = { ...(base ?? {}) };
  out.ct_region = wizard.region;
  out.contrast_phase = wizard.contrast_phase;
  out.upload_type = upload_type;
  out.declared_file_count = declared;
  if (wizard.scanner_slices != null) {
    out.scanner_slices = wizard.scanner_slices;
  }
  if (totalseg_model) {
    out.totalseg_model = totalseg_model;
  }
  if (wizard.region === "ct_brain") {
    const clinical: Record<string, boolean> = {};
    if (wizard.brain_trauma_context) clinical.trauma_context = true;
    if (wizard.anticoagulant_therapy) clinical.anticoagulant_therapy = true;
    if (wizard.acute_neuro_deficit_symptoms) clinical.acute_neuro_deficit_symptoms = true;
    if (Object.keys(clinical).length) {
      out.ct_brain_clinical_context = clinical;
    }
  }
  return out;
}

