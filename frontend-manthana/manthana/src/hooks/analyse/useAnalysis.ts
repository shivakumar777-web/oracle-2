"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResponse, ScanStage, ImageScan } from "@/lib/analyse/types";
import {
  analyzeImage,
  cxrMedgemmaSessionComplete,
  cxrMedgemmaSessionStart,
} from "@/lib/analyse/api";
import { mergeTxrvWithMedgemmaNarrative } from "@/lib/analyse/medgemma-merge";
import { useProductAccess } from "@/components/ProductAccessProvider";
import { normalizeSubscriptionPlan } from "@/lib/product-access";
import { randomId } from "@/lib/analyse/random-id";
import { AnalysisCancelledError } from "@/lib/analyse/errors";
import { useToast } from "@/hooks/useToast";
import { preflightLabsScan, recordLabsScan } from "@/lib/labs/client";
import { AI_ORCHESTRATION_ENABLED } from "@/lib/analyse/constants";

interface MultiScanState {
  images: ImageScan[];
  activeIndex: number;
  modality: string;
  zoom: number;
  /** When true, next X-ray uploads use TXRV-only + MedGemma Q&A + Kimi final report. */
  medgemmaChestEnabled: boolean;
}

const INITIAL: MultiScanState = {
  images: [],
  activeIndex: 0,
  /** With 95-modality orchestration, default to auto-detect; legacy path stays chest X-ray. */
  modality: AI_ORCHESTRATION_ENABLED ? "auto" : "xray",
  zoom: 1,
  medgemmaChestEnabled: false,
};

