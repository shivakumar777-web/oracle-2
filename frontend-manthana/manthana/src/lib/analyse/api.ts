/* ═══ API Client — Gateway Integration ═══ */
import { GATEWAY_URL } from "./constants";
import { getGatewayAuthToken } from "./auth-token";
import type { AnalysisResponse, JobStatus, ServiceHealth, UnifiedAnalysisResult } from "./types";
import { AnalysisCancelledError } from "./errors";

const FRONTEND_TO_BACKEND_MODALITY: Record<string, string> = {
  xray: "xray",
  ct: "ct",
  ct_abdomen: "abdominal_ct",
  ct_chest: "chest_ct",
  ct_cardiac: "cardiac_ct",
  ct_spine: "spine_neuro",
  ct_brain: "ct_brain",
  /** Brain MRI — explicit product (preferred). */
  brain_mri: "brain_mri",
  /** Legacy alias; gateway routes to brain_mri (not spine/MSK). */
  mri: "mri",
  /** Spine / neuro MRI — same service as CT spine path; TotalSeg vertebrae_mr when MR. */
  spine_mri: "spine_mri",
  ultrasound: "ultrasound",
  ecg: "ecg",
  pathology: "pathology",
  mammography: "mammography",
  cytology: "cytology",
  oral_cancer: "oral_cancer",
  lab_report: "lab_report",
  dermatology: "dermatology",
  abdominal_ct: "abdominal_ct",
  chest_ct: "chest_ct",
  cardiac_ct: "cardiac_ct",
  spine_neuro: "spine_neuro",
  mr_spine: "spine_mri",
  brain_ct: "ct_brain",
  head_ct: "ct_brain",
  ncct_brain: "ct_brain",
};

function normalizeResult(data: unknown): AnalysisResponse {
  const r = data as AnalysisResponse;

  if (Array.isArray(r.findings)) {
    r.findings = r.findings.map((f) => ({
      ...f,
      confidence:
        typeof f.confidence === "number" && f.confidence > 1
          ? f.confidence / 100
          : f.confidence,
    }));
  }

  if (typeof r.confidence === "number" && r.confidence > 1) {
    r.confidence = r.confidence / 100;
  }

  if (typeof r.heatmap_url === "string" && r.heatmap_url.startsWith("/")) {
    r.heatmap_url = `${GATEWAY_URL}${r.heatmap_url}`;
  }

  if (Array.isArray(r.findings)) {
    r.findings = r.findings.map((f) => ({
      ...f,
      heatmap_url:
        typeof f.heatmap_url === "string" && f.heatmap_url.startsWith("/")
          ? `${GATEWAY_URL}${f.heatmap_url}`
          : f.heatmap_url,
    }));
  }

  return r;
}

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new AnalysisCancelledError());
    const id = setTimeout(resolve, ms);
    if (signal) {
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(id);
          reject(new AnalysisCancelledError());
        },
        { once: true }
      );
    }
  });
}

async function readGatewayError(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const data = (await res.json()) as { detail?: unknown };
      const d = data?.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) return d.map((x) => (typeof x === "object" && x && "msg" in x ? String((x as { msg: string }).msg) : String(x))).join("; ");
      if (d != null) return JSON.stringify(d);
    } catch {
      /* fall through */
    }
  }
  return res.text().catch(() => `HTTP ${res.status}`);
}

/** Analyse a medical image — main entry point (requires Bearer JWT: set via setGatewayAuthToken / login). */
export async function analyzeImage(
  file: File,
  modality: string = "auto",
  patientId?: string,
  clinicalNotes?: string,
  patientContext?: Record<string, unknown>,
  signal?: AbortSignal
): Promise<AnalysisResponse> {
  const form = new FormData();
  form.append("file", file);
  const backendModality = FRONTEND_TO_BACKEND_MODALITY[modality];
  if (!backendModality) {
    throw new Error(`Unsupported modality: ${modality}`);
  }
  form.append("modality", backendModality);
  if (patientId) form.append("patient_id", patientId);
  if (clinicalNotes) form.append("clinical_notes", clinicalNotes);
  if (patientContext && Object.keys(patientContext).length > 0) {
    form.append("patient_context_json", JSON.stringify(patientContext));
  }

  const token = getGatewayAuthToken();
  const res = await fetch(`${GATEWAY_URL}/analyze`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
    signal,
  });

  if (res.status === 401) {
    throw new Error("Authentication required. Please log in.");
  }
  if (!res.ok) {
    const err = await readGatewayError(res);
    throw new Error(`Analysis failed (${res.status}): ${err}`);
  }

  const data = await res.json();
  if (data?.status === "queued" && data?.job_id) {
    return pollJobUntilComplete(data.job_id, signal);
  }

  if (!data.status || data.status === "complete" || data.status === "triage") {
    return normalizeResult(data);
  }

  throw new Error(
    `Unexpected analysis status "${data.status}" for job ${data.job_id ?? "unknown"}`
  );
}

