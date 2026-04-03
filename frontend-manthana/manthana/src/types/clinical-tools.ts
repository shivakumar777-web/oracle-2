export interface DrugInteractionResult {
  drugs: string[];
  interactions: {
    drug1: string;
    drug2: string;
    severity:
      | "none"
      | "mild"
      | "moderate"
      | "severe"
      | "contraindicated";
    mechanism: string;
    clinicalEffect: string;
    recommendation: string;
    reference?: string;
  }[];
  overallRisk: "safe" | "caution" | "avoid";
}

export interface HerbDrugResult {
  herb: string;
  drug: string;
  safetyLevel: "safe" | "caution" | "avoid";
  mechanism: string;
  clinicalNotes: string;
  ayurvedicContext?: string | string[];
  reference?: string;
  herb_info?: Record<string, unknown>;
  interaction?: {
    severity?: string;
    evidence_level?: string;
    mechanism?: string;
    citations?: { pmid?: string; title?: string; url?: string }[];
    recommendation?: string;
  };
  data_sources?: string[];
  disclaimer?: string;
}

export interface ClinicalTrialResult {
  nctId: string;
  title: string;
  status: string;
  phase: string;
  condition: string;
  intervention: string;
  sponsor: string;
  startDate: string;
  completionDate?: string;
  enrollmentCount?: number;
  url: string;
}

export interface ICD10Suggestion {
  code: string;
  description: string;
  category: string;
  confidence: number;
}

/** SNOMED-CT concept (from gateway /snomed/lookup). */
export interface SnomedConcept {
  conceptId: string;
  preferredTerm: string;
}

