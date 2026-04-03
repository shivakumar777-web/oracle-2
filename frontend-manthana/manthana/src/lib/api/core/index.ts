/**
 * Core API utilities — shared by all section clients.
 */

export { ApiError } from "./errors";
export type { ApiEnvelope } from "./envelope";
export { fetchWithAuth, fetchApi, getAuthHeaders } from "./client";
