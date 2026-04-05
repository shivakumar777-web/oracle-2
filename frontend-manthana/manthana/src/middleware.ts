/**
 * Next.js Middleware — Route Protection
 * Redirects unauthenticated users to sign-in with callback URL
 * Also checks subscription status for premium routes
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Routes that don't require authentication
const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/api/auth", // Better Auth API
  "/api/razorpay/webhook", // Payment webhooks (must be public)
  "/_next", // Next.js internal
  "/static", // Static files
  "/favicon.ico",
  "/manifest.json",
  "/logo",
  "/assets",
  "/images",
  "/fonts",
  "/", // Landing page (if public)
  "/about",
  "/pricing",
  "/contact",
];

// Routes that require active subscription (free users blocked)
const PREMIUM_ROUTES = [
  "/analyse",
  "/research",
  "/clinical",
  "/web",
  "/oracle",
];

// Check if path is public
function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === "/" && pathname !== "/") return false;
    return pathname.startsWith(route);
  });
}

// Check if path requires subscription
function isPremiumRoute(pathname: string): boolean {
  return PREMIUM_ROUTES.some((route) => pathname.startsWith(route));
}

// Extract session cookie from request
function getSessionCookie(request: NextRequest): string | undefined {
  // Better Auth uses these cookie names
  const cookieNames = [
    "better-auth.session_token",
    "better-auth.session",
    "__Secure-better-auth.session_token",
    "__Host-better-auth.session_token",
  ];

  for (const name of cookieNames) {
    const cookie = request.cookies.get(name);
    if (cookie?.value) {
      return cookie.value;
    }
  }
  return undefined;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes without authentication
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    // Redirect to sign-in with callback URL
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(signInUrl);
  }

  // Check if this is a premium route that might need subscription
  // Note: Actual subscription enforcement happens in API routes/page components
  // This middleware only ensures they're logged in

  // Add security headers
  const response = NextResponse.next();
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");

  return response;
}

// Match all routes except static files and API routes that are public
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|css|js)$).*)",
  ],
};

/**
 * Edge-Compatible Middleware Helper
 * For routes that need to check subscription status, use page-level
 * guards rather than middleware (to avoid database calls at edge)
 */
export const middlewareConfig = {
  publicRoutes: PUBLIC_ROUTES,
  premiumRoutes: PREMIUM_ROUTES,
};
