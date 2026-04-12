// Shared TypeScript models and API client for Manthana frontends.
// This module is the single source of truth for gateway/report_assembly
// contracts as seen by the frontend apps.

// Types
export type {
  Severity,
  ReportLanguage,
  ReportResponse,
  Finding,
  AnalysisResponse,
  JobStatus,
  ServiceHealth,
  PatientContext,
  ScanCase,
  ScanImage,
  ScanStage,
  ImageScan,
  Modality,
  AnalysisMode,
  MultiModelUpload,
  MultiModelResult,
  MultiModelStage,
  MultiModelSession,
  CorrelationFinding,
  UnifiedAnalysisResult,
  StructuredReportSection,
  StructuredReportData,
  HeatmapColorScheme,
  HeatmapState,
  ViewerMode,
  DicomWindowState,
  DicomSeriesState,
  DicomActiveTool,
  DicomViewportState,
  DicomMetadataType,
  PacsStudy,
  PacsSeries,
  WorklistItem,
  PacsModality,
  PacsConfig,
} from "./types";

// API surface
export * from "./client";

export {};
