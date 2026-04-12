/**
 * ECG scanner context: form state ↔ API `patient_context_json` (nested patient_context).
 */

export interface EcgMedicationRow {
  id: string;
  drug: string;
  dose: string;
  frequency: string;
}

export interface EcgFormData {
  demographics: {
    age: string;
    sex: string; // M | F | Other | ""
    state_region: string;
    urban_rural: string;
    occupation: string;
  };
  presenting_complaint: {
    chief_complaint: string;
    duration: string;
    character: string;
    onset: string;
    associated_symptoms: string[]; // multi
    exertional_or_rest: string;
  };
  vitals_at_presentation: {
    bp_systolic: string;
    bp_diastolic: string;
    heart_rate: string;
    spo2_percent: string;
    temperature_celsius: string;
    respiratory_rate: string;
  };
  cardiac_history: {
    prior_mi: boolean;
    prior_mi_year: string;
    prior_pci_cabg: boolean;
    known_cad: boolean;
    heart_failure: boolean;
    heart_failure_nyha: string;
    prior_arrhythmia: string[];
    rheumatic_fever_history: boolean;
    known_valve_disease: boolean;
    valve_disease_detail: string;
    congenital_heart_disease: boolean;
    prior_ecg_available: boolean;
    icd_pacemaker: boolean;
  };
  medical_history: {
    hypertension: boolean;
    hypertension_years: string;
    diabetes: boolean;
    diabetes_type: string;
    diabetes_years: string;
    dyslipidemia: boolean;
    ckd: boolean;
    ckd_stage: string;
    copd_asthma: boolean;
    thyroid_disorder: boolean;
    thyroid_type: string;
    stroke_tia: boolean;
    peripheral_arterial_disease: boolean;
    autoimmune_disease: boolean;
    tuberculosis_history: boolean;
    hiv: boolean;
    anemia: boolean;
    liver_disease: boolean;
    obesity: boolean;
    height_m: string;
    weight_kg: string;
    obstructive_sleep_apnea: boolean;
  };
  family_history: {
    premature_cad: boolean;
    premature_cad_details: string;
    sudden_cardiac_death: boolean;
    hcm_or_cardiomyopathy: boolean;
    familial_hypercholesterolemia: boolean;
    long_qt_or_channelopathy: boolean;
    rheumatic_heart_disease: boolean;
    hypertension: boolean;
    diabetes: boolean;
  };
  lifestyle: {
    smoking_status: string;
    smoking_pack_years: string;
    smoking_quit_year: string;
    alcohol: string;
    alcohol_units_per_week: string;
    tobacco_chewing: boolean;
    betel_nut_use: boolean;
    physical_activity: string;
    diet_type: string;
    diet_pattern: string[];
    stress_level: string;
    sleep_hours: string;
  };
  current_medications: EcgMedicationRow[];
  recent_events: {
    recent_illness: boolean;
    recent_illness_detail: string;
    recent_viral_fever: boolean;
    recent_surgery: boolean;
    recent_surgery_date: string;
    recent_hospitalization: boolean;
    recent_long_travel: boolean;
    recent_immobilization: boolean;
    covid_history: boolean;
    covid_year: string;
  };
  lab_values_if_available: {
    hemoglobin_g_dl: string;
    serum_potassium_meq_l: string;
    serum_sodium_meq_l: string;
    creatinine_mg_dl: string;
    tsh_uiu_ml: string;
    hba1c_percent: string;
    total_cholesterol_mg_dl: string;
    ldl_mg_dl: string;
    hdl_mg_dl: string;
    triglycerides_mg_dl: string;
    troponin_i_ng_ml: string;
    bnp_or_nt_pro_bnp: string;
    d_dimer: string;
    magnesium: string;
  };
  ecg_context: {
    ecg_indication: string;
    time_of_ecg: string;
    serial_ecg_number: string;
    is_serial_comparison: boolean;
  };
  /** Manual QT / HR for calculator when labs section used */
  calculator_qt_ms: string;
  calculator_hr_bpm: string;
}

let _mid = 0;
export function newMedRow(): EcgMedicationRow {
  _mid += 1;
  return { id: `m${_mid}`, drug: "", dose: "", frequency: "" };
}

