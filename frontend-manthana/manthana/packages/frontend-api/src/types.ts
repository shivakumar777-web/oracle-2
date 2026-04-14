// Canonical frontend TypeScript types for Manthana gateway/report_assembly.
// Derived from manthana-backend/gateway/schemas.py and related services.

export type Severity = "critical" | "warning" | "info" | "clear";

export type ReportLanguage =
  | "en"
  | "hi"
  | "ta"
  | "te"
  | "kn"
  | "ml"
  | "mr"
  | "bn"
  | "gu"
  | "pa";

export interface ReportResponse {
  narrative: string;
  impression: string;
  pdf_url?: string;
  language: ReportLanguage;
  language_fallback?: boolean;
  model_used?: string;
}

export interface Finding {
  label: string;
  severity: Severity;
  confidence: number;
  region?: string;
  description?: string;
  heatmap_url?: string;
}

export interface AnalysisResponse {
  job_id: string;
  modality: string;
  detected_region?: string;
  findings: Finding[];
  impression: string;
  pathology_scores: Record<string, number>;
  structures: string[] | Record<string, unknown>;
  confidence?: string | number;
  heatmap_url?: string;
  processing_time_sec: number;
  models_used: string[];
  disclaimer: string;
  ensemble_agreement?: number;
  analysis_depth?: "triage" | "deep";
  labs?: Record<string, unknown>;
  structured?: Record<string, unknown>;
  parser_used?: string;
  critical_values?: string[];
}

export interface JobStatus {
  job_id: string;
  status: "queued" | "processing" | "complete" | "failed" | "error";
  position?: number;
  progress?: number;
  result?: unknown;
  error?: string;
}

export interface ServiceHealth {
  id: string;
  name: string;
  status: "online" | "offline" | "degraded" | "unknown" | "healthy" | "unhealthy";
  latency_ms: number | null;
  port?: number;
}

export interface PatientContext {
  age?: number;
  sex?: "M" | "F" | "Other";
  urgency?: "routine" | "urgent" | "emergency";
  clinicalHistory?: string;
}

export interface ScanCase {
  id: string;
  timestamp: number;
  images: ScanImage[];
  activeImageIdx: number;
  modality: string;
  patientContext?: PatientContext;
  result?: AnalysisResponse;
  status: "idle" | "scanning" | "complete" | "error";
}

export interface ScanImage {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  errorMessage?: string;
}

export type ScanStage =
  | "idle"
  | "received"
  | "detecting"
  | "routing"
  | "analyzing"
  | "heatmap"
  | "extracting"
  /** DeepSeek pre-validation: analyzing image before GPU inference. */
  | "pre_validating"
  /** DeepSeek pre-validation: waiting for user confirmation to proceed. */
  | "awaiting_ai_confirmation"
  /** Chest X-ray MedGemma flow: TXRV done; waiting for user answers / skip. */
  | "medgemma_questions"
  /** Final Kimi narrative generation after Q&A. */
  | "medgemma_finalizing"
  | "complete"
  | "error";

/** One image in the multi-scan analyse UI (`useAnalysis`). */
export interface ImageScan {
  id: string;
  file: File;
  url: string;
  stage: ScanStage;
  detectedModality: string | null;
  result: AnalysisResponse | null;
  /** User-facing error when `stage` is `"error"`. */
  error?: string;
  clinicalNotes?: string;
  patientContext?: Record<string, unknown>;
  /** Gateway modality override (e.g. chest_ct while UI shows ct). */
  analyzeModalityForApi?: string;
  /** When true (set for X-ray uploads), run TXRV-only then MedGemma Q&A + Kimi final report. */
  useMedgemmaChest?: boolean;
  medgemmaSessionId?: string;
  medgemmaQuestions?: Array<{ id: string; question: string; why_needed?: string }>;
  medgemmaDraft?: {
    impression_draft?: string;
    key_observations?: unknown[];
    uncertainties?: unknown[];
    safety_flags?: unknown[];
  };
}

