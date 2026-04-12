"use client";
import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import TopBar from "@/components/analyse/layout/TopBar";
import ModalityBar from "@/components/analyse/layout/ModalityBar";
import DisclaimerBar from "@/components/analyse/layout/DisclaimerBar";
import CommandPalette from "@/components/analyse/layout/CommandPalette";
import ScanViewport from "@/components/analyse/scanner/ScanViewport";
import CtUploadWizard from "@/components/analyse/scanner/CtUploadWizard";
import ViewportControls from "@/components/analyse/scanner/ViewportControls";
import ThumbnailStrip from "@/components/analyse/scanner/ThumbnailStrip";
import IntelligencePanel from "@/components/analyse/findings/IntelligencePanel";
import UnifiedReportPanel from "@/components/analyse/findings/UnifiedReportPanel";
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
import { useGatewayAuthBridge } from "@/hooks/analyse/useGatewayAuthBridge";
import { useMultiModelAnalysis } from "@/hooks/analyse/useMultiModelAnalysis";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import { useToast } from "@/hooks/useToast";
import { saveEntry, patchEntry } from "@/lib/analyse/history";
import type { HistoryEntry } from "@/lib/analyse/history";
import type {
  AnalysisMode,
  HeatmapState,
  DicomMetadataType,
  Finding,
} from "@/lib/analyse/types";
import {
  buildClinicalNotesForApi,
  buildPatientContextJsonForApi,
} from "@/lib/analyse/clinical-notes";
import { getUploadAcceptTypes } from "@/lib/analyse/constants";
import {
  storeOracleLabsHandoff,
  formatSingleLabsReportForOracle,
  formatUnifiedLabsReportForOracle,
  DEFAULT_ORACLE_FOLLOWUP_FROM_LABS,
  MEDGEMMA_ORACLE_FOLLOWUP_FROM_LABS,
  ORACLE_LABS_HANDOFF_QUERY,
} from "@/lib/analyse/oracle-handoff";
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

