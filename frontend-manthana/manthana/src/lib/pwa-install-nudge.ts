/** localStorage: times user dismissed the PWA install nudge without installing */
export const PWA_NUDGE_COUNT_KEY = "manthana_pwa_nudge_count";
/** localStorage: user opted out of further nudges */
export const PWA_NUDGE_DISMISSED_KEY = "manthana_pwa_nudge_dismissed_forever";
export const MAX_PWA_NUDGES = 5;

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return nav.standalone === true;
}

/** Narrow viewport + touch-like interaction (reduces false positives on resized desktop windows). */
export function isMobileForPwaNudge(): boolean {
  if (typeof window === "undefined") return false;
  const narrow = window.matchMedia("(max-width: 768px)").matches;
  const touchLike =
    window.matchMedia("(pointer: coarse)").matches ||
    window.matchMedia("(hover: none)").matches;
  return narrow && touchLike;
}

export function isIosLike(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  return navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1;
}

export function readNudgeCount(): number {
  try {
    const v = localStorage.getItem(PWA_NUDGE_COUNT_KEY);
    const n = v ? parseInt(v, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function incrementNudgeCount(): number {
  const next = Math.min(MAX_PWA_NUDGES, readNudgeCount() + 1);
  try {
    localStorage.setItem(PWA_NUDGE_COUNT_KEY, String(next));
  } catch {
    /* ignore */
  }
  return next;
}

export function readDismissedForever(): boolean {
  try {
    return localStorage.getItem(PWA_NUDGE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function setDismissedForever(): void {
  try {
    localStorage.setItem(PWA_NUDGE_DISMISSED_KEY, "1");
  } catch {
    /* ignore */
  }
}

export function clearNudgeState(): void {
  try {
    localStorage.removeItem(PWA_NUDGE_COUNT_KEY);
    localStorage.removeItem(PWA_NUDGE_DISMISSED_KEY);
  } catch {
    /* ignore */
  }
}

export function shouldShowPwaNudge(): boolean {
  if (!isMobileForPwaNudge() || isStandalonePwa()) return false;
  if (readDismissedForever()) return false;
  return readNudgeCount() < MAX_PWA_NUDGES;
}
