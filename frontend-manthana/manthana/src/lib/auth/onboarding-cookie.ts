/** Cookie set when user finishes or skips intro — middleware uses it to route `/` → sign-in vs `/welcome`. */
export const ONBOARDING_COOKIE = "manthana_onboarding_done";

export const ONBOARDING_COOKIE_MAX_AGE = 60 * 60 * 24 * 400; // ~400 days

/** Client-side set (aligns with `/auth/callback` server cookie: `Secure` on HTTPS). */
export function setOnboardingCookieClient(): void {
  if (typeof document === "undefined") return;
  const secure =
    typeof window !== "undefined" && window.location.protocol === "https:";
  document.cookie = `${ONBOARDING_COOKIE}=1; path=/; max-age=${ONBOARDING_COOKIE_MAX_AGE}; SameSite=Lax${
    secure ? "; Secure" : ""
  }`;
}
