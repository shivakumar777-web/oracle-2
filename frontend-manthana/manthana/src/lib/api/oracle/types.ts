/**
 * Oracle section — request/response types for chat and M5.
 */

export interface ChatModes {
  intensity: "auto" | "quick" | "clinical" | "deep";
  persona: "auto" | "patient" | "clinician" | "researcher" | "student";
  evidence: "auto" | "gold" | "all" | "guidelines" | "trials";
  enable_web?: boolean;
  enable_trials?: boolean;
}

export interface StreamSource {
  id: string;
  title: string;
  url: string;
  trustScore?: number;
  source?: string;
}

export interface ChatResponse {
  response: string;
  sources?: { title: string; url: string; domain: string }[];
  model?: string;
  tokens_used?: number;
}

export interface M5DomainAnswer {
  domain: string;
  domain_name: string;
  icon: string;
  color: string;
  tagline: string;
  content: string;
  sources: { title: string; url: string; trustScore: number; _source: string }[];
  confidence: number;
  key_concepts: string[];
  treatment_approach: string;
  evidence_level: string;
}

export interface M5Summary {
  content: string;
}
