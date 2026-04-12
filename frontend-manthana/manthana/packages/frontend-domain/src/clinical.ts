// Shared clinical notes and patient context builders used by both frontends.

export function buildClinicalNotesForApi(ctx: {
  age?: string;
  gender?: string;
  location?: string;
  tobaccoUse?: string;
  fastingStatus?: string;
  medications?: string;
  /** Free text — forwarded for LLM narrative / correlation */
  symptoms?: string;
  /** Free text — past history, comorbidities, timeline */
  clinicalHistory?: string;
}): string {
  const parts: string[] = [];
  if (ctx.tobaccoUse) parts.push(`tobacco_use:${ctx.tobaccoUse}`);
  if (ctx.age) parts.push(`age:${ctx.age}`);
  if (ctx.gender) parts.push(`gender:${ctx.gender}`);
  if (ctx.location) parts.push(`location:${ctx.location}`);
  if (ctx.fastingStatus && ctx.fastingStatus !== "unknown") {
    parts.push(`fasting:${ctx.fastingStatus}`);
  }
  if (ctx.medications?.trim()) parts.push(`medications:${ctx.medications.trim()}`);
  const meta = parts.join("; ");
  const sym = ctx.symptoms?.trim();
  const hist = ctx.clinicalHistory?.trim();
  const blocks: string[] = [];
  if (meta) blocks.push(meta);
  if (sym) {
    blocks.push(
      "Presenting symptoms / chief complaint (as entered by clinician):\n" + sym
    );
  }
  if (hist) {
    blocks.push(
      "Relevant clinical history (past illness, comorbidities, medications, timeline):\n" +
        hist
    );
  }
  return blocks.join("\n\n");
}

export function buildPatientContextJsonForApi(ctx: {
  age?: string;
  gender?: string;
  location?: string;
  tobaccoUse?: string;
  symptoms?: string;
  clinicalHistory?: string;
}): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  const ageStr = ctx.age?.trim();
  if (ageStr) {
    const n = parseInt(ageStr, 10);
    if (Number.isFinite(n)) out.age = n;
  }
  if (ctx.gender?.trim()) {
    const g = ctx.gender.trim().toUpperCase();
    out.sex = g === "M" || g === "F" ? g : "Unknown";
  }
  if (ctx.location?.trim()) {
    out.location_body = ctx.location.trim();
    out.geographic_region = ctx.location.trim();
  }
  if (ctx.tobaccoUse?.trim()) out.tobacco_use = ctx.tobaccoUse.trim();
  if (ctx.tobaccoUse?.trim()) out.history = ctx.tobaccoUse.trim();
  if (ctx.symptoms?.trim()) out.symptoms = ctx.symptoms.trim();
  if (ctx.clinicalHistory?.trim()) {
    out.clinical_history = ctx.clinicalHistory.trim();
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

