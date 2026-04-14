"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/analyse/layout/TopBar";
import ModalityBar from "@/components/analyse/layout/ModalityBar";
import SelectedModalityStrip from "@/components/analyse/layout/SelectedModalityStrip";
import DisclaimerBar from "@/components/analyse/layout/DisclaimerBar";
import CommandPalette from "@/components/analyse/layout/CommandPalette";
import ScanViewport from "@/components/analyse/scanner/ScanViewport";
import CtUploadWizard from "@/components/analyse/scanner/CtUploadWizard";
import ViewportControls from "@/components/analyse/scanner/ViewportControls";
import ThumbnailStrip from "@/components/analyse/scanner/ThumbnailStrip";
import IntelligencePanel from "@/components/analyse/findings/IntelligencePanel";
import AIReportPanel from "@/components/analyse/findings/AIReportPanel";
import OrchestrationProgress from "@/components/analyse/findings/OrchestrationProgress";
import UnifiedReportPanel from "@/components/analyse/findings/UnifiedReportPanel";
import InterrogatorQA from "@/components/analyse/qa/InterrogatorQA";
import PatientContextForm, {
  type PatientContext,
} from "@/components/analyse/shared/PatientContextForm";
import ECGPatientContextForm from "@/components/analyse/ecg/ECGPatientContextForm";
import { ConsentGate } from "@/components/analyse/shared/ConsentGate";
import MultiModelSelector from "@/components/analyse/scanner/MultiModelSelector";
import MultiModelUploadWizard from "@/components/analyse/scanner/MultiModelUploadWizard";
import MultiModelProgress from "@/components/analyse/scanner/MultiModelProgress";
import PremiumCTRegionSelector from "@/components/analyse/PremiumCTRegionSelector";
import PremiumCTProgressPanel from "@/components/analyse/PremiumCTProgressPanel";
import CopilotActivation from "@/components/analyse/scanner/CopilotActivation";
import BottomSheet from "@/components/analyse/shared/BottomSheet";
import { useAnalysis } from "@/hooks/analyse/useAnalysis";
import { useAIOrchestration } from "@/hooks/analyse/useAIOrchestration";
import {
  fileToDataUrl,
  useReportEngineLaunch,
} from "@/hooks/analyse/useReportEngineLaunch";
import {
  interpretationReportToEnginePayload,
} from "@/lib/analyse/report-engine-mapper";
import { useGatewayAuthBridge } from "@/hooks/analyse/useGatewayAuthBridge";
import { useMultiModelAnalysis } from "@/hooks/analyse/useMultiModelAnalysis";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import { useToast } from "@/hooks/useToast";
import { useAIValidation } from "@/hooks/analyse/useAIValidation";
import { saveEntry, patchEntry } from "@/lib/analyse/history";
import type { HistoryEntry } from "@/lib/analyse/history";
import type {
  AnalysisMode,
  HeatmapState,
  DicomMetadataType,
  Finding,
  ScanStage,
} from "@/lib/analyse/types";
import {
  buildClinicalNotesForApi,
  buildPatientContextJsonForApi,
} from "@/lib/analyse/clinical-notes";
import { AI_ORCHESTRATION_ENABLED, getUploadAcceptTypes, MODALITIES } from "@/lib/analyse/constants";
import { formatModalityPeek } from "@/lib/analyse/modality-display";
import { normalizeSubscriptionPlan } from "@/lib/product-access";
import { preflightLabsScan, recordLabsScan } from "@/lib/labs/client";
import {
  buildCtPatientContextJson,
  gatewayModalityForCtRegion,
  type CtWizardState,
  isCtProductModality,
  ctBodyRegionForProductModality,
} from "@/lib/analyse/ct-upload-wizard";
import { randomId } from "@/lib/analyse/random-id";
import {
  buildEcgApiPatientContextJson,
  createInitialEcgScannerContext,
  ecgFormHasRequiredDemographics,
  type EcgScannerContext,
} from "@/lib/analyse/ecgPatientContext";
import type { PremiumCtRegion } from "@/lib/analyse/premium-constants";
import dynamic from "next/dynamic";
import { useProductAccess } from "@/components/ProductAccessProvider";

const FINDINGS_PANEL_WIDTH_KEY = "manthana-labs-findings-panel-width";
const FINDINGS_SPLIT_HANDLE_PX = 6;
const MIN_FINDINGS_PANEL_W = 280;
const MIN_VIEWPORT_W = 280;

function clampFindingsPanelWidth(w: number, mainWidth: number): number {
  const max = Math.max(
    MIN_FINDINGS_PANEL_W,
    Math.min(
      Math.floor(mainWidth * 0.58),
      mainWidth - MIN_VIEWPORT_W - FINDINGS_SPLIT_HANDLE_PX
    )
  );
  return Math.max(MIN_FINDINGS_PANEL_W, Math.min(max, w));
}

const isCtUiModality = (m: string) => m === "ct" || isCtProductModality(m);

/** Pure OpenRouter orchestration for 95 modalities + auto-detect (not Premium 3D / legacy CT wizard). */
function shouldUseOrchestration(
  modalityId: string,
  ctWizardConfig: CtWizardState | null
): boolean {
  if (!AI_ORCHESTRATION_ENABLED) return false;
  if (modalityId === "premium_ct_unified" || modalityId === "ct_brain_vista") return false;
  if (modalityId === "ct" && ctWizardConfig) return false;
  if (modalityId === "auto") return true;
  const entry = MODALITIES.find((m) => m.id === modalityId);
  return Boolean(entry?.orchestrationOnly);
}

const PacsBrowser = dynamic(() => import("@/components/analyse/pacs/PacsBrowser"), { ssr: false });
const WorklistPanel = dynamic(() => import("@/components/analyse/pacs/WorklistPanel"), { ssr: false });
const PacsSettings = dynamic(() => import("@/components/analyse/pacs/PacsSettings"), { ssr: false });

