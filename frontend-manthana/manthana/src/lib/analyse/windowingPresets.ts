/**
 * Radiologist-standard DICOM Windowing / Window-Level Presets
 * WW = Window Width (contrast range)
 * WC = Window Center (brightness)
 */

export interface WindowingPreset {
  id: string;
  label: string;
  icon: string;
  ww: number;   // Window Width
  wc: number;   // Window Center (Level)
  description: string;
}

export const WINDOWING_PRESETS: WindowingPreset[] = [
  {
    id: "default",
    label: "Default",
    icon: "⬛",
    ww: 400,
    wc: 40,
    description: "DICOM default",
  },
  {
    id: "lung",
    label: "Lung",
    icon: "🫁",
    ww: 1500,
    wc: -600,
    description: "Pulmonary parenchyma",
  },
  {
    id: "mediastinum",
    label: "Mediast.",
    icon: "🫀",
    ww: 400,
    wc: 40,
    description: "Mediastinal structures",
  },
  {
    id: "bone",
    label: "Bone",
    icon: "🦴",
    ww: 2000,
    wc: 400,
    description: "Cortical bone",
  },
  {
    id: "brain",
    label: "Brain",
    icon: "🧠",
    ww: 80,
    wc: 40,
    description: "Brain parenchyma",
  },
  {
    id: "subdural",
    label: "Subdural",
    icon: "💧",
    ww: 200,
    wc: 80,
    description: "Subdural/epidural",
  },
  {
    id: "abdomen",
    label: "Abdomen",
    icon: "🔲",
    ww: 400,
    wc: 50,
    description: "Abdominal organs",
  },
  {
    id: "liver",
    label: "Liver",
    icon: "🔵",
    ww: 150,
    wc: 70,
    description: "Hepatic parenchyma",
  },
  {
    id: "soft_tissue",
    label: "Soft Tissue",
    icon: "🟣",
    ww: 350,
    wc: 50,
    description: "Neck, pelvis",
  },
  {
    id: "angio",
    label: "Angio",
    icon: "🔴",
    ww: 600,
    wc: 300,
    description: "CT Angiography",
  },
];

export const DEFAULT_PRESET = WINDOWING_PRESETS[0];

/**
 * Auto-select the best preset for a given DICOM modality
 */
export function getAutoPreset(modality: string, bodyPart?: string): WindowingPreset {
  const m = modality?.toUpperCase() || "";
  const b = (bodyPart || "").toLowerCase();

  if (m === "CT") {
    if (b.includes("chest") || b.includes("thorax") || b.includes("lung")) {
      return WINDOWING_PRESETS.find((p) => p.id === "lung")!;
    }
    if (b.includes("head") || b.includes("brain") || b.includes("skull")) {
      return WINDOWING_PRESETS.find((p) => p.id === "brain")!;
    }
    if (b.includes("abdomen") || b.includes("pelvis")) {
      return WINDOWING_PRESETS.find((p) => p.id === "abdomen")!;
    }
    if (b.includes("bone") || b.includes("spine") || b.includes("extremity")) {
      return WINDOWING_PRESETS.find((p) => p.id === "bone")!;
    }
    return WINDOWING_PRESETS.find((p) => p.id === "mediastinum")!;
  }

  // MR, PET, NM: use default (no windowing presets map well without VOI LUT)
  return DEFAULT_PRESET;
}

/**
 * Get Hounsfield Unit (HU) tissue label — useful for showing HU readout
 */
export function getHULabel(huValue: number): string {
  if (huValue < -950) return "Air";
  if (huValue < -700) return "Emphysema";
  if (huValue < -600) return "Lung";
  if (huValue < -100) return "Fat";
  if (huValue < 20) return "Water/Fluid";
  if (huValue < 80) return "Soft Tissue";
  if (huValue < 300) return "Muscle/Organ";
  if (huValue < 700) return "Cancellous Bone";
  return "Cortical Bone";
}
