// Shared consent payload and types for DPDP logging.

export interface ConsentEvent {
  patient_id: string;
  purpose: string;
  consented: boolean;
  timestamp: string;
}

export function buildConsentPayload(
  patientId: string,
  purpose: string = "ai_radiology_analysis",
  consented: boolean = true,
  timestamp: string = new Date().toISOString()
): ConsentEvent {
  return {
    patient_id: patientId,
    purpose,
    consented,
    timestamp,
  };
}