export default function ScannerPage() {
  useGatewayAuthBridge();
  const router = useRouter();
  const { addToast } = useToast();
  const {
    stage,
    imageUrl,
    modality,
    detectedModality,
    result,
    zoom,
    images,
    activeIndex,
    setActiveIndex,
    removeImage,
    addFiles,
    analyze,
    setModality,
    setZoom,
    reset,
    analysisElapsedMs,
    retryImage,
    medgemmaChestEnabled,
    setMedgemmaChestEnabled,
    submitMedgemmaAnswers,
  } = useAnalysis();

  const { plan, status: productStatus } = useProductAccess();
  const subscriptionTier = normalizeSubscriptionPlan(plan);
  const webSearchEnabled =
    AI_ORCHESTRATION_ENABLED &&
    productStatus === "active" &&
    subscriptionTier !== "free";
  const orch = useAIOrchestration(subscriptionTier);
  const [orchestrationActive, setOrchestrationActive] = useState(false);
  const [orchestrationPreviewUrl, setOrchestrationPreviewUrl] = useState<string | null>(null);
  const orchPreviewRevokeRef = useRef<string | null>(null);
  const orchestrationSourceFileRef = useRef<File | null>(null);

  const revokeOrchestrationPreview = useCallback(() => {
    if (orchPreviewRevokeRef.current) {
      URL.revokeObjectURL(orchPreviewRevokeRef.current);
      orchPreviewRevokeRef.current = null;
    }
    setOrchestrationPreviewUrl(null);
  }, []);

  const {
    state: aiValidationState,
    startValidation,
    submitAnswer,
    askFollowUpQuestion,
    confirmAndProceed,
    forceProceedAnyway,
    resetValidation,
    cancelValidation,
  } = useAIValidation();

  const [pendingFiles, setPendingFiles] = useState<{
    files: File[];
    modality: string;
    clinicalNotes?: string;
    patientContext?: Record<string, unknown>;
    analyzeModalityForApi?: string;
  } | null>(null);

  const {
    session: multiSession,
    startSession,
    toggleModality,
    confirmSelection,
    setUploadFiles,
    proceedToConfirm,
    activateCopilot,
    goBack,
    resetMultiModel,
  } = useMultiModelAnalysis();

  const addMoreRef = useRef<HTMLInputElement>(null);
  const addCameraRef = useRef<HTMLInputElement>(null);

  const [cmdOpen, setCmdOpen] = useState(false);
  const [scanNumber, setScanNumber] = useState(1);
  const [patientCtx, setPatientCtx] = useState<PatientContext>({
    patientId: "ANONYMOUS-001",
    age: "",
    gender: "",
    location: "",
    tobaccoUse: "",
    symptoms: "",
    clinicalHistory: "",
    fastingStatus: "unknown",
    medications: "",
  });
  const [ecgScannerContext, setEcgScannerContext] = useState<EcgScannerContext>(() =>
    createInitialEcgScannerContext(1)
  );
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single");
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    visible: false,
    opacity: 0.6,
    activeFindingIndex: null,
    colorScheme: "jet",
  });
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  const [premiumCtRegion, setPremiumCtRegion] =
    useState<PremiumCtRegion>("full_body");
  /** CT flow: wizard output + optional scanner calibration (sent in patient_context_json). */
  const [ctConfig, setCtConfig] = useState<CtWizardState | null>(null);
  const [pacsOpen, setPacsOpen] = useState(false);
  const [pacsTab, setPacsTab] = useState<"studies" | "worklist" | "settings">("studies");
  /** Desktop: modality bar + disclaimer tucked away for extra main viewport height. */
  const [desktopFooterCollapsed, setDesktopFooterCollapsed] = useState(false);
  const { isMobile, isTablet, isDesktop, width: viewportWidth } = useMediaQuery();
  const compact = isMobile || isTablet;
  const legacyScanning = !["idle", "complete", "error", "medgemma_questions"].includes(stage);
  const orchBusy =
    orchestrationActive &&
    (orch.stage === "detecting" ||
      orch.stage === "interrogating" ||
      orch.stage === "interpreting");
  const isScanning = legacyScanning || orchBusy;
  const activePatientId = modality === "ecg" ? ecgScannerContext.patientId : patientCtx.patientId;
  const activeScan = images[activeIndex];

  const medgemmaQaPanel = useMemo(() => {
    if (stage !== "medgemma_questions" || !activeScan?.medgemmaQuestions?.length) return undefined;
    const id = activeScan.id;
    return {
      questions: activeScan.medgemmaQuestions,
      impressionDraft: activeScan.medgemmaDraft?.impression_draft,
      onSubmit: (answers: Record<string, string>) => {
        void submitMedgemmaAnswers(id, answers, false);
      },
      onSkipAll: () => {
        void submitMedgemmaAnswers(id, {}, true);
      },
    };
  }, [stage, activeScan, submitMedgemmaAnswers]);

  const displayImageUrl = orchestrationPreviewUrl ?? imageUrl;
  const viewportStage: ScanStage = useMemo(() => {
    if (!orchestrationActive) return stage;
    switch (orch.stage) {
      case "detecting":
        return "detecting";
      case "interrogating":
      case "interpreting":
        return "analyzing";
      case "answering_questions":
        return "medgemma_questions";
      case "report_ready":
        return "complete";
      case "error":
        return "error";
      default:
        return "idle";
    }
  }, [orchestrationActive, stage, orch.stage]);

  const [consentGiven, setConsentGiven] = useState(false);
  /** Active Pro (not Plus): file inputs omit video extensions for 2D-only policy. */
  const [proLabs2dOnly, setProLabs2dOnly] = useState(false);
  /** Mobile: user scrolled consent — tuck Analysis Findings peek off-screen so CTAs aren’t covered. */
  const [mobileFindingsTuckedForConsent, setMobileFindingsTuckedForConsent] = useState(false);

  /** Desktop: resizable width (px) for the Analysis Findings column; mobile/tablet unchanged */
  const [findingsPanelWidthPx, setFindingsPanelWidthPx] = useState(320);
  const mainLayoutRef = useRef<HTMLElement | null>(null);
  const findingsPanelWidthRef = useRef(320);
  findingsPanelWidthRef.current = findingsPanelWidthPx;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FINDINGS_PANEL_WIDTH_KEY);
      const w = typeof window !== "undefined" ? window.innerWidth : 1280;
      const fallback = Math.min(380, Math.round(w * 0.35));
      let next = fallback;
      if (raw) {
        const n = parseInt(raw, 10);
        if (!Number.isNaN(n)) next = n;
      }
      setFindingsPanelWidthPx(clampFindingsPanelWidth(next, w));
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!isDesktop) return;
    setFindingsPanelWidthPx((prev) => clampFindingsPanelWidth(prev, viewportWidth));
  }, [isDesktop, viewportWidth]);

  const handleFindingsSplitPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!isDesktop) return;
      e.preventDefault();
      const mainEl = mainLayoutRef.current;
      if (!mainEl) return;

      const onMove = (ev: PointerEvent) => {
        const rect = mainEl.getBoundingClientRect();
        const rw = rect.right - ev.clientX;
        const clamped = clampFindingsPanelWidth(rw, rect.width);
        findingsPanelWidthRef.current = clamped;
        setFindingsPanelWidthPx(clamped);
      };
      const onUp = () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        try {
          localStorage.setItem(
            FINDINGS_PANEL_WIDTH_KEY,
            String(findingsPanelWidthRef.current)
          );
        } catch {
          /* ignore */
        }
      };
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [isDesktop]
  );

  // Stable session id for this scan — reset with each new scan
  const sessionIdRef = useRef<string>(randomId());

  const orchModalityLabel = useMemo(() => {
    const id = orch.resolvedModalityKey ?? modality;
    const m = MODALITIES.find((x) => x.id === id);
    return m?.label ?? id.replace(/_/g, " ");
  }, [orch.resolvedModalityKey, modality]);

  const reportLaunch = useReportEngineLaunch(orchModalityLabel);

  // Handle analysis mode change
  const handleModeChange = useCallback((mode: AnalysisMode) => {
    setAnalysisMode(mode);
    if (mode === "multi") {
      startSession();
    } else {
      resetMultiModel();
    }
  }, [startSession, resetMultiModel]);

  // New scan → increment scan number + new session id
  const handleNewScan = useCallback(() => {
    reset();
    orch.reset();
    reportLaunch.reset();
    orchestrationSourceFileRef.current = null;
    revokeOrchestrationPreview();
    setOrchestrationActive(false);
    resetMultiModel();
    setAnalysisMode("single");
    setHeatmapState({ visible: false, opacity: 0.6, activeFindingIndex: null, colorScheme: "jet" });
    setDicomFiles([]);
    setCtConfig(null);
    setScanNumber((n) => n + 1);
    sessionIdRef.current = randomId();
  }, [reset, resetMultiModel, orch, revokeOrchestrationPreview, reportLaunch]);

  useEffect(() => {
    if (!isCtUiModality(modality)) {
      setCtConfig(null);
    }
  }, [modality]);

  useEffect(() => {
    if (!AI_ORCHESTRATION_ENABLED && modality === "auto") setModality("xray");
  }, [modality, setModality]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/razorpay/checkout");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { labsUsage?: { pro2dOnly?: boolean } };
        if (!cancelled) {
          setProLabs2dOnly(data.labsUsage?.pro2dOnly === true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── History: save draft when files are first uploaded ──
  const saveHistoryDraft = useCallback(
    (files: File[], currentModality: string, currentPatientId: string) => {
      const entry: HistoryEntry = {
        id: sessionIdRef.current,
        timestamp: Date.now(),
        modality: currentModality,
        patientId: currentPatientId,
        imageCount: files.length,
        findingsCount: 0,
        severity: null,
        impression: "",
        status: "draft",
      };
      saveEntry(entry);
    },
    []
  );

  // ── History: promote to scan_done when analysis completes ──
  useEffect(() => {
    if (stage === "complete" && result) {
      type Sev = "critical" | "warning" | "info" | "clear";
      const order: Sev[] = ["critical", "warning", "info", "clear"];
      const topSeverity: Sev = result.findings.reduce<Sev>(
        (worst: Sev, f: Finding) =>
          order.indexOf(f.severity as Sev) < order.indexOf(worst) ? (f.severity as Sev) : worst,
        "clear"
      );
      patchEntry(sessionIdRef.current, {
        status: "scan_done",
        impression: result.impression,
        findingsCount: result.findings.length,
        severity: topSeverity,
        modality: result.modality,
      });
    }
  }, [stage, result]);

  const resolveAnalysisParams = useCallback(
    (files: File[]) => {
      if (modality === "ecg") {
        const notes = buildClinicalNotesForApi({
          age: ecgScannerContext.age,
          gender: ecgScannerContext.gender,
          location: ecgScannerContext.location,
          tobaccoUse: ecgScannerContext.tobaccoUse,
          symptoms: ecgScannerContext.symptoms,
          clinicalHistory: ecgScannerContext.clinicalHistory,
          medications: ecgScannerContext.medications,
          fastingStatus: ecgScannerContext.fastingStatus,
        });
        const pctx = buildEcgApiPatientContextJson(ecgScannerContext);
        return { notes, pctx };
      }
      const notes = buildClinicalNotesForApi(patientCtx);
      const basePatientJson = buildPatientContextJsonForApi(patientCtx);
      let pctx: Record<string, unknown> | undefined;
      if (modality === "dermatology") {
        pctx = basePatientJson;
      } else if (modality === "premium_ct_unified") {
        pctx = {
          ...basePatientJson,
          premium_ct: {
            vista_region_preference: premiumCtRegion,
            strict_3d_volumetric_required: true,
            multi_step_processing: true,
          },
        };
      } else if (isCtUiModality(modality) && ctConfig) {
        const lockedWizard = {
          ...ctConfig,
          region: isCtProductModality(modality)
            ? ctBodyRegionForProductModality(modality)
            : ctConfig.region,
        };
        pctx = buildCtPatientContextJson(basePatientJson, lockedWizard, files);
      } else {
        // All other modalities: send structured context when any field is set (symptoms, age, region, etc.)
        // so cloud narrative LLMs receive the same clinical story as CT/derm flows.
        pctx = basePatientJson;
      }
      return { notes, pctx };
    },
    [modality, ctConfig, patientCtx, ecgScannerContext, premiumCtRegion]
  );

  const showCtWizard =
    isCtUiModality(modality) && !ctConfig && images.length === 0 && stage === "idle";

  const ctFileAccept =
    isCtUiModality(modality) && ctConfig && ctConfig.upload_path === "image"
      ? "image/jpeg,image/png,.jpg,.jpeg,.png"
      : getUploadAcceptTypes(isCtUiModality(modality) ? "ct_abdomen" : modality, {
          pro2dOnly: proLabs2dOnly,
        });

  // Handle file drop/upload -> AI validation first, then analysis (or AI orchestration)
  const handleFile = useCallback(
    (files: File[]) => {
      if (!consentGiven) {
        return;
      }
      if (modality === "ecg" && !ecgFormHasRequiredDemographics(ecgScannerContext.ecgForm)) {
        addToast("ECG: enter age and sex in section 1 before uploading.", "warning");
        return;
      }
      const file0 = files[0];
      if (!file0) return;

      if (
        analysisMode === "single" &&
        shouldUseOrchestration(modality, ctConfig)
      ) {
        void (async () => {
          const pf = await preflightLabsScan(modality);
          if (!pf.allowed) {
            const msg =
              ("message" in pf && typeof pf.message === "string" && pf.message) ||
              "Labs quota does not allow this scan right now.";
            addToast(msg, "warning", 8000);
            return;
          }
          const hasDicom = files.some(
            (f) =>
              f.name.toLowerCase().endsWith(".dcm") || f.name.toLowerCase().endsWith(".nii")
          );
          if (hasDicom) setDicomFiles(files);
          revokeOrchestrationPreview();
          orchestrationSourceFileRef.current = file0;
          const url = URL.createObjectURL(file0);
          orchPreviewRevokeRef.current = url;
          setOrchestrationPreviewUrl(url);
          setOrchestrationActive(true);
          resetValidation();
          setPendingFiles(null);
          const res = await orch.start({ file: file0, modalityKey: modality });
          if (!res.ok) {
            addToast(res.error || "AI orchestration could not start.", "warning", 9000);
          } else {
            saveHistoryDraft(files, modality, activePatientId);
          }
        })();
        return;
      }

      // Check if DICOM — store separately for viewer
      const hasDicom = files.some(
        (f) => f.name.toLowerCase().endsWith(".dcm") || f.name.toLowerCase().endsWith(".nii")
      );
      if (hasDicom) setDicomFiles(files);
      const { notes, pctx } = resolveAnalysisParams(files);
      const analyzeModalityForApi =
        modality === "ct" && ctConfig ? gatewayModalityForCtRegion(ctConfig.region) : undefined;

      // Store pending files for validation
      setPendingFiles({
        files,
        modality,
        clinicalNotes: notes,
        patientContext: pctx,
        analyzeModalityForApi,
      });

      // Trigger AI validation with first file
      const patientContextForValidation = {
        patientId: activePatientId,
        age: patientCtx.age,
        gender: patientCtx.gender,
        location: patientCtx.location,
        symptoms: patientCtx.symptoms,
        clinicalHistory: patientCtx.clinicalHistory,
        medications: patientCtx.medications,
      };

      startValidation(files[0], modality, patientContextForValidation);
    },
    [
      addFiles,
      modality,
      ctConfig,
      resolveAnalysisParams,
      activePatientId,
      consentGiven,
      ecgScannerContext.ecgForm,
      addToast,
      startValidation,
      patientCtx,
      analysisMode,
      orch,
      revokeOrchestrationPreview,
      resetValidation,
      saveHistoryDraft,
    ]
  );

  // Auto-fill patient context from DICOM metadata
  const handleDicomMetadata = useCallback(
    (meta: DicomMetadataType) => {
      const ageDigits = meta.patientAge ? meta.patientAge.replace(/\D/g, "") : "";
      const sexMf = meta.patientSex === "M" ? "M" : meta.patientSex === "F" ? "F" : "";
      setPatientCtx((prev) => ({
        ...prev,
        age: ageDigits || prev.age,
        gender:
          meta.patientSex === "M" ? "male" : meta.patientSex === "F" ? "female" : prev.gender,
      }));
      if (modality === "ecg") {
        setEcgScannerContext((prev) => ({
          ...prev,
          age: ageDigits || prev.age,
          gender: meta.patientSex === "M" ? "male" : meta.patientSex === "F" ? "female" : prev.gender,
          ecgForm: {
            ...prev.ecgForm,
            demographics: {
              ...prev.ecgForm.demographics,
              age: ageDigits || prev.ecgForm.demographics.age,
              sex: sexMf || prev.ecgForm.demographics.sex,
            },
          },
        }));
      }
    },
    [modality]
  );

  // Handle Add More from thumbnail strip
  const handleAddFiles = useCallback(() => {
    addMoreRef.current?.click();
  }, []);

  const handleAddCamera = useCallback(() => {
    addCameraRef.current?.click();
  }, []);

  const handleAddMoreChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        if (!consentGiven) {
          e.target.value = "";
          return;
        }
        if (modality === "premium_ct_unified") {
          addToast(
            "Premium 3D CT accepts DICOM ZIP or NIfTI only. Camera uploads are disabled.",
            "warning"
          );
          e.target.value = "";
          return;
        }
        if (modality === "ecg" && !ecgFormHasRequiredDemographics(ecgScannerContext.ecgForm)) {
          addToast("ECG: enter age and sex in section 1 before uploading.", "warning");
          e.target.value = "";
          return;
        }
        if (analysisMode === "single" && shouldUseOrchestration(modality, ctConfig)) {
          handleFile(files);
          e.target.value = "";
          return;
        }
        const { notes, pctx } = resolveAnalysisParams(files);
        const analyzeModalityForApi =
          modality === "ct" && ctConfig ? gatewayModalityForCtRegion(ctConfig.region) : undefined;
        const historyMod = analyzeModalityForApi ?? modality;
        addFiles(files, modality, notes || undefined, pctx, analyzeModalityForApi);
        saveHistoryDraft(files, historyMod, activePatientId);
      }
      e.target.value = "";
    },
    [
      addFiles,
      modality,
      ctConfig,
      resolveAnalysisParams,
      saveHistoryDraft,
      activePatientId,
      consentGiven,
      ecgScannerContext.ecgForm,
      addToast,
      analysisMode,
      handleFile,
    ]
  );

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!consentGiven) {
          e.target.value = "";
          return;
        }
        if (modality === "ecg" && !ecgFormHasRequiredDemographics(ecgScannerContext.ecgForm)) {
          addToast("ECG: enter age and sex in section 1 before uploading.", "warning");
          e.target.value = "";
          return;
        }
        if (analysisMode === "single" && shouldUseOrchestration(modality, ctConfig)) {
          handleFile([file]);
          e.target.value = "";
          return;
        }
        const { notes, pctx } = resolveAnalysisParams([file]);
        const analyzeModalityForApi =
          modality === "ct" && ctConfig ? gatewayModalityForCtRegion(ctConfig.region) : undefined;
        const historyMod = analyzeModalityForApi ?? modality;
        addFiles([file], modality, notes || undefined, pctx, analyzeModalityForApi);
        saveHistoryDraft([file], historyMod, activePatientId);
      }
      e.target.value = "";
    },
    [
      addFiles,
      modality,
      ctConfig,
      resolveAnalysisParams,
      saveHistoryDraft,
      activePatientId,
      consentGiven,
      ecgScannerContext.ecgForm,
      addToast,
      analysisMode,
      handleFile,
    ]
  );

  // Multi-model copilot activation
  const handleActivateCopilot = useCallback(() => {
    activateCopilot(activePatientId);
  }, [activateCopilot, activePatientId]);

  // AI validation handlers
  const handleAIConfirm = useCallback(() => {
    if (!pendingFiles) return;
    const analyzeModalityForApi =
      pendingFiles.analyzeModalityForApi ||
      pendingFiles.modality;
    addFiles(
      pendingFiles.files,
      pendingFiles.modality,
      pendingFiles.clinicalNotes,
      pendingFiles.patientContext,
      pendingFiles.analyzeModalityForApi
    );
    const historyMod = analyzeModalityForApi ?? pendingFiles.modality;
    saveHistoryDraft(pendingFiles.files, historyMod, activePatientId);
    setPendingFiles(null);
    confirmAndProceed();
  }, [pendingFiles, addFiles, saveHistoryDraft, activePatientId, confirmAndProceed]);

  const handleAICancel = useCallback(() => {
    setPendingFiles(null);
    cancelValidation();
  }, [cancelValidation]);

  const handleAIForceProceed = useCallback(() => {
    if (!pendingFiles) return;
    const analyzeModalityForApi =
      pendingFiles.analyzeModalityForApi ||
      pendingFiles.modality;
    addFiles(
      pendingFiles.files,
      pendingFiles.modality,
      pendingFiles.clinicalNotes,
      pendingFiles.patientContext,
      pendingFiles.analyzeModalityForApi
    );
    const historyMod = analyzeModalityForApi ?? pendingFiles.modality;
    saveHistoryDraft(pendingFiles.files, historyMod, activePatientId);
    setPendingFiles(null);
    forceProceedAnyway();
  }, [pendingFiles, addFiles, saveHistoryDraft, activePatientId, forceProceedAnyway]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K — command palette
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdOpen((o) => !o);
        return;
      }

      // Don't process shortcuts if command palette is open
      if (cmdOpen) return;

      switch (e.key) {
        case "Escape":
          setCmdOpen(false);
          break;
        case "f":
        case "F":
          if (!e.metaKey && !e.ctrlKey) {
            // Fullscreen toggle
          }
          break;
        case "+":
        case "=":
          setZoom(Math.min(4, zoom + 0.25));
          break;
        case "-":
          setZoom(Math.max(0.25, zoom - 0.25));
          break;
        case "0":
          setZoom(1);
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [cmdOpen, zoom, setZoom]);

  const handleOrchestrationSubmit = useCallback(
    async (answers: Array<{ question_id: string; answer: string }>) => {
      const out = await orch.submitAnswers(answers);
      if (out.report) {
        const modId = out.modalityIdForUsage ?? modality;
        void recordLabsScan(modId).then((rec) => {
          if (!rec.ok && rec.error) addToast(rec.error, "warning", 7000);
        });
      }
    },
    [orch, modality, addToast]
  );

  const dismissOrchestration = useCallback(() => {
    orch.reset();
    reportLaunch.reset();
    orchestrationSourceFileRef.current = null;
    revokeOrchestrationPreview();
    setOrchestrationActive(false);
  }, [orch, revokeOrchestrationPreview, reportLaunch]);

  const handleReportEnginePrimary = useCallback(() => {
    if (reportLaunch.phase === "idle") {
      reportLaunch.startGpuSequence();
      return;
    }
    if (reportLaunch.phase === "ready") {
      reportLaunch.openReportEngine(async () => {
        const f = orchestrationSourceFileRef.current;
        let sourceImageDataUrl: string | null = null;
        if (f) {
          sourceImageDataUrl = await fileToDataUrl(f);
        }
        const r = orch.report;
        if (!r) {
          throw new Error("No report");
        }
        return interpretationReportToEnginePayload(r, {
          modalityKey: orch.resolvedModalityKey ?? modality,
          modalityLabel: orchModalityLabel,
          patientId: activePatientId,
          sourceImageDataUrl,
        });
      });
    }
  }, [
    reportLaunch,
    orch.report,
    orch.resolvedModalityKey,
    modality,
    orchModalityLabel,
    activePatientId,
  ]);

  // ── Determine multi-model UI state ──
  const handleRetry = useCallback(() => {
    const active = images[activeIndex];
    if (active) {
      retryImage(active.id);
    }
  }, [images, activeIndex, retryImage]);
  const isMultiMode = analysisMode === "multi";
  const multiStage = multiSession.stage;
  const showMultiSelector = isMultiMode && multiStage === "selecting";
  const showMultiUploadWizard = isMultiMode && multiStage === "uploading";
  const showMultiProcessing = isMultiMode && (multiStage === "processing" || multiStage === "unifying");
  const showMultiComplete = isMultiMode && multiStage === "complete" && multiSession.unifiedResult;
  const showCopilotConfirm = isMultiMode && multiStage === "confirming";

  const showOrchestrationFindings = orchestrationActive && analysisMode === "single";

  const orchestrationFindingsPanel = useMemo(() => {
    if (!showOrchestrationFindings) return null;
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          width: "100%",
          minHeight: 0,
          flex: "1 1 auto",
        }}
      >
        {orchBusy ? (
          orch.stage === "interpreting" ? (
            <OrchestrationProgress />
          ) : (
            <div
              className="font-body"
              style={{ padding: 16, textAlign: "center", fontSize: 12, color: "var(--text-40)" }}
            >
              {orch.stage === "detecting" && "Detecting modality…"}
              {orch.stage === "interrogating" && "Generating clinical questions…"}
            </div>
          )
        ) : null}
        {orch.stage === "error" && orch.error ? (
          <div
            style={{
              borderRadius: 12,
              border: "1px solid rgba(248,113,113,0.35)",
              background: "rgba(248,113,113,0.08)",
              padding: 12,
              fontSize: 13,
              color: "var(--text-80)",
            }}
          >
            {orch.error}
            <button
              type="button"
              className="font-body"
              onClick={dismissOrchestration}
              style={{
                display: "block",
                marginTop: 10,
                padding: "6px 12px",
                borderRadius: 8,
                border: "1px solid var(--glass-border)",
                background: "rgba(255,255,255,0.06)",
                cursor: "pointer",
                fontSize: 11,
              }}
            >
              Dismiss
            </button>
          </div>
        ) : null}
        {orch.stage === "answering_questions" && orch.questions.length > 0 ? (
          <InterrogatorQA
            questions={orch.questions}
            onSubmit={handleOrchestrationSubmit}
            disabled={orch.isLoading}
            resolvedModalityLabel={orchModalityLabel}
            wasAutoDetected={modality === "auto"}
            detectionConfidence={orch.detectedConfidence ?? undefined}
          />
        ) : null}
        {orch.stage === "report_ready" && orch.report ? (
          <AIReportPanel
            report={orch.report}
            webSearchEnabled={webSearchEnabled}
            onNewScan={handleNewScan}
            reportEngine={{
              phase: reportLaunch.phase,
              statusLine: reportLaunch.statusLine,
              onPrimaryClick: handleReportEnginePrimary,
            }}
          />
        ) : null}
      </div>
    );
  }, [
    showOrchestrationFindings,
    orchBusy,
    orch.stage,
    orch.error,
    orch.questions,
    orch.report,
    orch.isLoading,
    handleOrchestrationSubmit,
    dismissOrchestration,
    webSearchEnabled,
    handleNewScan,
    reportLaunch.phase,
    reportLaunch.statusLine,
    handleReportEnginePrimary,
    orchModalityLabel,
    modality,
    orch.detectedConfidence,
  ]);

  const findingsPeekSubtitle = (() => {
    if (!isMultiMode) {
      if (showOrchestrationFindings) {
        if (orch.stage === "report_ready" && orch.report) return "AI report ready";
        if (orchBusy) return "AI orchestration…";
        if (orch.stage === "answering_questions") return "Answer clinical questions";
        if (orch.stage === "error") return "Orchestration error";
        return "Swipe up to view";
      }
      if (stage === "complete" && result) {
        return `${result.findings.length} findings · ${Math.round(
          result.findings.reduce((s: number, f: Finding) => s + f.confidence, 0) /
            (result.findings.length || 1)
        )}%`;
      }
      if (isScanning) return "Analyzing…";
      return "Swipe up to view";
    }
    if (showMultiComplete) return "Unified report ready";
    if (showMultiProcessing) return "Processing…";
    return "Swipe up to view";
  })();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      {/* ─── CONSENT GATE (no separate Labs sign-in; app auth is global elsewhere if used) ─── */}
      {!consentGiven && (
        <ConsentGate
          onConsentBodyScroll={(top) => {
            if (top > 28) setMobileFindingsTuckedForConsent(true);
            else if (top <= 6) setMobileFindingsTuckedForConsent(false);
          }}
          onAccept={(pid) => {
            setConsentGiven(true);
            setMobileFindingsTuckedForConsent(false);
            setPatientCtx((prev) => ({
              ...prev,
              patientId: pid || prev.patientId,
            }));
          }}
        />
      )}

      {/* ─── TOP BAR ─── */}
      <TopBar
        scanning={isScanning || showMultiProcessing}
        onNewScan={handleNewScan}
        onCommandPalette={() => setCmdOpen(true)}
        onOpenPacs={() => setPacsOpen(true)}
      />

      {/* ─── MODALITY BAR (on mobile: top position, under TopBar) ─── */}
      {compact && !isMultiMode && (
        <ModalityBar
          activeModality={modality}
          onSelect={(m) => setModality(m)}
        />
      )}

      {/* ─── MAIN CONTENT ─── */}
      <main
        ref={mainLayoutRef}
        className="scanner-layout"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: isDesktop ? "row" : "column",
          gap: 0,
          overflow: compact ? "auto" : "hidden",
        }}
      >
        {/* LEFT: Viewport */}
        <div
          className="viewport-section"
          style={{
            flex: isDesktop ? "1 1 auto" : 1,
            minWidth: isDesktop ? 0 : undefined,
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: compact ? "8px 8px 80px 8px" : "8px 0 12px 16px",
          }}
        >
          {/* Patient context bar */}
          <div
            className="glass-panel"
            style={{
              borderRadius: "var(--r-md) var(--r-md) 0 0",
              borderBottom: "none",
            }}
          >
            {modality === "ecg" ? (
              <ECGPatientContextForm
                scanNumber={scanNumber}
                onContextChange={setEcgScannerContext}
                analysisMode={analysisMode}
                onAnalysisModeChange={handleModeChange}
              />
            ) : (
              <PatientContextForm
                scanNumber={scanNumber}
                onContextChange={setPatientCtx}
                analysisMode={analysisMode}
                onAnalysisModeChange={handleModeChange}
                modality={modality}
              />
            )}
          </div>

          {!isMultiMode && (
            <SelectedModalityStrip modalityId={modality} compact={compact} />
          )}

          {modality === "premium_ct_unified" ? (
            <PremiumCTRegionSelector
              value={premiumCtRegion}
              onChange={setPremiumCtRegion}
            />
          ) : null}

          {isCtUiModality(modality) && ctConfig && !showCtWizard && (
            <div
              className="glass-panel"
              style={{
                padding: "10px 16px 14px",
                borderRadius: 0,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "none",
              }}
            >
              <p className="text-caption" style={{ fontSize: 9, color: "var(--text-30)", marginBottom: 8 }}>
                Scanner type (optional — helps AI calibrate)
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                {([16, 32, 64, 128] as const).map((n) => {
                  const active = ctConfig.scanner_slices === n;
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() =>
                        setCtConfig((c) => (c ? { ...c, scanner_slices: n } : null))
                      }
                      style={{
                        fontSize: 10,
                        padding: "5px 10px",
                        borderRadius: "var(--r-full)",
                        border: active ? "1px solid var(--scan-500)" : "1px solid var(--glass-border)",
                        background: active ? "rgba(0,196,176,0.12)" : "rgba(255,255,255,0.03)",
                        color: "var(--text-55)",
                        cursor: "pointer",
                      }}
                    >
                      {n === 128 ? "128-slice+" : `${n}-slice`}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setCtConfig((c) => (c ? { ...c, scanner_slices: null } : null))}
                  style={{
                    fontSize: 10,
                    padding: "5px 10px",
                    borderRadius: "var(--r-full)",
                    border:
                      ctConfig.scanner_slices === null
                        ? "1px solid var(--scan-500)"
                        : "1px solid var(--glass-border)",
                    background:
                      ctConfig.scanner_slices === null
                        ? "rgba(0,196,176,0.12)"
                        : "rgba(255,255,255,0.03)",
                    color: "var(--text-55)",
                    cursor: "pointer",
                  }}
                >
                  Don&apos;t know
                </button>
              </div>
            </div>
          )}

          {/* ── Single Mode: Normal scan viewport ── */}
          {!isMultiMode && (
            <>
              {showCtWizard ? (
                <CtUploadWizard
                  lockRegion={
                    isCtProductModality(modality)
                      ? ctBodyRegionForProductModality(modality)
                      : undefined
                  }
                  onComplete={setCtConfig}
                />
              ) : (
                <ScanViewport
                  onFileDrop={handleFile}
                  imageUrl={displayImageUrl}
                  stage={viewportStage}
                  zoom={zoom}
                  modality={modality}
                  acceptOverride={isCtUiModality(modality) ? ctFileAccept : undefined}
                  pro2dOnly={proLabs2dOnly}
                  dicomFiles={dicomFiles}
                  onMetadataExtracted={handleDicomMetadata}
                  heatmapUrl={orchestrationActive ? undefined : result?.heatmap_url}
                  heatmapState={heatmapState}
                  onHeatmapStateChange={setHeatmapState}
                  findings={orchestrationActive ? undefined : result?.findings}
                />
              )}
              {modality === "premium_ct_unified" && stage === "analyzing" ? (
                <div style={{ marginTop: 10 }}>
                  <PremiumCTProgressPanel step="vista_segmentation" />
                </div>
              ) : null}
              <ViewportControls
                zoom={zoom}
                onZoomChange={setZoom}
                hasImage={!!displayImageUrl}
              />
              <ThumbnailStrip
                images={images}
                activeIndex={activeIndex}
                onSelect={setActiveIndex}
                onRemove={removeImage}
                onAddFiles={handleAddFiles}
                onAddCamera={handleAddCamera}
              />
              <input
                ref={addMoreRef}
                type="file"
                accept={
                  isCtUiModality(modality)
                    ? ctFileAccept
                    : getUploadAcceptTypes(modality, { pro2dOnly: proLabs2dOnly })
                }
                multiple
                style={{ display: "none" }}
                onChange={handleAddMoreChange}
              />
              <input
                ref={addCameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                style={{ display: "none" }}
                onChange={handleCameraChange}
              />
            </>
          )}

          {/* ── Multi Mode: Upload Wizard ── */}
          {showMultiUploadWizard && (
            <MultiModelUploadWizard
              uploads={multiSession.uploads}
              onSetFiles={setUploadFiles}
              onComplete={proceedToConfirm}
              onBack={goBack}
              pro2dOnly={proLabs2dOnly}
            />
          )}

          {/* ── Multi Mode: Processing Progress ── */}
          {showMultiProcessing && (
            <div
              className="glass-panel"
              style={{ flex: 1, borderRadius: 0 }}
            >
              <MultiModelProgress session={multiSession} />
            </div>
          )}

          {/* ── Multi Mode: Complete (left side shows summary) ── */}
          {showMultiComplete && (
            <div
              className="glass-panel"
              style={{
                flex: 1,
                borderRadius: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                gap: 20,
              }}
            >
              <div
                style={{
                  width: 80,
                  height: 80,
                  borderRadius: "50%",
                  background: "radial-gradient(circle, rgba(48,209,88,0.12) 0%, transparent 70%)",
                  border: "2px solid rgba(48,209,88,0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 32,
                }}
              >
                ✓
              </div>
              <p
                className="font-display"
                style={{ fontSize: 13, color: "var(--clear)", letterSpacing: "0.15em", textTransform: "uppercase" }}
              >
                Unified Analysis Complete
              </p>
              <p className="font-body" style={{ fontSize: 11, color: "var(--text-40)", textAlign: "center", maxWidth: 320 }}>
                {multiSession.uploads.length} modalities analyzed and cross-referenced. View the unified report in the Intelligence Panel →
              </p>
            </div>
          )}

          {/* ── Multi Mode: Idle/Selecting prompt ── */}
          {isMultiMode && multiStage === "selecting" && (
            <div
              className="glass-panel"
              style={{
                flex: 1,
                borderRadius: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: 32,
                gap: 16,
              }}
            >
              <div style={{ opacity: 0.15, fontSize: 48 }}>✦</div>
              <p className="font-body" style={{ fontSize: 12, color: "var(--text-40)", textAlign: "center" }}>
                Select modalities to begin multi-model analysis
              </p>
            </div>
          )}
        </div>

        {/* Desktop: drag handle between upload and findings (not shown on mobile / tablet) */}
        {isDesktop && (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize analysis findings panel"
            onPointerDown={handleFindingsSplitPointerDown}
            style={{
              flex: `0 0 ${FINDINGS_SPLIT_HANDLE_PX}px`,
              width: FINDINGS_SPLIT_HANDLE_PX,
              alignSelf: "stretch",
              cursor: "col-resize",
              touchAction: "none",
              flexShrink: 0,
              background:
                "linear-gradient(180deg, transparent 0%, rgba(212,175,55,0.2) 15%, rgba(212,175,55,0.45) 50%, rgba(212,175,55,0.2) 85%, transparent 100%)",
              boxShadow: "inset 0 0 0 1px rgba(212,175,55,0.12)",
              zIndex: 2,
            }}
          />
        )}

        {/* RIGHT: Intelligence Panel — on mobile becomes BottomSheet (tucks off-screen while consent scrolls) */}
        {compact ? (
          /* ── MOBILE/TABLET: Bottom Sheet ── */
          <BottomSheet
            peekHeight={72}
            tuckedOffScreen={!consentGiven && mobileFindingsTuckedForConsent}
            collapsedContent={
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                  }}
                >
                  <span
                    className="font-display"
                    style={{
                      fontSize: 10,
                      color: "var(--text-55)",
                      letterSpacing: "0.1em",
                      textTransform: "uppercase",
                    }}
                  >
                    {isMultiMode ? "✦ Multi-Model Analysis" : "Analysis Findings"}
                  </span>
                  <span className="font-mono" style={{ fontSize: 9, color: "var(--scan-400)", flexShrink: 0 }}>
                    {findingsPeekSubtitle}
                  </span>
                </div>
                {!isMultiMode ? (
                  <span
                    className="font-mono"
                    style={{
                      fontSize: 9,
                      color: "var(--text-40)",
                      letterSpacing: "0.04em",
                      lineHeight: 1.3,
                    }}
                  >
                    {formatModalityPeek(modality)}
                  </span>
                ) : null}
              </div>
            }
          >
            {/* Content inside bottom sheet */}
            {!isMultiMode && showOrchestrationFindings && orchestrationFindingsPanel}
            {!isMultiMode && !showOrchestrationFindings && (
              <IntelligencePanel
                stage={stage}
                result={result}
                detectedModality={detectedModality ?? undefined}
                analysisElapsedMs={analysisElapsedMs}
                idleModalitySummary={formatModalityPeek(modality)}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
                onRetry={handleRetry}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
                medgemmaQa={medgemmaQaPanel}
                aiValidation={
                  aiValidationState.validationResult
                    ? {
                        validationResult: aiValidationState.validationResult,
                        userAnswers: aiValidationState.userAnswers,
                        chatHistory: aiValidationState.chatHistory,
                        onAnswerQuestion: submitAnswer,
                        onAskQuestion: askFollowUpQuestion,
                        onConfirm: handleAIConfirm,
                        onForceProceed: handleAIForceProceed,
                        onCancel: handleAICancel,
                        isProcessing:
                          aiValidationState.stage === "validating" ||
                          aiValidationState.stage === "proceeding",
                      }
                    : undefined
                }
              />
            )}
            {showMultiComplete && multiSession.unifiedResult && (
              <UnifiedReportPanel
                unifiedResult={multiSession.unifiedResult}
                individualResults={multiSession.individualResults}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
              />
            )}
            {isMultiMode && !showMultiComplete && (
              <div style={{ padding: 20, textAlign: "center" }}>
                <p className="text-caption" style={{ color: "var(--gold-300)", marginBottom: 12 }}>
                  ✦ Multi-Model Analysis
                </p>
                <p className="font-body" style={{ fontSize: 12, color: "var(--text-30)" }}>
                  {showMultiProcessing
                    ? multiSession.stage === "unifying" ? "Generating unified report…" : `Processing ${multiSession.currentProcessingIndex + 1}/${multiSession.uploads.length}…`
                    : `${multiSession.selectedModalities.length} modalities · Unified Analysis`}
                </p>
              </div>
            )}
          </BottomSheet>
        ) : (
          /* ── DESKTOP: Side Panel ── */
          <div
            className="intelligence-section"
            style={{
              flex: isDesktop ? "0 0 auto" : "0 0 35%",
              alignSelf: "stretch",
              minHeight: 0,
              maxHeight: "100%",
              width: isDesktop ? findingsPanelWidthPx : undefined,
              maxWidth: isDesktop ? undefined : 380,
              minWidth: isDesktop ? MIN_FINDINGS_PANEL_W : 300,
              display: "flex",
              flexDirection: "column",
              overflowY: "auto",
              overflowX: "hidden",
              WebkitOverflowScrolling: "touch",
              padding: 16,
              paddingBottom: "max(28px, env(safe-area-inset-bottom, 0px))",
            }}
          >
            {!isMultiMode && showOrchestrationFindings && orchestrationFindingsPanel}
            {!isMultiMode && !showOrchestrationFindings && (
              <IntelligencePanel
                stage={stage}
                result={result}
                detectedModality={detectedModality ?? undefined}
                analysisElapsedMs={analysisElapsedMs}
                idleModalitySummary={formatModalityPeek(modality)}
                fillContainer={isDesktop}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
                onRetry={handleRetry}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
                medgemmaQa={medgemmaQaPanel}
                aiValidation={
                  aiValidationState.validationResult
                    ? {
                        validationResult: aiValidationState.validationResult,
                        userAnswers: aiValidationState.userAnswers,
                        chatHistory: aiValidationState.chatHistory,
                        onAnswerQuestion: submitAnswer,
                        onAskQuestion: askFollowUpQuestion,
                        onConfirm: handleAIConfirm,
                        onForceProceed: handleAIForceProceed,
                        onCancel: handleAICancel,
                        isProcessing:
                          aiValidationState.stage === "validating" ||
                          aiValidationState.stage === "proceeding",
                      }
                    : undefined
                }
              />
            )}
            {showMultiComplete && multiSession.unifiedResult && (
              <UnifiedReportPanel
                unifiedResult={multiSession.unifiedResult}
                individualResults={multiSession.individualResults}
                fillContainer={isDesktop}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
              />
            )}
            {isMultiMode && !showMultiComplete && (
              <div
                className="intelligence-section glass-panel"
                style={{
                  width: "100%",
                  maxWidth: isDesktop ? "none" : 380,
                  flexShrink: 0,
                  display: "flex",
                  flexDirection: "column",
                  overflow: "hidden",
                }}
              >
                <div style={{ padding: "20px 20px 0" }}>
                  <h2 className="text-caption" style={{ color: "var(--gold-300)", marginBottom: 16, fontSize: 9 }}>
                    ✦ &nbsp; M U L T I - M O D E L &nbsp; A N A L Y S I S
                  </h2>
                </div>
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 16 }}>
                  {showMultiProcessing ? (
                    <>
                      <div style={{ display: "flex", gap: 8 }}>
                        {[0, 1, 2].map((i) => (
                          <div key={i} style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--gold-500)", animation: `pulse 1.2s ${i * 0.2}s ease-in-out infinite` }} />
                        ))}
                      </div>
                      <p className="text-caption" style={{ color: "var(--gold-300)", animation: "pulse 2s ease-in-out infinite", textAlign: "center" }}>
                        {multiSession.stage === "unifying" ? "Generating unified report…" : `Processing modality ${multiSession.currentProcessingIndex + 1} of ${multiSession.uploads.length}…`}
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ opacity: 0.15, fontSize: 48 }}>✦</div>
                      <p className="font-body" style={{ fontSize: 12, color: "var(--text-30)", textAlign: "center", lineHeight: 1.6 }}>
                        {multiStage === "selecting" && `${multiSession.selectedModalities.length} modalities selected`}
                        {multiStage === "uploading" && "Upload scans for each modality"}
                        {multiStage === "confirming" && "Ready to activate Radiologist Copilot"}
                      </p>
                      <p className="font-display" style={{ fontSize: 9, color: "var(--text-15)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                        {multiSession.selectedModalities.length} modalities · Unified Analysis
                      </p>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* ─── MODALITY BAR (desktop: bottom position) ─── */}
      {!compact && !isMultiMode && (
        <ModalityBar
          activeModality={modality}
          onSelect={(m) => setModality(m)}
          collapsible
          collapsed={desktopFooterCollapsed}
          onCollapsedChange={setDesktopFooterCollapsed}
        />
      )}

      {/* ─── DISCLAIMER (hide on mobile — space taken by bottom sheet; hide when desktop footer collapsed) ─── */}
      {!compact && !desktopFooterCollapsed && <DisclaimerBar />}

      {/* ─── COMMAND PALETTE ─── */}
      <CommandPalette
        open={cmdOpen}
        onClose={() => setCmdOpen(false)}
        onNewScan={handleNewScan}
      />

      {/* ─── MULTI-MODEL SELECTOR OVERLAY ─── */}
      {showMultiSelector && (
        <MultiModelSelector
          selectedModalities={multiSession.selectedModalities}
          onToggle={toggleModality}
          onConfirm={confirmSelection}
          onCancel={() => handleModeChange("single")}
        />
      )}

      {/* ─── COPILOT ACTIVATION OVERLAY ─── */}
      {showCopilotConfirm && (
        <CopilotActivation
          uploads={multiSession.uploads}
          onActivate={handleActivateCopilot}
          onBack={goBack}
        />
      )}
      {/* ─── PACS DRAWER ─── */}
      <div
        className={`pacs-drawer-backdrop ${pacsOpen ? "open" : ""}`}
        onClick={() => setPacsOpen(false)}
      />
      <div className={`pacs-drawer ${pacsOpen ? "open" : ""}`}>
        {/* Header */}
        <div className="pacs-drawer-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 20 }}>🗄️</span>
            <h2 className="font-display" style={{ fontSize: 14, margin: 0, color: "var(--text-100)", letterSpacing: "0.08em" }}>
              PACS
            </h2>
          </div>
          <button
            onClick={() => setPacsOpen(false)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "var(--text-55)" }}
          >
            ✕
          </button>
        </div>
        {/* Tabs */}
        <div className="pacs-drawer-tabs">
          {(["studies", "worklist", "settings"] as const).map((tab) => (
            <button
              key={tab}
              className={`pacs-drawer-tab ${pacsTab === tab ? "active" : ""}`}
              onClick={() => setPacsTab(tab)}
            >
              {tab === "studies" ? "📋 Studies" : tab === "worklist" ? "📝 Worklist" : "⚙️ Settings"}
            </button>
          ))}
        </div>
        {/* Tab Content */}
        <div className="pacs-drawer-content">
          {pacsTab === "studies" && (
            <PacsBrowser
              onStudySelect={(study) => {
                // Auto-fill patient context from PACS study
                setPatientCtx((prev) => ({
                  ...prev,
                  patientId: study.patient_id || prev.patientId,
                }));
              }}
            />
          )}
          {pacsTab === "worklist" && (
            <WorklistPanel
              onSelectItem={(item) => {
                // Auto-fill scanner form from worklist
                setPatientCtx((prev) => ({
                  ...prev,
                  patientId: item.patient_id || prev.patientId,
                }));
                setPacsOpen(false);
              }}
            />
          )}
          {pacsTab === "settings" && <PacsSettings />}
        </div>
      </div>
    </div>
  );
}
