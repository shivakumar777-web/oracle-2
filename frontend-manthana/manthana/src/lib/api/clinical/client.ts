/**
 * Clinical section API client.
 * Drug interaction, herb-drug safety, clinical trials, ICD-10 suggestions.
 */

import { fetchWithAuth } from "../core/client";
import { ApiError } from "../core/errors";
import { ANALYSIS_BASE, CLINICAL_BASE } from "../config";
import type {
  DrugInteractionResult,
  HerbDrugResult,
  ClinicalTrialResult,
  ICD10Suggestion,
  SnomedConcept,
} from "@/types/clinical-tools";

/**
 * POST /drug-interaction/check — drug interaction check.
 */
export async function checkDrugInteraction(
  drugs: string[]
): Promise<DrugInteractionResult> {
  const res = await fetchWithAuth(`${CLINICAL_BASE}/drug-interaction/check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drugs }),
  });
  if (!res.ok) throw new Error("Drug interaction check failed");
  return res.json();
}

/**
 * POST /herb-drug/analyze — herb-drug safety analysis.
 */
export async function checkHerbDrugSafety(
  herb: string,
  drug: string
): Promise<HerbDrugResult> {
  const res = await fetchWithAuth(`${CLINICAL_BASE}/herb-drug/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ herb, drug }),
  });
  if (!res.ok) throw new Error("Herb-drug safety check failed");
  const envelope = await res.json();
  const data = envelope.data ?? envelope;
  return data as HerbDrugResult;
}

/**
 * POST /clinical-trials/search — clinical trials search.
 */
export async function findClinicalTrials(
  query: string,
  filters: { phase?: string; status?: string; country?: string; india_only?: boolean }
): Promise<ClinicalTrialResult[]> {
  const res = await fetchWithAuth(`${CLINICAL_BASE}/clinical-trials/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, filters }),
  });
  if (!res.ok) throw new Error("Clinical trials search failed");
  const envelope = await res.json();
  const data = envelope.data ?? envelope;
  return Array.isArray(data.trials) ? data.trials : [];
}

/**
 * GET /icd10/suggest — ICD-10 code suggestions.
 */
export async function suggestICD10(symptom: string): Promise<ICD10Suggestion[]> {
  const params = new URLSearchParams({ q: symptom });
  const res = await fetchWithAuth(`${CLINICAL_BASE}/icd10/suggest?${params.toString()}`);
  if (!res.ok) throw new Error("ICD-10 suggestion lookup failed");
  const data = await res.json();
  return Array.isArray(data) ? data : (data?.data ?? []);
}

/**
 * POST /interaction/check/enriched — Drug interaction with FDA data.
 */
export async function fetchEnrichedDrugInteraction(
  drugA: string,
  drugB: string
): Promise<Record<string, unknown>> {
  const res = await fetchWithAuth(`${CLINICAL_BASE}/interaction/check/enriched`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ drug_a: drugA, drug_b: drugB }),
  });
  if (!res.ok) throw new ApiError("Enriched interaction check failed.", res.status, "drug");
  const data = await res.json();
  return data.data ?? data;
}

/**
 * GET /snomed/lookup — SNOMED-CT concepts (routed via analysis gateway base).
 */
export async function fetchSnomedLookup(term: string): Promise<SnomedConcept[]> {
  const params = new URLSearchParams({ term });
  const res = await fetchWithAuth(`${ANALYSIS_BASE}/snomed/lookup?${params.toString()}`);
  if (!res.ok) throw new ApiError("SNOMED lookup failed.", res.status, "nlp");
  const data = await res.json();
  return data.data ?? data;
}
