/**
 * API response envelope — shared across all section clients.
 * Backend wraps responses in { status, service, data, error, request_id, timestamp }.
 * Version 1.0 — stable contract.
 */

export interface ApiEnvelope<T> {
  status: "success" | "error";
  service: string;
  data: T;
  error: string | null;
  request_id: string;
  timestamp: string;
}