export function useAnalysis() {
  const { addToast } = useToast();
  const { plan, status } = useProductAccess();
  const [state, setState] = useState<MultiScanState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const stateRef = useRef<MultiScanState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  type RunScanFn = (
    scanImg: ImageScan,
    modality: string,
    clinicalNotes?: string,
    patientContext?: Record<string, unknown>,
    analyzeModalityForApi?: string
  ) => Promise<void>;

  const runScanRef = useRef<RunScanFn>(async () => {
    throw new Error("runScan not initialized");
  });

  const startBatchInnerRef = useRef<
    (
      images: ImageScan[],
      modality: string,
      clinicalNotes?: string,
      patientContext?: Record<string, unknown>,
      analyzeModalityForApi?: string
    ) => Promise<void>
  >(async () => {});

  /* ── Derived state from active image ── */
  const active = state.images[state.activeIndex] ?? null;
  const stage: ScanStage = active?.stage ?? "idle";
  const imageUrl = active?.url ?? null;
  const result = active?.result ?? null;
  const detectedModality = active?.detectedModality ?? null;

  /* ── Add files (multi-select or camera) ── */
  const addFiles = useCallback(
    (
      files: File[],
      modality: string = "xray",
      clinicalNotes?: string,
      patientContext?: Record<string, unknown>,
      /** When set, sent to the gateway as `modality` (e.g. chest_ct) while UI keeps `modality` (e.g. ct). */
      analyzeModalityForApi?: string
    ) => {
      let created: ImageScan[] = [];
      setState((s) => {
        const useMedgemmaChest = modality === "xray" && s.medgemmaChestEnabled;
        created = files.map((file) => ({
          id: randomId(),
          file,
          url: URL.createObjectURL(file),
          stage: "idle" as ScanStage,
          detectedModality: null,
          result: null,
          clinicalNotes,
          patientContext,
          analyzeModalityForApi,
          useMedgemmaChest,
        }));
        return {
          ...s,
          images: [...s.images, ...created],
          activeIndex: s.images.length,
          modality,
        };
      });

      setTimeout(
        () =>
          void startBatchInnerRef.current(
            created,
            modality,
            clinicalNotes,
            patientContext,
            analyzeModalityForApi
          ),
        100
      );
    },
    []
  );

  /* ── Single file shortcut (backwards compat) ── */
  const analyze = useCallback(
    (
      file: File,
      modality: string = "xray",
      clinicalNotes?: string,
      patientContext?: Record<string, unknown>,
      analyzeModalityForApi?: string
    ) => {
      addFiles([file], modality, clinicalNotes, patientContext, analyzeModalityForApi);
    },
    [addFiles]
  );

  /* ── Scan one image through the 7-stage cinematic sequence ── */
  const scanSingleImage = async (
    scanImg: ImageScan,
    modality: string,
    clinicalNotes?: string,
    patientContext?: Record<string, unknown>,
    analyzeModalityForApi?: string
  ) => {
    const imageId = scanImg.id;
    const file = scanImg.file;
    const apiModality = analyzeModalityForApi ?? modality;
    const subscriptionTier =
      status === "active"
        ? normalizeSubscriptionPlan(plan)
        : "free";
    if (!apiModality || apiModality === "auto") {
      // Frontend-only "auto" state must not be sent to the backend.
      throw new Error("Please select a specific modality before scanning.");
    }
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    const updateImage = (patch: Partial<ImageScan>) => {
      setState((s) => ({
        ...s,
        images: s.images.map((img) =>
          img.id === imageId ? { ...img, ...patch } : img
        ),
      }));
    };

    // Focus this image
    setState((s) => ({
      ...s,
      activeIndex: s.images.findIndex((img) => img.id === imageId),
    }));

    // Stage 1: RECEIVED
    updateImage({ stage: "received" });
    await delay(500);
    if (ctrl.signal.aborted) return;

    // Stage 2: DETECTING
    updateImage({ stage: "detecting" });
    await delay(600);
    if (ctrl.signal.aborted) return;
    updateImage({ detectedModality: modality === "auto" ? "xray" : modality });

    // Stage 3: ROUTING
    updateImage({ stage: "routing" });
    await delay(400);
    if (ctrl.signal.aborted) return;

    // Stage 4: ANALYZING
    updateImage({ stage: "analyzing" });

    const pf = await preflightLabsScan(apiModality);
    if (!pf.allowed) {
      const msg =
        ("message" in pf && typeof pf.message === "string" && pf.message) ||
        "Labs quota does not allow this scan right now.";
      addToast(msg, "warning", 8000);
      updateImage({
        stage: "error",
        error: msg,
      });
      return;
    }

    // Actually call the API
    try {
      const skipLlm = Boolean(scanImg.useMedgemmaChest && apiModality === "xray");
      const initial = await analyzeImage(
        file,
        apiModality,
        undefined,
        clinicalNotes,
        patientContext,
        subscriptionTier,
        ctrl.signal,
        skipLlm ? { skipLlmNarrative: true } : undefined
      );
      if (ctrl.signal.aborted) return;

      const txrvResult: AnalysisResponse = initial;
      const scores = txrvResult.pathology_scores || {};
      const hasTxrv = Object.keys(scores).length > 0;

      if (skipLlm && hasTxrv) {
        try {
          const start = await cxrMedgemmaSessionStart(
            file,
            scores as Record<string, unknown>,
            patientContext,
            ctrl.signal
          );
          if (ctrl.signal.aborted) return;

          updateImage({
            stage: "medgemma_questions",
            result: txrvResult,
            detectedModality: txrvResult.modality,
            medgemmaSessionId: start.session_id,
            medgemmaQuestions: (start.follow_up_questions || []) as NonNullable<
              ImageScan["medgemmaQuestions"]
            >,
            medgemmaDraft: {
              impression_draft: start.impression_draft,
              key_observations: start.key_observations,
              uncertainties: start.uncertainties,
              safety_flags: start.safety_flags,
            },
          });

          void recordLabsScan(apiModality).then((rec) => {
            if (!rec.ok && rec.error) {
              addToast(rec.error, "warning", 7000);
            }
          });
          return;
        } catch (mgErr) {
          addToast(
            mgErr instanceof Error
              ? mgErr.message
              : "MedGemma session could not start. Showing TXRV-only results.",
            "warning",
            9000
          );
        }
      } else if (skipLlm && !hasTxrv) {
        addToast(
          "MedGemma chest flow needs TorchXRay-style scores on this image. Finishing without Q&A.",
          "info",
          8000
        );
      }

      updateImage({ stage: "heatmap", detectedModality: txrvResult.modality });
      await delay(600);
      if (ctrl.signal.aborted) return;

      updateImage({ stage: "extracting" });
      await delay(400);
      if (ctrl.signal.aborted) return;

      updateImage({ stage: "complete", result: txrvResult, detectedModality: txrvResult.modality });

      void recordLabsScan(apiModality).then((rec) => {
        if (!rec.ok && rec.error) {
          addToast(rec.error, "warning", 7000);
        }
      });
    } catch (error) {
      if (error instanceof AnalysisCancelledError || ctrl.signal.aborted) return;
      updateImage({
        stage: "error",
        error: error instanceof Error ? error.message : "Analysis failed. Please try again.",
      });
    }
  };

  runScanRef.current = scanSingleImage;
  startBatchInnerRef.current = async (
    images: ImageScan[],
    modality: string,
    clinicalNotes?: string,
    patientContext?: Record<string, unknown>,
    analyzeModalityForApi?: string
  ) => {
    if (queueRef.current) return;
    queueRef.current = true;
    for (const img of images) {
      await runScanRef.current(
        img,
        modality,
        clinicalNotes,
        patientContext,
        analyzeModalityForApi
      );
    }
    queueRef.current = false;
  };

  /* ── Select image by index ── */
  const setActiveIndex = useCallback((i: number) => {
    setState((s) => ({ ...s, activeIndex: Math.max(0, Math.min(i, s.images.length - 1)) }));
  }, []);

  /* ── Remove a single image ── */
  const removeImage = useCallback((index: number) => {
    setState((s) => {
      const img = s.images[index];
      if (img) URL.revokeObjectURL(img.url);
      const newImages = s.images.filter((_, i) => i !== index);
      return {
        ...s,
        images: newImages,
        activeIndex: Math.min(s.activeIndex, Math.max(0, newImages.length - 1)),
      };
    });
  }, []);

  const retryImage = useCallback(
    (imageId: string) => {
      const current = stateRef.current;
      const img = current.images.find((i) => i.id === imageId);
      if (!img) return;

      // Reset error/stage/result while preserving retry metadata
      setState((s) => ({
        ...s,
        images: s.images.map((i) =>
          i.id === imageId
            ? {
                ...i,
                stage: "idle" as ScanStage,
                error: undefined,
                result: null,
                detectedModality: null,
                medgemmaSessionId: undefined,
                medgemmaQuestions: undefined,
                medgemmaDraft: undefined,
              }
            : i
        ),
      }));

      setTimeout(() => {
        void runScanRef.current(
          img,
          current.modality,
          img.clinicalNotes,
          img.patientContext,
          img.analyzeModalityForApi
        );
      }, 100);
    },
    []
  );

  const submitMedgemmaAnswers = useCallback(
    async (imageId: string, answers: Record<string, string>, skipAll: boolean) => {
      const snap = stateRef.current;
      const img = snap.images.find((i) => i.id === imageId);
      if (!img?.medgemmaSessionId || !img.result) {
        addToast("Session expired or missing — please scan again.", "warning");
        return;
      }

      const ctrl = new AbortController();
      abortRef.current = ctrl;

      const patch = (p: Partial<ImageScan>) => {
        setState((s) => ({
          ...s,
          images: s.images.map((x) => (x.id === imageId ? { ...x, ...p } : x)),
        }));
      };

      patch({ stage: "medgemma_finalizing" });

      try {
        const done = await cxrMedgemmaSessionComplete(
          img.medgemmaSessionId,
          answers,
          skipAll,
          ctrl.signal
        );
        if (ctrl.signal.aborted) return;

        const merged = mergeTxrvWithMedgemmaNarrative(
          img.result,
          done.narrative_report,
          (done.models_used || []).filter(Boolean) as string[]
        );

        patch({
          stage: "complete",
          result: merged,
          detectedModality: merged.modality,
          medgemmaSessionId: undefined,
          medgemmaQuestions: undefined,
          medgemmaDraft: undefined,
        });
      } catch (e) {
        if (ctrl.signal.aborted) return;
        patch({
          stage: "error",
          error:
            e instanceof Error ? e.message : "Final report generation failed. Try again or use Retry.",
        });
      }
    },
    [addToast]
  );

  const setMedgemmaChestEnabled = useCallback((enabled: boolean) => {
    setState((s) => ({ ...s, medgemmaChestEnabled: enabled }));
  }, []);

  const setModality = useCallback((m: string) => {
    setState((s) => ({
      ...s,
      modality: m,
      medgemmaChestEnabled: m === "xray" ? s.medgemmaChestEnabled : false,
    }));
  }, []);

  const setZoom = useCallback((z: number) => {
    setState((s) => ({ ...s, zoom: z }));
  }, []);

  const reset = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    state.images.forEach((img) => URL.revokeObjectURL(img.url));
    setState(INITIAL);
    queueRef.current = false;
  }, [state.images]);

  // Elapsed-time ticker for analyzing stage (for UX on long-running modalities)
  useEffect(() => {
    if (stage !== "analyzing" && stage !== "medgemma_finalizing") {
      setElapsedMs(0);
      return;
    }
    const start = Date.now();
    setElapsedMs(0);
    const id = setInterval(() => {
      setElapsedMs(Date.now() - start);
    }, 1000);
    return () => clearInterval(id);
  }, [stage]);

  return {
    // Active image state (for backward compat)
    stage,
    imageUrl,
    result,
    detectedModality,
    zoom: state.zoom,
    modality: state.modality,
    medgemmaChestEnabled: state.medgemmaChestEnabled,
    setMedgemmaChestEnabled,
    submitMedgemmaAnswers,
    analysisElapsedMs: elapsedMs,
    // Multi-image
    images: state.images,
    activeIndex: state.activeIndex,
    setActiveIndex,
    removeImage,
    retryImage,
    // Actions
    analyze,
    addFiles,
    setModality,
    setZoom,
    reset,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