export interface Modality {
  id: string;
  label: string;
  icon: string;
  port: number;
  description: string;
  models: string[];
  /** Premium / hospital-grade product row (e.g. VISTA-3D CT). */
  premium?: boolean;
  tier?: "free" | "pro" | "proplus" | "premium" | "enterprise";
  multiStep?: boolean;
  strict3D?: boolean;
  /** 95-modality orchestration group (xray, ct, mri, …). */
  group?: string;
  /** Accepted file types for uploads (UI hint). */
  inputFormats?: string[];
  /** Routed via /ai/* orchestration instead of legacy /analyze GPU services. */
  orchestrationOnly?: boolean;
}

export type AnalysisMode = "single" | "multi";

export interface MultiModelUpload {
  modality: string;
  files: File[];
  urls: string[];
  uploaded: boolean;
}

export interface MultiModelResult {
  modality: string;
  result: AnalysisResponse;
}

export type MultiModelStage =
  | "selecting"
  | "uploading"
  | "confirming"
  | "processing"
  | "unifying"
  | "complete"
  | "error";

export interface MultiModelSession {
  id: string;
  selectedModalities: string[];
  uploads: MultiModelUpload[];
  copilotActivated: boolean;
  individualResults: MultiModelResult[];
  unifiedResult: UnifiedAnalysisResult | null;
  stage: MultiModelStage;
  currentProcessingIndex: number;
  errorMessage?: string;
}

export interface CorrelationFinding {
  pattern: string;
  confidence: number;
  clinical_significance: string;
  matching_modalities: string[];
  action: string;
}

export interface UnifiedAnalysisResult {
  patient_id: string;
  modalities_analyzed: string[];
  individual_reports: {
    modality: string;
    impression: string;
    findings_summary: string;
  }[];
  unified_diagnosis: string;
  unified_findings: string;
  risk_assessment: string;
  treatment_recommendations: string;
  prognosis: string;
  cross_modality_correlations: string;
  confidence: string;
  models_used: string[];
  processing_time_sec: number;
  correlations?: CorrelationFinding[];
}

export interface StructuredReportSection {
  title: string;
  content: string;
}

export interface StructuredReportData {
  standard: string;
  version: string;
  categoryCode: string;
  categoryLabel: string;
  categoryDescription: string;
  risk: string;
  recommendation: string;
  severity: Severity;
  scoringBasis: string;
  sections: StructuredReportSection[];
}

export type HeatmapColorScheme = "jet" | "inferno" | "viridis";

export interface HeatmapState {
  visible: boolean;
  opacity: number;
  activeFindingIndex: number | null;
  colorScheme: HeatmapColorScheme;
}

export type ViewerMode = "image" | "dicom";

export interface DicomWindowState {
  windowWidth: number;
  windowCenter: number;
  preset: string;
}

export interface DicomSeriesState {
  currentIndex: number;
  totalFrames: number;
  sliceLocation?: number;
}

export type DicomActiveTool =
  | "WindowLevel"
  | "Zoom"
  | "Pan"
  | "Length"
  | "EllipticalROI"
  | "RectangleROI"
  | "Angle"
  | "Magnify"
  | "Eraser";

export interface DicomViewportState {
  windowState: DicomWindowState;
  seriesState: DicomSeriesState;
  activeTool: DicomActiveTool;
  mprMode: boolean;
}

export interface DicomMetadataType {
  patientName?: string;
  patientId?: string;
  patientAge?: string;
  patientSex?: string;
  studyDate?: string;
  studyDescription?: string;
  institutionName?: string;
  modality?: string;
  seriesDescription?: string;
  sliceThickness?: string;
  pixelSpacing?: string;
  instanceNumber?: string;
  seriesCount?: string;
  sliceLocation?: string;
  bodyPartExamined?: string;
}

