/**
 * Canonical HTTPS origin for auth redirects (OAuth callback, post-login redirect).
 * Avoids landing on localhost when Supabase or the platform supplies an internal URL.
 */

const LOCAL = /^(localhost|127\.0\.0\.1)$/i;

function normalizeHost(host: string): string {
  return host.replace(/^www\./i, "").toLowerCase();
}

/** Server: use after OAuth exchange so Location header points at the real site on Vercel. */
export function publicSiteOriginFromRequest(request: Request): string {
  const envRaw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (envRaw) {
    try {
      const u = new URL(envRaw);
      if (!LOCAL.test(u.hostname)) {
        return u.origin;
      }
    } catch {
      /* ignore */
    }
  }

  const xfHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const xfProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (xfHost && !LOCAL.test(xfHost.split(":")[0] ?? "")) {
    const proto =
      xfProto === "http" || xfProto === "https" ? xfProto : "https";
    return `${proto}://${xfHost}`;
  }

  return new URL(request.url).origin;
}

/** Client: OAuth redirect_to must match an allowed URL in Supabase; prefer canonical env on prod. */
export function browserOAuthOrigin(): string {
  if (typeof window === "undefined") return "";

  const current = window.location.origin;
  const envRaw = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (!envRaw) return current;

  try {
    const u = new URL(envRaw);
    if (LOCAL.test(u.hostname)) return current;
    if (normalizeHost(u.hostname) === normalizeHost(window.location.hostname)) {
      return u.origin;
    }
  } catch {
    /* ignore */
  }

  return current;
}
