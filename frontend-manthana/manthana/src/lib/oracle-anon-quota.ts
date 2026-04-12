const DAY_KEY = "manthana_oracle_anon_day";
const USED_KEY = "manthana_oracle_anon_used";

/**
 * Client-only daily cap for signed-out Oracle use (production).
 * Returns false when the cap is already reached.
 */
export function tryConsumeAnonymousOracleSlot(cap: number): boolean {
  if (typeof window === "undefined") return true;
  const today = new Date().toISOString().slice(0, 10);
  const storedDay = localStorage.getItem(DAY_KEY);
  if (storedDay !== today) {
    localStorage.setItem(DAY_KEY, today);
    localStorage.setItem(USED_KEY, "0");
  }
  const used = parseInt(localStorage.getItem(USED_KEY) || "0", 10);
  if (!Number.isFinite(used) || used >= cap) return false;
  localStorage.setItem(USED_KEY, String(used + 1));
  return true;
}