export function emptyEcgFormData(): EcgFormData {
  return {
    demographics: {
      age: "",
      sex: "",
      state_region: "",
      urban_rural: "",
      occupation: "",
    },
    presenting_complaint: {
      chief_complaint: "",
      duration: "",
      character: "",
      onset: "",
      associated_symptoms: [],
      exertional_or_rest: "",
    },
    vitals_at_presentation: {
      bp_systolic: "",
      bp_diastolic: "",
      heart_rate: "",
      spo2_percent: "",
      temperature_celsius: "",
      respiratory_rate: "",
    },
    cardiac_history: {
      prior_mi: false,
      prior_mi_year: "",
      prior_pci_cabg: false,
      known_cad: false,
      heart_failure: false,
      heart_failure_nyha: "",
      prior_arrhythmia: [],
      rheumatic_fever_history: false,
      known_valve_disease: false,
      valve_disease_detail: "",
      congenital_heart_disease: false,
      prior_ecg_available: false,
      icd_pacemaker: false,
    },
    medical_history: {
      hypertension: false,
      hypertension_years: "",
      diabetes: false,
      diabetes_type: "",
      diabetes_years: "",
      dyslipidemia: false,
      ckd: false,
      ckd_stage: "",
      copd_asthma: false,
      thyroid_disorder: false,
      thyroid_type: "",
      stroke_tia: false,
      peripheral_arterial_disease: false,
      autoimmune_disease: false,
      tuberculosis_history: false,
      hiv: false,
      anemia: false,
      liver_disease: false,
      obesity: false,
      height_m: "",
      weight_kg: "",
      obstructive_sleep_apnea: false,
    },
    family_history: {
      premature_cad: false,
      premature_cad_details: "",
      sudden_cardiac_death: false,
      hcm_or_cardiomyopathy: false,
      familial_hypercholesterolemia: false,
      long_qt_or_channelopathy: false,
      rheumatic_heart_disease: false,
      hypertension: false,
      diabetes: false,
    },
    lifestyle: {
      smoking_status: "",
      smoking_pack_years: "",
      smoking_quit_year: "",
      alcohol: "",
      alcohol_units_per_week: "",
      tobacco_chewing: false,
      betel_nut_use: false,
      physical_activity: "",
      diet_type: "",
      diet_pattern: [],
      stress_level: "",
      sleep_hours: "",
    },
    current_medications: [newMedRow()],
    recent_events: {
      recent_illness: false,
      recent_illness_detail: "",
      recent_viral_fever: false,
      recent_surgery: false,
      recent_surgery_date: "",
      recent_hospitalization: false,
      recent_long_travel: false,
      recent_immobilization: false,
      covid_history: false,
      covid_year: "",
    },
    lab_values_if_available: {
      hemoglobin_g_dl: "",
      serum_potassium_meq_l: "",
      serum_sodium_meq_l: "",
      creatinine_mg_dl: "",
      tsh_uiu_ml: "",
      hba1c_percent: "",
      total_cholesterol_mg_dl: "",
      ldl_mg_dl: "",
      hdl_mg_dl: "",
      triglycerides_mg_dl: "",
      troponin_i_ng_ml: "",
      bnp_or_nt_pro_bnp: "",
      d_dimer: "",
      magnesium: "",
    },
    ecg_context: {
      ecg_indication: "",
      time_of_ecg: "",
      serial_ecg_number: "",
      is_serial_comparison: false,
    },
    calculator_qt_ms: "",
    calculator_hr_bpm: "",
  };
}

function numOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : null;
}

function intOrNull(s: string): number | null {
  const t = s.trim();
  if (!t) return null;
  const n = parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

/** Strip empty strings / empty arrays from nested object for JSON */
function pruneEmpty(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    const arr = obj.map(pruneEmpty).filter((x) => x !== undefined && x !== "");
    return arr.length ? arr : undefined;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const p = pruneEmpty(v);
    if (p === undefined) continue;
    if (p === false) {
      out[k] = false;
      continue;
    }
    if (typeof p === "object" && p !== null && !Array.isArray(p) && Object.keys(p as object).length === 0) {
      continue;
    }
    if (Array.isArray(p) && p.length === 0) continue;
    if (p === "") continue;
    out[k] = p;
  }
  return Object.keys(out).length ? out : undefined;
}

function sexForApi(sex: string): string {
  const u = sex.trim().toUpperCase();
  if (u === "M" || u === "F") return u;
  if (sex.trim().toLowerCase() === "male") return "M";
  if (sex.trim().toLowerCase() === "female") return "F";
  return sex.trim() || "Unknown";
}