async function pollJobUntilComplete(
  jobId: string,
  signal?: AbortSignal
): Promise<AnalysisResponse> {
  const MAX_POLLS = 60;
  const POLL_INTERVAL_MS = 2000;

  for (let i = 0; i < MAX_POLLS; i++) {
    if (signal?.aborted) {
      throw new AnalysisCancelledError();
    }

    const status = await getJobStatus(jobId, signal);

    if (status.status === "queued" || status.status === "processing") {
      await sleep(POLL_INTERVAL_MS, signal);
      continue;
    }

    if (status.status === "complete") {
      if (!status.result) {
        throw new Error(`Job ${jobId} complete but result is missing.`);
      }
      return normalizeResult(status.result);
    }

    if (status.status === "failed") {
      throw new Error(status.error ?? `Job ${jobId} failed with no error detail.`);
    }

    throw new Error(`Job ${jobId} returned unexpected status: "${status.status}"`);
  }

  throw new Error(
    `Analysis timed out after ${(MAX_POLLS * POLL_INTERVAL_MS) / 1000}s.`
  );
}

/** Poll async job status */
export async function getJobStatus(
  jobId: string,
  signal?: AbortSignal
): Promise<JobStatus> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${GATEWAY_URL}/job/${jobId}/status`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal,
  });
  if (res.status === 401) {
    throw new Error("Authentication required. Please log in.");
  }
  if (!res.ok) throw new Error(`Job status failed: ${res.status}`);
  return res.json();
}

/** Get all service health statuses */
export async function getServicesHealth(): Promise<ServiceHealth[]> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health/services`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Get gateway health */
export async function getGatewayHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${GATEWAY_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Generate narrative report (proxies to report_assembly via gateway POST /report). */
export async function generateReport(
  analysisResult: AnalysisResponse,
  language: string = "en"
): Promise<{ report: string; pdf_url?: string; impression?: string; narrative?: string }> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${GATEWAY_URL}/report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ ...analysisResult, language }),
    signal: AbortSignal.timeout(120000),
  });
  if (res.status === 401) {
    throw new Error("Authentication required. Please log in.");
  }
  if (!res.ok) throw new Error(`Report generation failed: ${res.status}`);
  const data = (await res.json()) as {
    narrative?: string;
    impression?: string;
    pdf_url?: string;
  };
  return {
    report: data.narrative ?? "",
    pdf_url: data.pdf_url,
    narrative: data.narrative,
    impression: data.impression,
  };
}

/** Ask AI co-pilot a question about findings */
export async function askCoPilot(
  question: string,
  context: AnalysisResponse
): Promise<string> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${GATEWAY_URL}/copilot`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ question, context }),
    signal: AbortSignal.timeout(120000),
  });
  if (!res.ok) throw new Error(`Co-pilot failed: ${res.status}`);
  const data = await res.json();
  return data.answer ?? data.response;
}

/** Request unified cross-modality report from report_assembly via gateway POST /unified-report */
export async function requestUnifiedReport(
  individualResults: { modality: string; result: AnalysisResponse }[],
  patientId: string,
  language: string = "en"
): Promise<UnifiedAnalysisResult> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${GATEWAY_URL}/unified-report`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ results: individualResults, patient_id: patientId, language }),
    signal: AbortSignal.timeout(180000),
  });
  if (res.status === 401) {
    throw new Error("Authentication required. Please log in.");
  }
  if (!res.ok) {
    const err = await res.text().catch(() => "Unknown error");
    throw new Error(`Unified report failed (${res.status}): ${err}`);
  }
  return res.json();
}

/* ═══ PACS API ═══ */

import type { PacsStudy, WorklistItem, PacsConfig } from "./types";

const PACS_BASE = `${GATEWAY_URL}/pacs`;

/** Fetch studies from Orthanc PACS */
export async function fetchPacsStudies(filters?: {
  patient_name?: string;
  patient_id?: string;
  modality?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}): Promise<PacsStudy[]> {
  const token = getGatewayAuthToken();
  const params = new URLSearchParams();
  if (filters?.patient_name) params.set("patient_name", filters.patient_name);
  if (filters?.patient_id) params.set("patient_id", filters.patient_id);
  if (filters?.modality) params.set("modality", filters.modality);
  if (filters?.date_from) params.set("date_from", filters.date_from);
  if (filters?.date_to) params.set("date_to", filters.date_to);
  if (filters?.limit) params.set("limit", String(filters.limit));

  const url = `${PACS_BASE}/studies${params.toString() ? "?" + params : ""}`;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) return [];
  return res.json();
}

/** Fetch worklist items */
export async function fetchWorklist(): Promise<WorklistItem[]> {
  try {
    const token = getGatewayAuthToken();
    const res = await fetch(`${PACS_BASE}/worklist`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/** Create worklist item */
export async function createWorklistItem(item: Omit<WorklistItem, "id">): Promise<WorklistItem> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${PACS_BASE}/worklist`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(item),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error("Failed to create worklist item");
  return res.json();
}

/** Send a PACS study to AI analysis */
export async function sendStudyToAI(
  studyId: string,
  modalityOverride?: string
): Promise<{ status: string; job_id: string }> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${PACS_BASE}/send-to-ai`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ study_id: studyId, modality_override: modalityOverride }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error("Failed to send study to AI");
  return res.json();
}

/** Test PACS connectivity (C-ECHO) */
export async function echoPacs(modalityName: string): Promise<{ status: string }> {
  const token = getGatewayAuthToken();
  const res = await fetch(`${PACS_BASE}/modalities/${modalityName}/echo`, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    signal: AbortSignal.timeout(10000),
  });
  return res.json();
}

/** Get PACS config */
export async function getPacsConfig(): Promise<PacsConfig | null> {
  try {
    const token = getGatewayAuthToken();
    const res = await fetch(`${PACS_BASE}/config`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}
