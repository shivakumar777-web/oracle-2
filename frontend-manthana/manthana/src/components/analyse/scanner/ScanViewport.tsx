"use client";
import React, { useRef, useState, useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import type { ScanStage, Finding, HeatmapState, DicomViewportState, DicomMetadataType } from "@/lib/analyse/types";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";
import HeatmapOverlay from "./HeatmapOverlay";
import HeatmapControls from "./HeatmapControls";
import HeatmapLegend from "./HeatmapLegend";
import DicomToolbar from "./DicomToolbar";
import DicomMetadata from "./DicomMetadata";
import type { DicomViewportHandle } from "./DicomViewport";
import { WINDOWING_PRESETS } from "@/lib/analyse/windowingPresets";
import { getUploadAcceptTypes } from "@/lib/analyse/constants";

/* ── DicomViewport is client-only (WebGL). Dynamic import, SSR disabled ── */
const DicomViewport = dynamic(() => import("./DicomViewport"), { ssr: false });

/* ── Detect whether files are DICOM ── */
function detectDicom(files: File[]): boolean {
  return files.some(
    (f) =>
      f.name.toLowerCase().endsWith(".dcm") ||
      f.type === "application/dicom" ||
      f.name.toLowerCase().endsWith(".nii") ||
      f.name.toLowerCase().endsWith(".nii.gz")
  );
}

interface Props {
  onFileDrop: (files: File[]) => void;
  imageUrl: string | null;
  stage: ScanStage;
  zoom: number;
  modality?: string;
  /** When set, overrides `getUploadAcceptTypes(modality)` for the file input. */
  acceptOverride?: string;
  // DICOM
  dicomFiles?: File[];
  onMetadataExtracted?: (meta: DicomMetadataType) => void;
  // Heatmap
  heatmapUrl?: string | null;
  heatmapState?: HeatmapState;
  onHeatmapStateChange?: (state: HeatmapState) => void;
  findings?: Finding[];
}

const DEFAULT_DICOM_STATE: DicomViewportState = {
  windowState: { windowWidth: 400, windowCenter: 40, preset: "default" },
  seriesState: { currentIndex: 0, totalFrames: 1 },
  activeTool: "WindowLevel",
  mprMode: false,
};

export default function ScanViewport({
  onFileDrop,
  imageUrl,
  stage,
  zoom,
  modality,
  dicomFiles,
  onMetadataExtracted,
  heatmapUrl,
  heatmapState,
  onHeatmapStateChange,
  findings = [],
  acceptOverride,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const acceptTypes = acceptOverride ?? getUploadAcceptTypes(modality);
  const isLabReport = modality === "lab_report";

  const [dragOver, setDragOver] = useState(false);
  const [imgDimensions, setImgDimensions] = useState({ width: 512, height: 512 });
  const [dicomState, setDicomState] = useState<DicomViewportState>(DEFAULT_DICOM_STATE);
  const [dicomMeta, setDicomMeta] = useState<DicomMetadataType | null>(null);
  const [showDicomMeta, setShowDicomMeta] = useState(true);

  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const dicomViewportRef = useRef<DicomViewportHandle>(null);

  const isScanning = !["idle", "complete", "error"].includes(stage);
  const isComplete = stage === "complete";
  const isDicomMode = dicomFiles && dicomFiles.length > 0 && detectDicom(dicomFiles);
  const hasHeatmap = isComplete && (!!heatmapUrl || findings.length > 0);

  /* ── Reset DICOM state when new files arrive ── */
  useEffect(() => {
    if (isDicomMode) {
      setDicomState(DEFAULT_DICOM_STATE);
      setDicomMeta(null);
    }
  }, [isDicomMode, dicomFiles]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const files = Array.from(e.dataTransfer.files).filter((f) => f.size > 0);
      if (files.length > 0) onFileDrop(files);
    },
    [onFileDrop]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) onFileDrop(files);
      e.target.value = "";
    },
    [onFileDrop]
  );

  const handleCameraCapture = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) onFileDrop([file]);
      e.target.value = "";
    },
    [onFileDrop]
  );

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setImgDimensions({ width: img.naturalWidth, height: img.naturalHeight });
  }, []);

  const handleDicomMetadata = useCallback(
    (meta: DicomMetadataType) => {
      setDicomMeta(meta);
      onMetadataExtracted?.(meta);
    },
    [onMetadataExtracted]
  );

  /* ═══════════════════════════════════════════════════════════
     DROP ZONE — shown when no image/DICOM is loaded
     ═══════════════════════════════════════════════════════════ */
  const dropZone = (
    <div
      className={`drop-zone ${dragOver ? "dragover" : ""}`}
      onClick={() => fileRef.current?.click()}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: compact ? 12 : 20,
        margin: compact ? 8 : 16,
        minHeight: compact ? 180 : 380,
      }}
    >
      {/* Concentric scan rings */}
      <div style={{ position: "relative", width: compact ? 56 : 80, height: compact ? 56 : 80 }}>
        <div style={{ position: "absolute", inset: 0, border: "1px solid var(--scan-700)", borderRadius: "50%", animation: "pulse 3s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 12, border: "1px solid var(--scan-700)", borderRadius: "50%", animation: "pulse 3s 0.5s ease-in-out infinite" }} />
        <div style={{ position: "absolute", inset: 24, border: "1px solid var(--scan-500)", borderRadius: "50%", animation: "pulse 3s 1s ease-in-out infinite", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontSize: 20, color: "var(--scan-400)" }}>◎</span>
        </div>
      </div>

      <div style={{ textAlign: "center" }}>
        <p className="text-label" style={{ color: "var(--text-55)", marginBottom: 6 }}>
          {isLabReport ? "Drop lab report here" : "Drop medical images here"}
        </p>
        <p style={{ fontFamily: "var(--font-body)", fontSize: 12, fontStyle: "italic", color: "var(--text-30)" }}>
          {isLabReport
            ? "Upload a PDF, text, or CSV file of any lab report"
            : "DICOM (.dcm), JPEG, PNG, MP4 — supports multi-slice series"}
        </p>
      </div>

      <div style={{ display: "flex", flexDirection: compact ? "column" : "row", gap: compact ? 8 : 12, alignItems: "center" }}>
        <button type="button" className="btn-teal" style={{ fontSize: 11, padding: "8px 20px" }} onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
          {isLabReport ? "Browse Reports" : "Browse Files"}
        </button>
        {!isLabReport && (
          <button type="button" className="btn-ghost" style={{ border: "1px solid var(--glass-border)", borderRadius: "var(--r-sm)", padding: "8px 20px", fontSize: 11 }} onClick={(e) => { e.stopPropagation(); cameraRef.current?.click(); }}>
            Camera
          </button>
        )}
      </div>

      <p style={{ fontFamily: "var(--font-mono)", fontSize: 9, color: "var(--text-15)", letterSpacing: "0.1em", textTransform: "uppercase" }}>
        {isLabReport ? "PDF · TXT · CSV" : "DICOM · JPEG · PNG · NIfTI · EDF · MP4 · SVS"}
      </p>
    </div>
  );

  /* ═══════════════════════════════════════════════════════════
     DICOM VIEWER MODE
     ═══════════════════════════════════════════════════════════ */
  const dicomViewer = isDicomMode ? (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative" }}>
      {/* DICOM Toolbar at top */}
      <DicomToolbar
        viewportRef={dicomViewportRef}
        state={dicomState}
        onStateChange={setDicomState}
        hasImage={true}
      />

      {/* Cornerstone3D Canvas */}
      <div style={{ flex: 1, position: "relative", minHeight: compact ? 280 : 480 }}>
        <DicomViewport
          ref={dicomViewportRef}
          files={dicomFiles!}
          onStateChange={setDicomState}
          onMetadataExtracted={handleDicomMetadata}
          style={{ width: "100%", height: "100%" }}
        />

        {/* DICOM Metadata overlay */}
        <DicomMetadata metadata={dicomMeta} visible={showDicomMeta && !compact} />

        {/* Metadata toggle button */}
        <button
          onClick={() => setShowDicomMeta((v) => !v)}
          title="Toggle DICOM study info"
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            zIndex: 20,
            padding: "3px 7px",
            background: "rgba(0,0,0,0.55)",
            backdropFilter: "blur(8px)",
            border: "1px solid rgba(255,255,255,0.06)",
            borderRadius: 4,
            cursor: "pointer",
            color: showDicomMeta ? "var(--scan-400)" : "var(--text-30)",
            fontFamily: "var(--font-mono)",
            fontSize: 8,
            letterSpacing: "0.1em",
          }}
        >
          {showDicomMeta ? "INFO ▲" : "INFO ▼"}
        </button>

        {/* Heatmap on top of DICOM canvas */}
        {heatmapState?.visible && isComplete && (
          <HeatmapOverlay
            heatmapUrl={heatmapUrl || null}
            findings={findings}
            opacity={heatmapState.opacity}
            zoom={1}
            activeFindingIndex={heatmapState.activeFindingIndex}
            colorScheme={heatmapState.colorScheme}
            imageWidth={imgDimensions.width}
            imageHeight={imgDimensions.height}
          />
        )}

        {/* Heatmap Legend */}
        {heatmapState && <HeatmapLegend visible={heatmapState.visible} />}

        {/* Heatmap Controls */}
        {heatmapState && onHeatmapStateChange && (
          <HeatmapControls
            heatmapState={heatmapState}
            onChange={onHeatmapStateChange}
            findingsCount={findings.length}
            findings={findings}
            hasHeatmap={hasHeatmap}
          />
        )}

        {/* Corner brackets */}
        <div className="viewport-bracket bracket-tl" />
        <div className="viewport-bracket bracket-tr" />
        <div className="viewport-bracket bracket-bl" />
        <div className="viewport-bracket bracket-br" />
      </div>
    </div>
  ) : null;

  /* ═══════════════════════════════════════════════════════════
     STANDARD IMAGE VIEWER MODE
     ═══════════════════════════════════════════════════════════ */
  const imageViewer = !isDicomMode && imageUrl ? (
    <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", minHeight: compact ? 200 : 420, overflow: "hidden", position: "relative" }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt="Medical scan"
          onLoad={handleImageLoad}
          style={{
            maxWidth: "100%",
            maxHeight: 500,
            objectFit: "contain",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.3s var(--ease-out-expo)",
            filter: "contrast(1.05)",
          }}
        />
        {/* Heatmap overlay */}
        {heatmapState?.visible && isComplete && (
          <HeatmapOverlay
            heatmapUrl={heatmapUrl || null}
            findings={findings}
            opacity={heatmapState.opacity}
            zoom={zoom}
            activeFindingIndex={heatmapState.activeFindingIndex}
            colorScheme={heatmapState.colorScheme}
            imageWidth={imgDimensions.width}
            imageHeight={imgDimensions.height}
          />
        )}
      </div>

      {/* Corner brackets */}
      <div className="viewport-bracket bracket-tl" />
      <div className="viewport-bracket bracket-tr" />
      <div className="viewport-bracket bracket-bl" />
      <div className="viewport-bracket bracket-br" />

      {/* Scan animations */}
      {isScanning && <div className="scan-line" />}
      {stage === "analyzing" && <div className="scan-line-h" />}

      {/* Phase text */}
      {isScanning && (
        <div style={{ position: "absolute", bottom: 24, left: 0, right: 0, textAlign: "center", animation: "fadeIn 0.3s ease-out" }}>
          <span className="text-caption" style={{ color: "var(--scan-400)", background: "rgba(0,0,0,0.6)", padding: "6px 16px", borderRadius: "var(--r-full)", animation: "pulse 2s ease-in-out infinite", backdropFilter: "blur(8px)" }}>
            {stage === "received" && "IMAGE RECEIVED"}
            {stage === "detecting" && "DETECTING MODALITY…"}
            {stage === "routing" && "ROUTING TO AI SERVICE…"}
            {stage === "analyzing" && "ANALYSING PIXEL MATRIX…"}
            {stage === "heatmap" && "GENERATING ATTENTION MAP…"}
            {stage === "extracting" && "EXTRACTING FINDINGS…"}
          </span>
        </div>
      )}

      {/* Pixel grid during detection */}
      {stage === "detecting" && (
        <div style={{ position: "absolute", inset: 0, background: `repeating-linear-gradient(0deg, transparent, transparent 19px, rgba(0,196,176,0.03) 20px), repeating-linear-gradient(90deg, transparent, transparent 19px, rgba(0,196,176,0.03) 20px)`, animation: "fadeIn 0.5s ease-out", pointerEvents: "none" }} />
      )}

      {/* Complete glow */}
      {isComplete && (
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at center, rgba(200,146,42,0.1) 0%, transparent 70%)", animation: "fadeIn 0.8s ease-out forwards", pointerEvents: "none" }} />
      )}

      {/* Heatmap UI */}
      {heatmapState && <HeatmapLegend visible={heatmapState.visible} />}
      {heatmapState && onHeatmapStateChange && (
        <HeatmapControls
          heatmapState={heatmapState}
          onChange={onHeatmapStateChange}
          findingsCount={findings.length}
          findings={findings}
          hasHeatmap={hasHeatmap}
        />
      )}
    </div>
  ) : null;

  /* ═══════════════════════════════════════════════════════════
     RENDER
     ═══════════════════════════════════════════════════════════ */
  return (
    <div className="viewport-section" style={{ flex: 1, minWidth: 0 }}>
      <div
        className="viewport-frame"
        style={{ minHeight: compact ? 200 : 420, position: "relative", display: "flex", flexDirection: "column" }}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
      >
        {!imageUrl && !isDicomMode ? dropZone : null}
        {isDicomMode ? dicomViewer : imageViewer}

        <input ref={fileRef} type="file" accept={acceptTypes} multiple style={{ display: "none" }} onChange={handleFileChange} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={handleCameraCapture} />
      </div>
    </div>
  );
}