/** Build long clinical_history string for backward compatibility */
export function synthesizeClinicalHistory(d: EcgFormData): string {
  const parts: string[] = [];
  const pc = d.presenting_complaint;
  if (pc.chief_complaint) {
    parts.push(
      `Chief complaint: ${pc.chief_complaint}${pc.duration ? ` (${pc.duration})` : ""}${pc.character ? ` — ${pc.character}` : ""}`
    );
  }
  if (d.medical_history.hypertension) parts.push("Hypertension");
  if (d.medical_history.diabetes) parts.push(`Diabetes ${d.medical_history.diabetes_type || "T2"}`);
  if (d.cardiac_history.known_cad) parts.push("Known CAD");
  if (d.family_history.premature_cad) parts.push(`Family premature CAD: ${d.family_history.premature_cad_details || "yes"}`);
  const meds = d.current_medications.filter((m) => m.drug.trim());
  if (meds.length) {
    parts.push("Meds: " + meds.map((m) => [m.drug, m.dose, m.frequency].filter(Boolean).join(" ")).join("; "));
  }
  return parts.join(". ") || "";
}

export interface EcgScannerContext {
  patientId: string;
  /** Mirrors legacy PatientContextForm for history / notes builders */
  age: string;
  gender: string;
  location: string;
  tobaccoUse: string;
  symptoms: string;
  clinicalHistory: string;
  fastingStatus: string;
  medications: string;
  ecgForm: EcgFormData;
}

export function createInitialEcgScannerContext(scanNumber: number): EcgScannerContext {
  const patientId = `ANONYMOUS-${String(scanNumber).padStart(3, "0")}`;
  return {
    patientId,
    age: "",
    gender: "",
    location: "",
    tobaccoUse: "",
    symptoms: "",
    clinicalHistory: "",
    fastingStatus: "unknown",
    medications: "",
    ecgForm: emptyEcgFormData(),
  };
}