const isCtUiModality = (m: string) => m === "ct" || isCtProductModality(m);

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
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const compact = isMobile || isTablet;
  const isScanning = !["idle", "complete", "error", "medgemma_questions"].includes(stage);
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

  const [consentGiven, setConsentGiven] = useState(false);
  /** Active Pro (not Plus): file inputs omit video extensions for 2D-only policy. */
  const [proLabs2dOnly, setProLabs2dOnly] = useState(false);
  /** Mobile: user scrolled consent — tuck Analysis Findings peek off-screen so CTAs aren’t covered. */
  const [mobileFindingsTuckedForConsent, setMobileFindingsTuckedForConsent] = useState(false);

  // Stable session id for this scan — reset with each new scan
  const sessionIdRef = useRef<string>(randomId());

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
    resetMultiModel();
    setAnalysisMode("single");
    setHeatmapState({ visible: false, opacity: 0.6, activeFindingIndex: null, colorScheme: "jet" });
    setDicomFiles([]);
    setCtConfig(null);
    setScanNumber((n) => n + 1);
    sessionIdRef.current = randomId();
  }, [reset, resetMultiModel]);

  useEffect(() => {
    if (!isCtUiModality(modality)) {
      setCtConfig(null);
    }
  }, [modality]);

  useEffect(() => {
    if (modality === "auto") setModality("xray");
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

  // Handle file drop/upload -> start analysis + save draft
  const handleFile = useCallback(
    (files: File[]) => {
      if (!consentGiven) {
        return;
      }
      if (modality === "ecg" && !ecgFormHasRequiredDemographics(ecgScannerContext.ecgForm)) {
        addToast("ECG: enter age and sex in section 1 before uploading.", "warning");
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
      const historyMod = analyzeModalityForApi ?? modality;
      addFiles(files, modality, notes || undefined, pctx, analyzeModalityForApi);
      saveHistoryDraft(files, historyMod, activePatientId);
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
    ]
  );

  // Multi-model copilot activation
  const handleActivateCopilot = useCallback(() => {
    activateCopilot(activePatientId);
  }, [activateCopilot, activePatientId]);

  const handleOpenOracleFromLabs = useCallback(() => {
    const unified = multiSession.unifiedResult;
    const useUnified = analysisMode === "multi" && unified;

    if (useUnified) {
      const reportMarkdown = formatUnifiedLabsReportForOracle(unified, activePatientId);
      storeOracleLabsHandoff({
        reportMarkdown,
        suggestedFollowUp: DEFAULT_ORACLE_FOLLOWUP_FROM_LABS,
        scanKind: "multi",
        labsModalityLabel: unified.modalities_analyzed?.join(", ") || "multi-modality",
        patientId: activePatientId,
        labsSessionId: sessionIdRef.current,
      });
      router.push(`/?mode=m5&domain=m5&${ORACLE_LABS_HANDOFF_QUERY}=1`);
      return;
    }

    if (!result) return;
    const reportMarkdown = formatSingleLabsReportForOracle(result, {
      uiModalityId: detectedModality ?? modality,
      patientId: activePatientId,
    });
    const st = result.structures;
    const isMedgemmaFlow =
      typeof st === "object" &&
      st !== null &&
      !Array.isArray(st) &&
      (st as Record<string, unknown>).medgemma_cxr_flow === true;
    storeOracleLabsHandoff({
      reportMarkdown,
      suggestedFollowUp: isMedgemmaFlow
        ? MEDGEMMA_ORACLE_FOLLOWUP_FROM_LABS
        : DEFAULT_ORACLE_FOLLOWUP_FROM_LABS,
      scanKind: "single",
      labsModalityLabel: modality,
      patientId: activePatientId,
      labsSessionId: sessionIdRef.current,
    });
    router.push(`/?mode=m5&domain=m5&${ORACLE_LABS_HANDOFF_QUERY}=1`);
  }, [
    analysisMode,
    multiSession.unifiedResult,
    result,
    detectedModality,
    modality,
    activePatientId,
    router,
  ]);

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
        className="scanner-layout"
        style={{
          flex: 1,
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
            flex: isDesktop ? "1 1 65%" : 1,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            padding: compact ? "8px 8px 80px 8px" : "16px 0 16px 16px",
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

          {modality === "xray" && analysisMode === "single" && (
            <div
              className="glass-panel"
              style={{
                padding: "10px 16px 12px",
                borderRadius: 0,
                borderTop: "1px solid rgba(255,255,255,0.06)",
                borderBottom: "none",
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 10,
                  cursor:
                    isScanning || stage === "medgemma_questions" || stage === "medgemma_finalizing"
                      ? "not-allowed"
                      : "pointer",
                  opacity:
                    isScanning || stage === "medgemma_questions" || stage === "medgemma_finalizing"
                      ? 0.55
                      : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={medgemmaChestEnabled}
                  disabled={
                    isScanning || stage === "medgemma_questions" || stage === "medgemma_finalizing"
                  }
                  onChange={(e) => setMedgemmaChestEnabled(e.target.checked)}
                  style={{ marginTop: 3 }}
                />
                <span className="font-body" style={{ fontSize: 12, color: "var(--text-70)", lineHeight: 1.5 }}>
                  <strong style={{ color: "var(--text-90)" }}>MedGemma chest (production)</strong>
                  — runs TorchXRayVision first, then MedGemma with your patient context, asks a few follow-up
                  questions, then generates the final report with Kimi. Patient context above is sent with the
                  image. Use &quot;Ask Manthana Oracle&quot; afterward for chat (Quick = concise model).
                </span>
              </label>
            </div>
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
                  imageUrl={imageUrl}
                  stage={stage}
                  zoom={zoom}
                  modality={modality}
                  acceptOverride={isCtUiModality(modality) ? ctFileAccept : undefined}
                  pro2dOnly={proLabs2dOnly}
                  dicomFiles={dicomFiles}
                  onMetadataExtracted={handleDicomMetadata}
                  heatmapUrl={result?.heatmap_url}
                  heatmapState={heatmapState}
                  onHeatmapStateChange={setHeatmapState}
                  findings={result?.findings}
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
                hasImage={!!imageUrl}
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

        {/* RIGHT: Intelligence Panel — on mobile becomes BottomSheet (tucks off-screen while consent scrolls) */}
        {compact ? (
          /* ── MOBILE/TABLET: Bottom Sheet ── */
          <BottomSheet
            peekHeight={72}
            tuckedOffScreen={!consentGiven && mobileFindingsTuckedForConsent}
            collapsedContent={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-display" style={{ fontSize: 10, color: "var(--text-55)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isMultiMode ? "✦ Multi-Model Analysis" : "Analysis Findings"}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: "var(--scan-400)" }}>
                  {stage === "complete" && result
                    ? `${result.findings.length} findings · ${Math.round(result.findings.reduce((s: number, f: Finding) => s + f.confidence, 0) / (result.findings.length || 1))}%`
                    : showMultiComplete
                    ? "Unified report ready"
                    : isScanning
                    ? "Analyzing…"
                    : "Swipe up to view"}
                </span>
              </div>
            }
          >
            {/* Content inside bottom sheet */}
            {!isMultiMode && (
              <IntelligencePanel
                stage={stage}
                result={result}
                detectedModality={detectedModality ?? undefined}
                analysisElapsedMs={analysisElapsedMs}
                onGenerateReport={() => {
                  patchEntry(sessionIdRef.current, { status: "report_generated" });
                }}
                onNewScan={handleNewScan}
                onRetry={handleRetry}
                onAskAI={handleOpenOracleFromLabs}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
                medgemmaQa={medgemmaQaPanel}
              />
            )}
            {showMultiComplete && multiSession.unifiedResult && (
              <UnifiedReportPanel
                unifiedResult={multiSession.unifiedResult}
                individualResults={multiSession.individualResults}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
                onAskAI={handleOpenOracleFromLabs}
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
              flex: "0 0 35%",
              maxWidth: 380,
              display: "flex",
              padding: 16,
              minWidth: 300,
            }}
          >
            {!isMultiMode && (
              <IntelligencePanel
                stage={stage}
                result={result}
                detectedModality={detectedModality ?? undefined}
                analysisElapsedMs={analysisElapsedMs}
                onGenerateReport={() => {
                  patchEntry(sessionIdRef.current, { status: "report_generated" });
                  console.log("Generate report", result);
                }}
                onNewScan={handleNewScan}
                onRetry={handleRetry}
                onAskAI={handleOpenOracleFromLabs}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
                medgemmaQa={medgemmaQaPanel}
              />
            )}
            {showMultiComplete && multiSession.unifiedResult && (
              <UnifiedReportPanel
                unifiedResult={multiSession.unifiedResult}
                individualResults={multiSession.individualResults}
                onGenerateReport={() => {
                  console.log("Generate unified report", multiSession.unifiedResult);
                }}
                onNewScan={handleNewScan}
                onAskAI={handleOpenOracleFromLabs}
              />
            )}
            {isMultiMode && !showMultiComplete && (
              <div
                className="intelligence-section glass-panel"
                style={{
                  width: "100%",
                  maxWidth: 380,
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
        />
      )}

      {/* ─── DISCLAIMER (hide on mobile — space taken by bottom sheet) ─── */}
      {!compact && <DisclaimerBar />}

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
