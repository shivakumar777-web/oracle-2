/**
 * Section-specific API URLs.
 * Falls back to unified NEXT_PUBLIC_API_URL when section-specific URL is not set.
 * Enables gradual migration to separated backends.
 */

const UNIFIED_ORIGIN = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
const UNIFIED_BASE = UNIFIED_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const ORACLE_ORIGIN =
  (process.env.NEXT_PUBLIC_ORACLE_API_URL ?? UNIFIED_ORIGIN).replace(/\/$/, "");
export const ORACLE_BASE = ORACLE_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const WEB_ORIGIN =
  (process.env.NEXT_PUBLIC_WEB_API_URL ?? UNIFIED_ORIGIN).replace(/\/$/, "");
export const WEB_BASE = WEB_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const RESEARCH_ORIGIN =
  (process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? UNIFIED_ORIGIN).replace(/\/$/, "");
export const RESEARCH_BASE = RESEARCH_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const ANALYSIS_ORIGIN =
  (process.env.NEXT_PUBLIC_ANALYSIS_API_URL ?? UNIFIED_ORIGIN).replace(/\/$/, "");
export const ANALYSIS_BASE = ANALYSIS_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const CLINICAL_ORIGIN =
  (process.env.NEXT_PUBLIC_CLINICAL_API_URL ?? UNIFIED_ORIGIN).replace(/\/$/, "");
export const CLINICAL_BASE = CLINICAL_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

/** Legacy: unified API base for backward compatibility */
export const API_ORIGIN = UNIFIED_ORIGIN;
export const API_BASE = UNIFIED_BASE;
