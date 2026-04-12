/**
 * Clinical calculators for ECG intake UI (Bazett QTc, CHA₂DS₂-VASc, BMI).
 */

export type QtcBand = "normal" | "borderline" | "prolonged" | "critical";

export function qtcBazett(qtMs: number, rrMs: number): number | null {
  if (!Number.isFinite(qtMs) || !Number.isFinite(rrMs) || qtMs <= 0 || rrMs <= 0) {
    return null;
  }
  const rrSec = rrMs / 1000;
  return qtMs / Math.sqrt(rrSec);
}

/** HR in bpm → RR interval ms */
export function hrToRrMs(hr: number): number | null {
  if (!Number.isFinite(hr) || hr <= 0) return null;
  return 60000 / hr;
}

export function classifyQtc(qtcMs: number, sex: "M" | "F" | "Other" | ""): QtcBand {
  if (!Number.isFinite(qtcMs)) return "normal";
  const isFemale = sex === "F";
  const border = isFemale ? 460 : 440;
  const prolonged = 500;
  if (qtcMs > prolonged) return "critical";
  if (qtcMs > border) return "prolonged";
  if (qtcMs > border - 10) return "borderline";
  return "normal";
}

export function qtcBandColor(band: QtcBand): string {
  switch (band) {
    case "normal":
      return "rgba(48,209,88,0.85)";
    case "borderline":
      return "rgba(255,200,80,0.9)";
    case "prolonged":
      return "rgba(255,149,0,0.9)";
    case "critical":
      return "rgba(255,80,80,0.95)";
    default:
      return "var(--text-55)";
  }
}

export interface Cha2ds2VascInput {
  age: number;
  sex: "M" | "F" | "Other" | "";
  congestiveHeartFailure: boolean;
  hypertension: boolean;
  diabetes: boolean;
  strokeOrTia: boolean;
  vascularDisease: boolean; /* PAD, prior MI, aortic plaque */
}

/** Returns integer score 0–9 */
export function computeCha2ds2Vasc(i: Cha2ds2VascInput): number {
  let s = 0;
  if (i.age >= 75) s += 2;
  else if (i.age >= 65) s += 1;
  if (i.sex === "F") s += 1;
  if (i.congestiveHeartFailure) s += 1;
  if (i.hypertension) s += 1;
  if (i.diabetes) s += 1;
  if (i.strokeOrTia) s += 2;
  if (i.vascularDisease) s += 1;
  return s;
}

export function cha2ds2VascInterpret(score: number): string {
  if (score <= 0) return "Low stroke risk (non-valvular AF context)";
  if (score <= 2) return "Moderate — anticoagulation often considered if AF";
  return "High — strong anticoagulation consideration if AF";
}

export function computeBmiKgM2(weightKg: number, heightM: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(heightM) || heightM <= 0 || weightKg <= 0) {
    return null;
  }
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}