export function buildEcgApiPatientContextJson(ctx: EcgScannerContext): Record<string, unknown> {
  const d = ctx.ecgForm;
  const ageNum = intOrNull(d.demographics.age);

  const rawSex = d.demographics.sex.trim().toLowerCase();
  const demoSex =
    rawSex === "m" || rawSex === "male"
      ? "male"
      : rawSex === "f" || rawSex === "female"
        ? "female"
        : d.demographics.sex.trim() || undefined;

  const patient_context: Record<string, unknown> = {
    demographics: pruneEmpty({
      age: ageNum,
      sex: demoSex,
      state_region: d.demographics.state_region || undefined,
      urban_rural: d.demographics.urban_rural || undefined,
      occupation: d.demographics.occupation || undefined,
    }) as Record<string, unknown>,
    presenting_complaint: pruneEmpty({
      chief_complaint: d.presenting_complaint.chief_complaint || undefined,
      duration: d.presenting_complaint.duration || undefined,
      character: d.presenting_complaint.character || undefined,
      onset: d.presenting_complaint.onset || undefined,
      associated_symptoms:
        d.presenting_complaint.associated_symptoms.length > 0
          ? d.presenting_complaint.associated_symptoms
          : undefined,
      exertional_or_rest: d.presenting_complaint.exertional_or_rest || undefined,
    }) as Record<string, unknown>,
    vitals_at_presentation: pruneEmpty({
      bp_systolic: numOrNull(d.vitals_at_presentation.bp_systolic),
      bp_diastolic: numOrNull(d.vitals_at_presentation.bp_diastolic),
      heart_rate: numOrNull(d.vitals_at_presentation.heart_rate),
      spo2_percent: numOrNull(d.vitals_at_presentation.spo2_percent),
      temperature_celsius: numOrNull(d.vitals_at_presentation.temperature_celsius),
      respiratory_rate: numOrNull(d.vitals_at_presentation.respiratory_rate),
    }) as Record<string, unknown>,
    cardiac_history: pruneEmpty({
      ...d.cardiac_history,
      prior_mi_year: intOrNull(d.cardiac_history.prior_mi_year),
      prior_arrhythmia:
        d.cardiac_history.prior_arrhythmia.length > 0 ? d.cardiac_history.prior_arrhythmia : undefined,
    }) as Record<string, unknown>,
    medical_history: pruneEmpty({
      ...d.medical_history,
      hypertension_years: intOrNull(d.medical_history.hypertension_years),
      diabetes_years: intOrNull(d.medical_history.diabetes_years),
      height_m: numOrNull(d.medical_history.height_m),
      weight_kg: numOrNull(d.medical_history.weight_kg),
    }) as Record<string, unknown>,
    family_history: pruneEmpty(d.family_history) as Record<string, unknown>,
    lifestyle: pruneEmpty({
      ...d.lifestyle,
      smoking_pack_years: numOrNull(d.lifestyle.smoking_pack_years),
      smoking_quit_year: intOrNull(d.lifestyle.smoking_quit_year),
      alcohol_units_per_week: numOrNull(d.lifestyle.alcohol_units_per_week),
      sleep_hours: numOrNull(d.lifestyle.sleep_hours),
      diet_pattern: d.lifestyle.diet_pattern.length ? d.lifestyle.diet_pattern : undefined,
    }) as Record<string, unknown>,
    current_medications: (() => {
      const rows = d.current_medications
        .filter((m) => m.drug.trim())
        .map((m) =>
          pruneEmpty({
            drug: m.drug.trim(),
            dose: m.dose.trim() || undefined,
            frequency: m.frequency.trim() || undefined,
          })
        );
      return rows.length ? rows : undefined;
    })(),
    recent_events: pruneEmpty({
      ...d.recent_events,
      covid_year: intOrNull(d.recent_events.covid_year),
    }) as Record<string, unknown>,
    lab_values_if_available: pruneEmpty({
      hemoglobin_g_dl: numOrNull(d.lab_values_if_available.hemoglobin_g_dl),
      serum_potassium_meq_l: numOrNull(d.lab_values_if_available.serum_potassium_meq_l),
      serum_sodium_meq_l: numOrNull(d.lab_values_if_available.serum_sodium_meq_l),
      creatinine_mg_dl: numOrNull(d.lab_values_if_available.creatinine_mg_dl),
      tsh_uiu_ml: numOrNull(d.lab_values_if_available.tsh_uiu_ml),
      hba1c_percent: numOrNull(d.lab_values_if_available.hba1c_percent),
      total_cholesterol_mg_dl: numOrNull(d.lab_values_if_available.total_cholesterol_mg_dl),
      ldl_mg_dl: numOrNull(d.lab_values_if_available.ldl_mg_dl),
      hdl_mg_dl: numOrNull(d.lab_values_if_available.hdl_mg_dl),
      triglycerides_mg_dl: numOrNull(d.lab_values_if_available.triglycerides_mg_dl),
      troponin_i_ng_ml: numOrNull(d.lab_values_if_available.troponin_i_ng_ml),
      bnp_or_nt_pro_bnp: d.lab_values_if_available.bnp_or_nt_pro_bnp.trim() || undefined,
      d_dimer: d.lab_values_if_available.d_dimer.trim() || undefined,
      magnesium: numOrNull(d.lab_values_if_available.magnesium),
    }) as Record<string, unknown>,
    ecg_context: pruneEmpty({
      ...d.ecg_context,
      serial_ecg_number: intOrNull(d.ecg_context.serial_ecg_number),
    }) as Record<string, unknown>,
  };

  const prunedPc = pruneEmpty(patient_context) as Record<string, unknown>;

  const out: Record<string, unknown> = {
    patient_id: ctx.patientId,
    output_language: "en",
  };
  if (ageNum !== null) out.age = ageNum;
  out.sex = sexForApi(d.demographics.sex);
  if (ctx.location.trim()) {
    out.geographic_region = ctx.location.trim();
    out.location_body = ctx.location.trim();
  }
  out.patient_context = prunedPc;
  const histParts = [synthesizeClinicalHistory(d), ctx.clinicalHistory.trim(), ctx.symptoms.trim()].filter(
    Boolean
  );
  if (histParts.length) {
    const merged = histParts.join("\n\n");
    out.clinical_history = merged;
    out.history = merged;
  }
  if (ctx.symptoms.trim()) out.symptoms = ctx.symptoms.trim();
  return out;
}

export function ecgFormHasRequiredDemographics(d: EcgFormData): boolean {
  const ageOk = d.demographics.age.trim() !== "" && intOrNull(d.demographics.age) !== null;
  const sexOk = d.demographics.sex.trim() !== "";
  return ageOk && sexOk;
}

/** Rough % of optional structured fields filled (for progress UI). */
export function ecgFormCompletionPercent(d: EcgFormData): number {
  const checks = [
    intOrNull(d.demographics.age) !== null,
    d.demographics.sex.trim() !== "",
    !!d.demographics.state_region.trim(),
    !!d.demographics.urban_rural.trim(),
    !!d.demographics.occupation.trim(),
    !!d.presenting_complaint.chief_complaint.trim(),
    !!d.presenting_complaint.duration.trim(),
    !!d.vitals_at_presentation.bp_systolic.trim(),
    !!d.vitals_at_presentation.heart_rate.trim(),
    Object.values(d.cardiac_history).some((v) => v === true || (typeof v === "string" && v.trim())),
    d.medical_history.hypertension || d.medical_history.diabetes || d.medical_history.dyslipidemia,
    Object.values(d.family_history).some((v) => v === true),
    !!d.lifestyle.smoking_status.trim() || !!d.lifestyle.physical_activity.trim(),
    d.current_medications.some((m) => m.drug.trim()),
    Object.values(d.recent_events).some((v) => v === true || (typeof v === "string" && v.trim())),
    Object.values(d.lab_values_if_available).some((v) => String(v).trim() !== ""),
    !!d.ecg_context.ecg_indication.trim(),
    !!(d.calculator_qt_ms.trim() && d.calculator_hr_bpm.trim()),
  ];
  const filled = checks.filter(Boolean).length;
  return Math.min(100, Math.round((filled / checks.length) * 100));
}

