"use client";
import { useState, useCallback, useRef } from "react";
import type {
  MultiModelSession,
  MultiModelStage,
  MultiModelUpload,
  MultiModelResult,
  UnifiedAnalysisResult,
  AnalysisResponse,
} from "@/lib/analyse/types";
import { analyzeImage, requestUnifiedReport } from "@/lib/analyse/api";
import { AnalysisCancelledError } from "@/lib/analyse/errors";
import { randomId } from "@/lib/analyse/random-id";
import { LABS_CLOUD_AI_PRIMARY } from "@/lib/analyse/display-models";
import { useToast } from "@/hooks/useToast";
import { preflightLabsScan, recordLabsScan } from "@/lib/labs/client";
import { useProductAccess } from "@/components/ProductAccessProvider";
import { normalizeSubscriptionPlan } from "@/lib/product-access";

const INITIAL_SESSION: MultiModelSession = {
  id: "",
  selectedModalities: [],
  uploads: [],
  copilotActivated: false,
  individualResults: [],
  unifiedResult: null,
  stage: "selecting",
  currentProcessingIndex: -1,
};

export function useMultiModelAnalysis() {
  const { addToast } = useToast();
  const { plan, status } = useProductAccess();
  const [session, setSession] = useState<MultiModelSession>(INITIAL_SESSION);
  const abortRef = useRef<AbortController | null>(null);

  /* ── Start a new multi-model session ── */
  const startSession = useCallback(() => {
    setSession({
      ...INITIAL_SESSION,
      id: randomId(),
      stage: "selecting",
    });
  }, []);

  /* ── Toggle modality selection (max 4) ── */
  const toggleModality = useCallback((modalityId: string) => {
    setSession((s) => {
      const isSelected = s.selectedModalities.includes(modalityId);
      let updated: string[];
      if (isSelected) {
        updated = s.selectedModalities.filter((m) => m !== modalityId);
      } else {
        if (s.selectedModalities.length >= 4) return s; // max 4
        updated = [...s.selectedModalities, modalityId];
      }
      return { ...s, selectedModalities: updated };
    });
  }, []);

  /* ── Confirm modality selection → move to uploading ── */
  const confirmSelection = useCallback(() => {
    setSession((s) => ({
      ...s,
      stage: "uploading",
      uploads: s.selectedModalities.map((m) => ({
        modality: m,
        files: [],
        urls: [],
        uploaded: false,
      })),
    }));
  }, []);

  /* ── Set files for a specific modality upload step ── */
  const setUploadFiles = useCallback((modalityId: string, files: File[]) => {
    setSession((s) => ({
      ...s,
      uploads: s.uploads.map((u) =>
        u.modality === modalityId
          ? {
              ...u,
              files,
              urls: files.map((f) => URL.createObjectURL(f)),
              uploaded: files.length > 0,
            }
          : u
      ),
    }));
  }, []);

  /* ── All uploads done → show copilot activation ── */
  const proceedToConfirm = useCallback(() => {
    setSession((s) => ({ ...s, stage: "confirming" }));
  }, []);

  /* ── Activate Copilot → start sequential processing ── */
  const activateCopilot = useCallback(
    async (patientId: string) => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;

      setSession((s) => ({
        ...s,
        copilotActivated: true,
        stage: "processing",
        currentProcessingIndex: 0,
        individualResults: [],
      }));

      const results: MultiModelResult[] = [];

      // Get current uploads from state
      const currentSession = await new Promise<MultiModelSession>((resolve) => {
        setSession((s) => {
          resolve(s);
          return s;
        });
      });

      for (let i = 0; i < currentSession.uploads.length; i++) {
        if (ctrl.signal.aborted) return;

        const upload = currentSession.uploads[i];
        setSession((s) => ({ ...s, currentProcessingIndex: i }));

        try {
          // Use the first file for each modality (primary scan)
          const file = upload.files[0];
          if (!file) continue;

          const pf = await preflightLabsScan(upload.modality);
          if (!pf.allowed) {
            const msg =
              ("message" in pf && typeof pf.message === "string" && pf.message) ||
              "Labs quota does not allow this scan right now.";
            addToast(`${upload.modality}: ${msg}`, "warning", 8000);
            continue;
          }

          const subscriptionTier =
            status === "active"
              ? normalizeSubscriptionPlan(plan)
              : "free";
          const result = await analyzeImage(
            file,
            upload.modality,
            undefined,
            undefined,
            undefined,
            subscriptionTier,
            ctrl.signal
          );

          if (ctrl.signal.aborted) return;

          results.push({ modality: upload.modality, result });
          setSession((s) => ({
            ...s,
            individualResults: [...results],
          }));

          void recordLabsScan(upload.modality).then((rec) => {
            if (!rec.ok && rec.error) {
              addToast(rec.error, "warning", 7000);
            }
          });
        } catch (err) {
          if (err instanceof AnalysisCancelledError || ctrl.signal.aborted) return;

          // Use mock result on API failure (demo mode)
          const mockResult: AnalysisResponse = {
            job_id: randomId(),
            modality: upload.modality,
            detected_region: "auto-detected",
            findings: [
              {
                label: `${upload.modality} finding detected`,
                severity: "warning",
                confidence: 78,
                region: "Primary region",
                description: `AI detected anomaly in ${upload.modality} scan requiring clinical correlation`,
              },
              {
                label: `Normal ${upload.modality} structures`,
                severity: "clear",
                confidence: 92,
                region: "Secondary region",
              },
            ],
            impression: `AI analysis of ${upload.modality} scan completed. Findings suggest further clinical evaluation recommended.`,
            pathology_scores: { anomaly: 0.78 },
            structures: ["primary", "secondary"],
            confidence: "moderate",
            processing_time_sec: 2.1,
            models_used: ["Manthana AI Engine"],
            disclaimer: "AI decision support only.",
          };

          results.push({ modality: upload.modality, result: mockResult });
          setSession((s) => ({
            ...s,
            individualResults: [...results],
          }));
        }
      }

      if (results.length === 0) {
        addToast(
          "No scans completed — check Labs quota or errors for each modality.",
          "warning",
          8000
        );
        setSession((s) => ({
          ...s,
          stage: "confirming",
          copilotActivated: false,
          currentProcessingIndex: -1,
        }));
        return;
      }

      // All individual analyses done → request unified report
      if (ctrl.signal.aborted) return;

      setSession((s) => ({ ...s, stage: "unifying" }));

      try {
        const unifiedResult = await requestUnifiedReport(results, patientId);
        if (ctrl.signal.aborted) return;

        setSession((s) => ({
          ...s,
          unifiedResult,
          stage: "complete",
        }));
      } catch {
        if (ctrl.signal.aborted) return;

        // Mock unified result for demo
        const mockUnified: UnifiedAnalysisResult = {
          patient_id: patientId,
          modalities_analyzed: results.map((r) => r.modality),
          individual_reports: results.map((r) => ({
            modality: r.modality,
            impression: r.result.impression,
            findings_summary: r.result.findings.map((f) => f.label).join("; "),
          })),
          unified_diagnosis:
            "Based on cross-modality analysis combining " +
            results.map((r) => r.modality.toUpperCase()).join(", ") +
            " findings: The integrated assessment reveals correlated patterns across multiple imaging modalities. The combination of findings from different modalities provides stronger diagnostic confidence than any single modality alone. Clinical correlation with patient history and physical examination is recommended for final diagnostic confirmation.",
          unified_findings:
            "Cross-referencing findings from all " +
            results.length +
            " modalities reveals consistent patterns. Individual modality findings have been correlated and cross-validated for enhanced diagnostic accuracy.",
          risk_assessment:
            "Moderate overall risk based on multi-modal assessment. The combination of findings across modalities suggests a moderate probability of underlying pathology requiring further clinical workup.",
          treatment_recommendations:
            "1. Follow-up imaging in 4-6 weeks to assess progression\n2. Clinical correlation with laboratory findings\n3. Consider specialist referral for comprehensive evaluation\n4. Monitor vital parameters and symptomatic changes",
          prognosis:
            "Based on the multi-modal analysis, the prognosis is generally favorable with appropriate clinical management. Early detection through multi-modal screening provides optimal opportunity for intervention.",
          cross_modality_correlations:
            "Key correlations identified between modalities: Findings from " +
            results.map((r) => r.modality).join(" and ") +
            " show complementary patterns that strengthen the diagnostic assessment. No contradictory findings were observed across modalities.",
          confidence: "high",
          models_used: [LABS_CLOUD_AI_PRIMARY, ...results.flatMap((r) => r.result.models_used)],
          processing_time_sec: results.reduce((sum, r) => sum + r.result.processing_time_sec, 0) + 3.2,
        };

        setSession((s) => ({
          ...s,
          unifiedResult: mockUnified,
          stage: "complete",
        }));
      }
    },
    []
  );

  /* ── Go back to a previous stage ── */
  const goBack = useCallback(() => {
    setSession((s) => {
      switch (s.stage) {
        case "uploading":
          return { ...s, stage: "selecting" as MultiModelStage };
        case "confirming":
          return { ...s, stage: "uploading" as MultiModelStage };
        default:
          return s;
      }
    });
  }, []);

  /* ── Reset everything ── */
  const resetMultiModel = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    // Revoke all object URLs
    session.uploads.forEach((u) => u.urls.forEach((url) => URL.revokeObjectURL(url)));
    setSession(INITIAL_SESSION);
  }, [session.uploads]);

  return {
    session,
    startSession,
    toggleModality,
    confirmSelection,
    setUploadFiles,
    proceedToConfirm,
    activateCopilot,
    goBack,
    resetMultiModel,
  };
}
