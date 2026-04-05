"use client";
import React, { useState, useEffect, useCallback, useRef } from "react";
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
import PatientContextForm from "@/components/analyse/shared/PatientContextForm";
import { ConsentGate } from "@/components/analyse/shared/ConsentGate";
import MultiModelSelector from "@/components/analyse/scanner/MultiModelSelector";
import { authClient } from "@/lib/auth-client";
import MultiModelUploadWizard from "@/components/analyse/scanner/MultiModelUploadWizard";
import MultiModelProgress from "@/components/analyse/scanner/MultiModelProgress";
import CopilotActivation from "@/components/analyse/scanner/CopilotActivation";
import BottomSheet from "@/components/analyse/shared/BottomSheet";
import { useAnalysis } from "@/hooks/analyse/useAnalysis";
import { useMultiModelAnalysis } from "@/hooks/analyse/useMultiModelAnalysis";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import { saveEntry, patchEntry } from "@/lib/analyse/history";
import type { HistoryEntry } from "@/lib/analyse/history";
import type { AnalysisMode, HeatmapState, DicomMetadataType } from "@/lib/analyse/types";
import {
  buildClinicalNotesForApi,
  buildPatientContextJsonForApi,
} from "@/lib/analyse/clinical-notes";
import { getUploadAcceptTypes } from "@/lib/analyse/constants";
import { askCoPilot } from "@/lib/analyse/api";
import {
  buildCtPatientContextJson,
  gatewayModalityForCtRegion,
  type CtWizardState,
  isCtProductModality,
  ctBodyRegionForProductModality,
} from "@/lib/analyse/ct-upload-wizard";
import { randomId } from "@/lib/analyse/random-id";
import dynamic from "next/dynamic";

const isCtUiModality = (m: string) => m === "ct" || isCtProductModality(m);

const PacsBrowser = dynamic(() => import("@/components/analyse/pacs/PacsBrowser"), { ssr: false });
const WorklistPanel = dynamic(() => import("@/components/analyse/pacs/WorklistPanel"), { ssr: false });
const PacsSettings = dynamic(() => import("@/components/analyse/pacs/PacsSettings"), { ssr: false });