/** Realistic sample for demos — Tamil Nadu urban CAD risk */
export function fillSampleEcgScannerContext(scanNumber: number): EcgScannerContext {
  const patientId = `ANONYMOUS-${String(scanNumber).padStart(3, "0")}`;
  const ecgForm = fillSampleEcgForm();
  return {
    patientId,
    age: ecgForm.demographics.age,
    gender: "male",
    location: "Chennai, Tamil Nadu, India",
    tobaccoUse: "ex-smoker",
    symptoms: "",
    clinicalHistory: "",
    fastingStatus: "unknown",
    medications: "",
    ecgForm,
  };
}

export function fillSampleEcgForm(): EcgFormData {
  const d = emptyEcgFormData();
  d.demographics = {
    age: "52",
    sex: "M",
    state_region: "Tamil Nadu",
    urban_rural: "urban",
    occupation: "Software / IT (sedentary)",
  };
  d.presenting_complaint = {
    chief_complaint: "Chest pain",
    duration: "Subacute (1–24 hours)",
    character: "Crushing / pressure",
    onset: "At rest",
    associated_symptoms: ["Sweating", "Nausea / vomiting"],
    exertional_or_rest: "rest",
  };
  d.vitals_at_presentation = {
    bp_systolic: "160",
    bp_diastolic: "100",
    heart_rate: "88",
    spo2_percent: "97",
    temperature_celsius: "37.2",
    respiratory_rate: "18",
  };
  d.medical_history.hypertension = true;
  d.medical_history.hypertension_years = "8";
  d.medical_history.diabetes = true;
  d.medical_history.diabetes_type = "Type 2";
  d.medical_history.diabetes_years = "5";
  d.medical_history.dyslipidemia = true;
  d.medical_history.obesity = true;
  d.family_history.premature_cad = true;
  d.family_history.premature_cad_details = "Father MI at age 48";
  d.family_history.hypertension = true;
  d.family_history.diabetes = true;
  d.lifestyle.smoking_status = "ex-smoker";
  d.lifestyle.smoking_pack_years = "15";
  d.lifestyle.smoking_quit_year = "2019";
  d.lifestyle.alcohol = "occasional";
  d.lifestyle.alcohol_units_per_week = "4";
  d.lifestyle.physical_activity = "sedentary";
  d.lifestyle.diet_type = "non-vegetarian";
  d.lifestyle.diet_pattern = ["High refined carbohydrate", "High oil / fried food"];
  d.lifestyle.stress_level = "high";
  d.lifestyle.sleep_hours = "5";
  d.current_medications = [
    { id: "s1", drug: "Metformin", dose: "1000mg", frequency: "BD" },
    { id: "s2", drug: "Amlodipine", dose: "5mg", frequency: "OD" },
    { id: "s3", drug: "Atorvastatin", dose: "40mg", frequency: "HS" },
    { id: "s4", drug: "Aspirin", dose: "75mg", frequency: "OD" },
  ];
  d.recent_events.covid_history = true;
  d.recent_events.covid_year = "2022";
  d.lab_values_if_available.hemoglobin_g_dl = "13.2";
  d.lab_values_if_available.serum_potassium_meq_l = "4.1";
  d.lab_values_if_available.serum_sodium_meq_l = "138";
  d.lab_values_if_available.creatinine_mg_dl = "1.1";
  d.lab_values_if_available.hba1c_percent = "8.2";
  d.lab_values_if_available.total_cholesterol_mg_dl = "210";
  d.lab_values_if_available.ldl_mg_dl = "135";
  d.lab_values_if_available.hdl_mg_dl = "38";
  d.lab_values_if_available.triglycerides_mg_dl = "280";
  d.ecg_context.ecg_indication = "Chest pain workup";
  d.ecg_context.time_of_ecg = "14:30";
  d.ecg_context.serial_ecg_number = "1";
  return d;
}
