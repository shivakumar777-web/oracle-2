/**
 * Section-specific API URLs.
 * Falls back to unified NEXT_PUBLIC_API_URL when section-specific URL is not set.
 * Enables gradual migration to separated backends.
 *
 * Origins may be absolute (http://localhost:8100) or same-origin paths (/api/oracle-backend)
 * when using Next.js rewrites (required for remote/cloud dev: browser localhost ≠ API host).
 */

function normOrigin(v: string): string {
  return v.replace(/\/$/, "");
}

const UNIFIED_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
);
const UNIFIED_BASE = UNIFIED_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const ORACLE_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_ORACLE_API_URL ?? UNIFIED_ORIGIN
);
export const ORACLE_BASE = ORACLE_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const WEB_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_WEB_API_URL ?? UNIFIED_ORIGIN
);
export const WEB_BASE = WEB_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const RESEARCH_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? UNIFIED_ORIGIN
);
export const RESEARCH_BASE = RESEARCH_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const ANALYSIS_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_ANALYSIS_API_URL ?? UNIFIED_ORIGIN
);
export const ANALYSIS_BASE = ANALYSIS_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

export const CLINICAL_ORIGIN = normOrigin(
  process.env.NEXT_PUBLIC_CLINICAL_API_URL ?? UNIFIED_ORIGIN
);
export const CLINICAL_BASE = CLINICAL_ORIGIN + (process.env.NEXT_PUBLIC_API_VERSION ?? "/v1");

/** Legacy: unified API base for backward compatibility */
export const API_ORIGIN = UNIFIED_ORIGIN;
export const API_BASE = UNIFIED_BASE;
