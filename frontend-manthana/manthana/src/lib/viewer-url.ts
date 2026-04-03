/**
 * Build safe in-app viewer links so search stays on Manthana origin (native feel).
 * Rejects javascript:, data:, etc.
 */
export function toViewerHref(rawUrl: string): string | null {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) return null;
  try {
    const u = new URL(trimmed);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return `/viewer?url=${encodeURIComponent(u.toString())}`;
  } catch {
    return null;
  }
}
