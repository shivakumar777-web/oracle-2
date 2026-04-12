/**
 * Prevent open redirects: only allow same-origin relative paths.
 */
export function safeInternalPath(raw: string | null | undefined, fallback = "/"): string {
  if (raw == null || typeof raw !== "string") return fallback;
  const t = raw.trim();
  if (!t.startsWith("/") || t.startsWith("//") || t.includes("\\")) return fallback;
  return t;
}
