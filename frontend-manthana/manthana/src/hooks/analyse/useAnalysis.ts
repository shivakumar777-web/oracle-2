"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import type { AnalysisResponse, ScanStage, ImageScan } from "@/lib/analyse/types";
import { analyzeImage } from "@/lib/analyse/api";
import { randomId } from "@/lib/analyse/random-id";
import { AnalysisCancelledError } from "@/lib/analyse/errors";

interface MultiScanState {
  images: ImageScan[];
  activeIndex: number;
  modality: string;
  zoom: number;
}

const INITIAL: MultiScanState = {
  images: [],
  activeIndex: 0,
  modality: "auto",
  zoom: 1,
};

export function useAnalysis() {
  const [state, setState] = useState<MultiScanState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const queueRef = useRef<boolean>(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const stateRef = useRef<MultiScanState>(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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
      modality: string = "auto",
      clinicalNotes?: string,
      patientContext?: Record<string, unknown>,
      /** When set, sent to the gateway as `modality` (e.g. chest_ct) while UI keeps `modality` (e.g. ct). */
      analyzeModalityForApi?: string
    ) => {
      const newImages: ImageScan[] = files.map((file) => ({
        id: randomId(),
        file,
        url: URL.createObjectURL(file),
        stage: "idle" as ScanStage,
        detectedModality: null,
        result: null,
        clinicalNotes,
        patientContext,
        analyzeModalityForApi,
      }));

      setState((s) => {
        const updated = {
          ...s,
          images: [...s.images, ...newImages],
          activeIndex: s.images.length, // focus first new image
          modality,
        };
        return updated;
      });

      // Start batch scan after state updates
      setTimeout(
        () =>
          startBatchScan(
            newImages,
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
      modality: string = "auto",
      clinicalNotes?: string,
      patientContext?: Record<string, unknown>,
      analyzeModalityForApi?: string
    ) => {
      addFiles([file], modality, clinicalNotes, patientContext, analyzeModalityForApi);
    },
    [addFiles]
  );

  /* ── Batch scan — analyze images sequentially ── */
  const startBatchScan = async (
    images: ImageScan[],
    modality: string,
    clinicalNotes?: string,
    patientContext?: Record<string, unknown>,
    analyzeModalityForApi?: string
  ) => {
    if (queueRef.current) return; // already scanning
    queueRef.current = true;

    for (const img of images) {
      await scanSingleImage(
        img.id,
        img.file,
        modality,
        clinicalNotes,
        patientContext,
        analyzeModalityForApi
      );
    }

    queueRef.current = false;
  };

  /* ── Scan one image through the 7-stage cinematic sequence ── */
  const scanSingleImage = async (
    imageId: string,
    file: File,
    modality: string,
    clinicalNotes?: string,
    patientContext?: Record<string, unknown>,
    analyzeModalityForApi?: string
  ) => {
    const apiModality = analyzeModalityForApi ?? modality;
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

    // Actually call the API
    try {
      const initial = await analyzeImage(
        file,
        apiModality,
        undefined,
        clinicalNotes,
        patientContext,
        ctrl.signal
      );
      if (ctrl.signal.aborted) return;

      const result: AnalysisResponse = initial;

      updateImage({ stage: "heatmap", detectedModality: result.modality });
      await delay(600);
      if (ctrl.signal.aborted) return;

      updateImage({ stage: "extracting" });
      await delay(400);
      if (ctrl.signal.aborted) return;

      updateImage({ stage: "complete", result, detectedModality: result.modality });
    } catch (error) {
      if (error instanceof AnalysisCancelledError || ctrl.signal.aborted) return;
      updateImage({
        stage: "error",
        error: error instanceof Error ? error.message : "Analysis failed. Please try again.",
      });
    }
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
              }
            : i
        ),
      }));

      setTimeout(() => {
        scanSingleImage(
          imageId,
          img.file,
          current.modality,
          img.clinicalNotes,
          img.patientContext,
          img.analyzeModalityForApi
        );
      }, 100);
    },
    [scanSingleImage]
  );

  const setModality = useCallback((m: string) => {
    setState((s) => ({ ...s, modality: m }));
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
    if (stage !== "analyzing") {
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
