/**
 * Next.js Middleware — Supabase session + auth gate for production.
 * Oracle and app routes require sign-in; intro lives on /welcome then cookie → /sign-in.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { ONBOARDING_COOKIE } from "@/lib/auth/onboarding-cookie";

const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth/callback",
  "/welcome",
  "/api/razorpay/webhook",
  "/api/supabase/auth-send-email",
  "/_next",
  "/static",
  "/favicon.ico",
  "/manifest.json",
  "/sw.js",
  "/offline.html",
  "/icons",
  "/logo",
  "/assets",
  "/images",
  "/fonts",
  "/about",
  "/pricing",
  "/contact",
];

const PREMIUM_ROUTES = ["/research", "/clinical", "/web", "/oracle"];

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => pathname.startsWith(route));
}

function copyCookies(from: NextResponse, to: NextResponse) {
  from.cookies.getAll().forEach((c) => {
    to.cookies.set(c.name, c.value, c);
  });
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const { supabaseResponse, user } = await updateSession(request);

  const redirectWithSession = (url: URL) => {
    const res = NextResponse.redirect(url);
    copyCookies(supabaseResponse, res);
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  };

  const finishWithSession = (res: NextResponse) => {
    copyCookies(supabaseResponse, res);
    res.headers.set("X-Frame-Options", "DENY");
    res.headers.set("X-Content-Type-Options", "nosniff");
    res.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
    return res;
  };

  if (user && pathname === "/welcome") {
    return redirectWithSession(new URL("/", request.url));
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const nextParam = request.nextUrl.searchParams.get("callbackUrl");
    const dest = safeInternalPath(nextParam, "/");
    return redirectWithSession(new URL(dest, request.url));
  }

  if (isPublicRoute(pathname)) {
    return finishWithSession(supabaseResponse);
  }

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Sign in required." },
        { status: 401 }
      );
    }

    if (pathname === "/") {
      const onboarded =
        request.cookies.get(ONBOARDING_COOKIE)?.value === "1";
      const target = onboarded ? "/sign-in" : "/welcome";
      const url = new URL(target, request.url);
      if (onboarded) {
        url.searchParams.set("callbackUrl", "/");
      }
      return redirectWithSession(url);
    }

    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return redirectWithSession(signInUrl);
  }

  return finishWithSession(supabaseResponse);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$).*)",
  ],
};

export const middlewareConfig = {
  publicRoutes: PUBLIC_ROUTES,
  premiumRoutes: PREMIUM_ROUTES,
};
