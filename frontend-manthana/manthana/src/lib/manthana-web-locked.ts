/**
 * Feature flag: Manthana Web (medical search UI + web-service calls) is intentionally paused.
 * Set NEXT_PUBLIC_MANTHANA_WEB_LOCKED=true in production to show Coming Soon and block API calls.
 */

export function isManthanaWebLocked(): boolean {
  const v = process.env.NEXT_PUBLIC_MANTHANA_WEB_LOCKED;
  return v === "true" || v === "1";
}
