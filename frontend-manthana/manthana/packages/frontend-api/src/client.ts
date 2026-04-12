import type {
  AnalysisResponse,
  JobStatus,
  ServiceHealth,
  UnifiedAnalysisResult,
  PacsStudy,
  WorklistItem,
  PacsConfig,
} from "./types";

export interface ApiClientConfig {
  baseUrl: string;
  /** Optional bearer token provider for direct gateway calls. */
  getAuthToken?: () => string | null;
}

export class AuthError extends Error {}
export class ServiceUnavailableError extends Error {}
export class TimeoutError extends Error {}

async function readGatewayError(res: Response): Promise<string> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    try {
      const data = (await res.json()) as { detail?: unknown };
      const d = data?.detail;
      if (typeof d === "string") return d;
      if (Array.isArray(d)) {
        return d
          .map((x) =>
            typeof x === "object" && x && "msg" in x
              ? String((x as { msg: string }).msg)
              : String(x)
          )
          .join("; ");
      }
      if (d != null) return JSON.stringify(d);
    } catch {
      // fall through
    }
  }
  try {
    return await res.text();
  } catch {
    return `HTTP ${res.status}`;
  }
}

export function createApiClient(config: ApiClientConfig) {
  const { baseUrl, getAuthToken } = config;

  function authHeaders(): Record<string, string> {
    const token = getAuthToken?.();
    if (token) {
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }

  return {
    async analyzeImage(
      file: File,
      modality: string,
      options?: {
        patientId?: string;
        clinicalNotes?: string;
        patientContext?: Record<string, unknown>;
        /** Gateway checks this for premium modalities (e.g. ct_brain_vista). */
        subscriptionTier?: string;
        signal?: AbortSignal;
        /** Chest X-ray: TXRV only, no Kimi narrative (MedGemma middle layer). */
        skipLlmNarrative?: boolean;
      }
    ): Promise<AnalysisResponse> {
      const form = new FormData();
      form.append("file", file);
      form.append("modality", modality);
      if (options?.patientId) form.append("patient_id", options.patientId);
      if (options?.clinicalNotes) form.append("clinical_notes", options.clinicalNotes);
      if (options?.patientContext && Object.keys(options.patientContext).length > 0) {
        form.append("patient_context_json", JSON.stringify(options.patientContext));
      }
      if (options?.skipLlmNarrative && modality === "xray") {
        form.append("skip_llm_narrative", "true");
      }

      const headers: Record<string, string> = { ...authHeaders() };
      if (modality === "ct_brain_vista" || modality === "premium_ct_unified") {
        headers["X-Subscription-Tier"] = (options?.subscriptionTier ?? "free").toLowerCase();
      }

      const res = await fetch(`${baseUrl}/analyze`, {
        method: "POST",
        headers,
        body: form,
        signal: options?.signal,
      });

      if (res.status === 401) {
        throw new AuthError("Authentication required. Please log in.");
      }
      if (!res.ok) {
        const err = await readGatewayError(res);
        throw new Error(`Analysis failed (${res.status}): ${err}`);
      }
      return res.json();
    },

    async getJobStatus(jobId: string, signal?: AbortSignal): Promise<JobStatus> {
      const res = await fetch(`${baseUrl}/job/${jobId}/status`, {
        headers: authHeaders(),
        signal,
      });
      if (res.status === 401) {
        throw new AuthError("Authentication required. Please log in.");
      }
      if (!res.ok) {
        throw new Error(`Job status failed: ${res.status}`);
      }
      return res.json();
    },

    async generateReport(
      analysisResult: AnalysisResponse,
      language: string = "en"
    ): Promise<{ report: string; pdf_url?: string; impression?: string; narrative?: string }> {
      const res = await fetch(`${baseUrl}/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ ...analysisResult, language }),
      });
      if (res.status === 401) {
        throw new AuthError("Authentication required. Please log in.");
      }
      if (!res.ok) {
        throw new Error(`Report generation failed: ${res.status}`);
      }
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
    },

    async askCoPilot(
      question: string,
      context: Record<string, unknown>
    ): Promise<string> {
      const res = await fetch(`${baseUrl}/copilot`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ question, context }),
      });

      if (res.status === 401) {
        throw new AuthError("Authentication required. Please log in.");
      }
      if (!res.ok) {
        const msg = await readGatewayError(res);
        throw new Error(`Co-Pilot service error (${res.status}): ${msg}`);
      }
      const data = (await res.json()) as { response?: string; answer?: string };
      return data.response ?? data.answer ?? "";
    },

    async requestUnifiedReport(
      individualResults: { modality: string; result: AnalysisResponse }[],
      patientId: string,
      language: string = "en"
    ): Promise<UnifiedAnalysisResult> {
      const res = await fetch(`${baseUrl}/unified-report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ results: individualResults, patient_id: patientId, language }),
      });
      if (res.status === 401) {
        throw new AuthError("Authentication required. Please log in.");
      }
      if (!res.ok) {
        const err = await res.text().catch(() => "Unknown error");
        throw new Error(`Unified report failed (${res.status}): ${err}`);
      }
      return res.json();
    },

    async getServicesHealth(): Promise<ServiceHealth[]> {
      try {
        const res = await fetch(`${baseUrl}/health/services`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },

    async getGatewayHealth(): Promise<boolean> {
      try {
        const res = await fetch(`${baseUrl}/health`, {
          signal: AbortSignal.timeout(3000),
        });
        return res.ok;
      } catch {
        return false;
      }
    },

    async fetchPacsStudies(filters?: {
      patient_name?: string;
      patient_id?: string;
      modality?: string;
      date_from?: string;
      date_to?: string;
      limit?: number;
    }): Promise<PacsStudy[]> {
      const params = new URLSearchParams();
      if (filters?.patient_name) params.set("patient_name", filters.patient_name);
      if (filters?.patient_id) params.set("patient_id", filters.patient_id);
      if (filters?.modality) params.set("modality", filters.modality);
      if (filters?.date_from) params.set("date_from", filters.date_from);
      if (filters?.date_to) params.set("date_to", filters.date_to);
      if (filters?.limit) params.set("limit", String(filters.limit));

      const url = `${baseUrl}/pacs/studies${params.toString() ? "?" + params : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) return [];
      return res.json();
    },

    async fetchWorklist(): Promise<WorklistItem[]> {
      try {
        const res = await fetch(`${baseUrl}/pacs/worklist`, {
          signal: AbortSignal.timeout(10000),
        });
        if (!res.ok) return [];
        return res.json();
      } catch {
        return [];
      }
    },

    async getPacsConfig(): Promise<PacsConfig | null> {
      try {
        const res = await fetch(`${baseUrl}/pacs/config`, {
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        return res.json();
      } catch {
        return null;
      }
    },
  };
}