export interface PacsStudy {
  orthanc_id: string;
  study_instance_uid: string;
  patient_name?: string;
  patient_id?: string;
  patient_age?: string;
  patient_sex?: string;
  study_date?: string;
  study_description?: string;
  modality?: string;
  body_part?: string;
  institution?: string;
  series_count: number;
  instance_count: number;
  ai_status?: string | null;
  ai_job_id?: string | null;
}

export interface PacsSeries {
  id: string;
  series_instance_uid: string;
  modality?: string;
  series_description?: string;
  instance_count: number;
}

export interface WorklistItem {
  id?: string;
  patient_name: string;
  patient_id: string;
  accession_number?: string;
  modality: string;
  scheduled_date: string;
  scheduled_time?: string;
  scheduled_aet?: string;
  procedure_description?: string;
  referring_physician?: string;
  status: "SCHEDULED" | "IN_PROGRESS" | "COMPLETED";
}

export interface PacsModality {
  name: string;
  aet: string;
  host: string;
  port: number;
  manufacturer?: string;
}

export interface PacsConfig {
  orthanc_version: string;
  dicom_aet: string;
  dicom_port: number;
  plugins: string[];
  studies_count: number;
  modalities: Record<string, unknown>;
}

/** 95-modality AI orchestration — interrogator questions */
export interface InterrogatorQuestion {
  id: string;
  text: string;
  type: "text" | "select" | "boolean";
  options?: string[];
}

/** Structured interpreter report (JSON) */
export interface StructuredReportFinding {
  location: string;
  description: string;
  measurement?: string;
  significance: string;
}

export interface DiagnosisWithConfidence {
  name: string;
  confidence_pct: number;
  icd10?: string;
  evidence?: string;
  reasoning?: string;
}

export interface NextStepItem {
  action: string;
  priority: "immediate" | "soon" | "routine";
  reasoning: string;
}

export interface ResearchReferenceLink {
  title: string;
  journal: string;
  year: number;
  url: string;
  relevance: string;
}

export interface ClinicalCorrelationBlock {
  supports_history: string;
  contradicts_history: string;
  additional_context_needed: string;
}

/** Optional modality- or case-specific blocks from the interpreter (2–5 typical). */
export interface DynamicReportSection {
  id: string;
  title: string;
  body: string;
  emphasis?: "info" | "clinical" | "technical";
}

export interface AIInterpretationReport {
  findings: {
    primary: StructuredReportFinding[];
    secondary: StructuredReportFinding[];
    negative_pertinents: string[];
  };
  impressions: {
    primary_diagnosis: DiagnosisWithConfidence;
    differentials: DiagnosisWithConfidence[];
  };
  severity: {
    level: "critical" | "urgent" | "moderate" | "incidental";
    triage_action: string;
    time_sensitivity: "immediate" | "24h" | "1week" | "routine";
  };
  clinical_correlation: ClinicalCorrelationBlock;
  next_steps: NextStepItem[];
  research_references: ResearchReferenceLink[];
  indian_clinical_notes: string;
  models_used: string[];
  disclaimer: string;
  /** AI-generated extra sections (omit if gateway does not emit yet). */
  dynamic_sections?: DynamicReportSection[];
}

export type AIOrchestrationStage =
  | "idle"
  | "uploading"
  | "detecting"
  | "interrogating"
  | "answering_questions"
  | "interpreting"
  | "report_ready"
  | "error";

export interface DetectModalityResult {
  modality_key: string;
  confidence: number;
  group?: string;
  reason?: string;
  model_used?: string;
}

export interface InterrogateResult {
  session_id: string;
  questions: InterrogatorQuestion[];
  model_used?: string;
  modality_key: string;
}

export interface InterpretResult {
  report: AIInterpretationReport;
  model_used?: string;
  web_search_enabled?: boolean;
  usage?: Record<string, unknown>;
}

/** UI grouping for ModalityBar */
export interface ModalityGroupDef {
  id: string;
  label: string;
  icon: string;
  modalities: Modality[];
}