export default function ScannerPage() {
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
  const router = useRouter();

  // ── Better Auth Session ──
  const { data: session, isPending: sessionLoading } = authClient.useSession();
  const isAuthenticated = !!session?.user;

  const [cmdOpen, setCmdOpen] = useState(false);
  const [scanNumber, setScanNumber] = useState(1);
  const [patientCtx, setPatientCtx] = useState({
    patientId: "ANONYMOUS-001",
    age: "",
    gender: "",
    location: "",
    tobaccoUse: "",
    fastingStatus: "unknown",
    medications: "",
  });
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("single");
  const [heatmapState, setHeatmapState] = useState<HeatmapState>({
    visible: false,
    opacity: 0.6,
    activeFindingIndex: null,
    colorScheme: "jet",
  });
  const [dicomFiles, setDicomFiles] = useState<File[]>([]);
  /** CT flow: wizard output + optional scanner calibration (sent in patient_context_json). */
  const [ctConfig, setCtConfig] = useState<CtWizardState | null>(null);
  const [pacsOpen, setPacsOpen] = useState(false);
  const [pacsTab, setPacsTab] = useState<"studies" | "worklist" | "settings">("studies");
  const { isMobile, isTablet, isDesktop } = useMediaQuery();
  const compact = isMobile || isTablet;
  const isScanning = !["idle", "complete", "error"].includes(stage);

  const [consentGiven, setConsentGiven] = useState(false);
  const [copilotQuestion, setCopilotQuestion] = useState<string | null>(null);
  const [copilotAnswer, setCopilotAnswer] = useState<string | null>(null);
  const [copilotLoading, setCopilotLoading] = useState(false);
  const [copilotError, setCopilotError] = useState<string | null>(null);

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
    setCopilotQuestion(null);
    setCopilotAnswer(null);
    setCopilotError(null);
    sessionIdRef.current = randomId();
  }, [reset, resetMultiModel]);

  useEffect(() => {
    if (!isCtUiModality(modality)) {
      setCtConfig(null);
    }
  }, [modality]);

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
        (worst, f) =>
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
      const notes = buildClinicalNotesForApi(patientCtx);
      let pctx: Record<string, unknown> | undefined;
      if (modality === "dermatology") {
        pctx = buildPatientContextJsonForApi(patientCtx);
      } else if (isCtUiModality(modality) && ctConfig) {
        const base = buildPatientContextJsonForApi(patientCtx);
        const lockedWizard = {
          ...ctConfig,
          region: isCtProductModality(modality)
            ? ctBodyRegionForProductModality(modality)
            : ctConfig.region,
        };
        pctx = buildCtPatientContextJson(base, lockedWizard, files);
      }
      return { notes, pctx };
    },
    [modality, ctConfig, patientCtx]
  );

  const showCtWizard =
    isCtUiModality(modality) && !ctConfig && images.length === 0 && stage === "idle";

  const ctFileAccept =
    isCtUiModality(modality) && ctConfig && ctConfig.upload_path === "image"
      ? "image/jpeg,image/png,.jpg,.jpeg,.png"
      : getUploadAcceptTypes(isCtUiModality(modality) ? "ct_abdomen" : modality);

  // Handle file drop/upload -> start analysis + save draft
  const handleFile = useCallback(
    (files: File[]) => {
      if (!isAuthenticated || !consentGiven) {
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
      saveHistoryDraft(files, historyMod, patientCtx.patientId);
    },
    [addFiles, modality, ctConfig, resolveAnalysisParams, saveHistoryDraft, patientCtx.patientId, isAuthenticated, consentGiven]
  );

  // Auto-fill patient context from DICOM metadata
  const handleDicomMetadata = useCallback((meta: DicomMetadataType) => {
    setPatientCtx((prev) => ({
      ...prev,
      age: meta.patientAge ? meta.patientAge.replace(/\D/g, "") : prev.age,
      gender: meta.patientSex === "M" ? "male" : meta.patientSex === "F" ? "female" : prev.gender,
    }));
  }, []);

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
        if (!isAuthenticated || !consentGiven) {
          e.target.value = "";
          return;
        }
        const { notes, pctx } = resolveAnalysisParams(files);
        const analyzeModalityForApi =
          modality === "ct" && ctConfig ? gatewayModalityForCtRegion(ctConfig.region) : undefined;
        const historyMod = analyzeModalityForApi ?? modality;
        addFiles(files, modality, notes || undefined, pctx, analyzeModalityForApi);
        saveHistoryDraft(files, historyMod, patientCtx.patientId);
      }
      e.target.value = "";
    },
    [addFiles, modality, ctConfig, resolveAnalysisParams, saveHistoryDraft, patientCtx.patientId, isAuthenticated, consentGiven]
  );

  const handleCameraChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        if (!isAuthenticated || !consentGiven) {
          e.target.value = "";
          return;
        }
        const { notes, pctx } = resolveAnalysisParams([file]);
        const analyzeModalityForApi =
          modality === "ct" && ctConfig ? gatewayModalityForCtRegion(ctConfig.region) : undefined;
        const historyMod = analyzeModalityForApi ?? modality;
        addFiles([file], modality, notes || undefined, pctx, analyzeModalityForApi);
        saveHistoryDraft([file], historyMod, patientCtx.patientId);
      }
      e.target.value = "";
    },
    [addFiles, modality, ctConfig, resolveAnalysisParams, saveHistoryDraft, patientCtx.patientId, isAuthenticated, consentGiven]
  );

  // Multi-model copilot activation
  const handleActivateCopilot = useCallback(() => {
    activateCopilot(patientCtx.patientId);
  }, [activateCopilot, patientCtx.patientId]);

  const handleAskAI = useCallback(async () => {
    if (!result) return;
    const q =
      copilotQuestion && copilotQuestion.trim().length > 0
        ? copilotQuestion.trim()
        : "Summarise the key imaging findings and impression for this case in plain language for a referring clinician.";
    setCopilotLoading(true);
    setCopilotError(null);
    try {
      const answer = await askCoPilot(q, result);
      setCopilotAnswer(answer);
      setCopilotQuestion(q);
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "AI Co-Pilot is temporarily unavailable.";
      setCopilotError(msg);
    } finally {
      setCopilotLoading(false);
    }
  }, [result, copilotQuestion]);

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
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ─── LOADING STATE ─── */}
      {sessionLoading && (
        <div className="fixed inset-0 bg-[#020610] flex items-center justify-center z-50">
          <div className="text-cream/50">Loading...</div>
        </div>
      )}

      {/* ─── NOT AUTHENTICATED (middleware handles redirect, this is fallback) ─── */}
      {!sessionLoading && !isAuthenticated && (
        <div className="fixed inset-0 bg-[#020610] flex items-center justify-center z-50">
          <div className="text-center">
            <p className="text-cream/70 mb-4">Please sign in to access Manthana Labs</p>
            <button
              onClick={() => router.push("/sign-in?callbackUrl=/analyse")}
              className="py-3 px-6 rounded-lg font-ui text-sm tracking-[0.15em] uppercase bg-gold/20 border border-gold/40 text-gold-h hover:bg-gold/30 hover:border-gold/60 transition-all"
            >
              Sign In
            </button>
          </div>
        </div>
      )}

      {/* ─── CONSENT GATE ─── */}
      {isAuthenticated && !consentGiven && (
        <ConsentGate
          onAccept={(pid) => {
            setConsentGiven(true);
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
            <PatientContextForm
              scanNumber={scanNumber}
              onContextChange={setPatientCtx}
              analysisMode={analysisMode}
              onAnalysisModeChange={handleModeChange}
              modality={modality}
            />
          </div>

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
                dicomFiles={dicomFiles}
                onMetadataExtracted={handleDicomMetadata}
                heatmapUrl={result?.heatmap_url}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
                findings={result?.findings}
              />
              )}
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
                accept={isCtUiModality(modality) ? ctFileAccept : getUploadAcceptTypes(modality)}
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

        {/* RIGHT: Intelligence Panel — on mobile becomes BottomSheet */}
        {compact ? (
          /* ── MOBILE/TABLET: Bottom Sheet ── */
          <BottomSheet
            peekHeight={72}
            collapsedContent={
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span className="font-display" style={{ fontSize: 10, color: "var(--text-55)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  {isMultiMode ? "✦ Multi-Model Analysis" : "Analysis Findings"}
                </span>
                <span className="font-mono" style={{ fontSize: 9, color: "var(--scan-400)" }}>
                  {stage === "complete" && result
                    ? `${result.findings.length} findings · ${Math.round(result.findings.reduce((s, f) => s + f.confidence, 0) / (result.findings.length || 1))}%`
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
                onAskAI={handleAskAI}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
              />
            )}
            {showMultiComplete && multiSession.unifiedResult && (
              <UnifiedReportPanel
                unifiedResult={multiSession.unifiedResult}
                individualResults={multiSession.individualResults}
                onGenerateReport={() => {}}
                onNewScan={handleNewScan}
                onAskAI={handleAskAI}
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
                onAskAI={handleAskAI}
                heatmapState={heatmapState}
                onHeatmapStateChange={setHeatmapState}
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
                onAskAI={handleAskAI}
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
