"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

// Dev auto-signin credentials - only active in development (npm run dev)
const DEV_EMAIL = "shivakumarcjh@gmail.com";
const DEV_PASSWORD = "12345678";

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [autoSigningIn, setAutoSigningIn] = useState(false);

  // Auto-signin on dev mode (only runs once on mount)
  useEffect(() => {
    // Check if running in development (not production build)
    const isDev = process.env.NODE_ENV === "development";
    const hasAutoSignedIn = sessionStorage.getItem("dev-auto-signed-in");
    const autoSignInDisabled = sessionStorage.getItem("dev-auto-signin-disabled");
    
    if (isDev && !hasAutoSignedIn && !autoSignInDisabled) {
      setAutoSigningIn(true);
      setEmail(DEV_EMAIL);
      setPassword(DEV_PASSWORD);
      
      // Slight delay to show the UI filling in
      const timer = setTimeout(() => {
        authClient.signIn.email(
          { email: DEV_EMAIL, password: DEV_PASSWORD, callbackURL: "/" },
          {
            onSuccess: () => {
              sessionStorage.setItem("dev-auto-signed-in", "true");
              router.push("/");
            },
            onError: (ctx) => {
              setError(ctx.error.message ?? "Auto sign in failed");
              setAutoSigningIn(false);
            },
          }
        );
      }, 500);
      
      return () => clearTimeout(timer);
    }
  }, [router]);

  const disableAutoSignIn = () => {
    sessionStorage.setItem("dev-auto-signin-disabled", "true");
    setAutoSigningIn(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { data, error: err } = await authClient.signIn.email(
      { email, password, callbackURL: "/" },
      {
        onSuccess: () => router.push("/"),
        onError: (ctx) => setError(ctx.error.message ?? "Sign in failed"),
      }
    );
    setLoading(false);
    if (err) setError(err.message ?? "Sign in failed");
    else if (data) router.push("/");
  };

  // Manual dev auto-signin button handler
  const handleDevAutoSignIn = () => {
    setEmail(DEV_EMAIL);
    setPassword(DEV_PASSWORD);
    setAutoSigningIn(true);
    setTimeout(() => {
      authClient.signIn.email(
        { email: DEV_EMAIL, password: DEV_PASSWORD, callbackURL: "/" },
        {
          onSuccess: () => {
            sessionStorage.setItem("dev-auto-signed-in", "true");
            router.push("/");
          },
          onError: (ctx) => {
            setError(ctx.error.message ?? "Auto sign in failed");
            setAutoSigningIn(false);
          },
        }
      );
    }, 100);
  };

  const isDev = typeof window !== "undefined" && process.env.NODE_ENV === "development";

  return (
    <div className="rounded-xl border border-white/[0.08] bg-black/40 backdrop-blur-sm p-8 shadow-xl">
      <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-gold-h mb-1">
        Sign in
      </h1>
      <p className="text-cream/50 text-sm mb-6">
        Access your MANTHANA account
        {autoSigningIn && (
          <span className="block text-gold-h mt-1">Auto-signing in (dev mode)…</span>
        )}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-sm text-red-300">
            {error}
          </div>
        )}
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Email
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="you@example.com"
            className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <div>
          <label className="block font-ui text-[10px] tracking-[0.2em] uppercase text-cream/50 mb-1.5">
            Password
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full rounded-lg px-4 py-2.5 bg-black/20 border border-white/[0.12] text-cream placeholder-cream/30 focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/30 transition-colors"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-lg font-ui text-sm tracking-[0.15em] uppercase bg-gold/20 border border-gold/40 text-gold-h hover:bg-gold/30 hover:border-gold/60 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-cream/40 text-sm">
        Don&apos;t have an account?{" "}
        <Link href="/sign-up" className="text-gold-h hover:text-gold-p underline underline-offset-2">
          Sign up
        </Link>
      </p>

      {/* Dev auto-signin button - only shows in development mode */}
      {isDev && (
        <div className="mt-4 pt-4 border-t border-white/[0.08]">
          <button
            type="button"
            onClick={handleDevAutoSignIn}
            disabled={loading || autoSigningIn}
            className="w-full py-2 rounded-lg font-ui text-xs tracking-[0.1em] uppercase bg-white/5 border border-white/10 text-cream/60 hover:bg-white/10 hover:text-cream disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Auto Sign In (Dev: {DEV_EMAIL})
          </button>
          <p className="text-center text-cream/30 text-xs mt-2">
            Dev mode: automatically signs in on page load
            {autoSigningIn && (
              <button 
                onClick={disableAutoSignIn}
                className="ml-2 text-gold-h hover:underline"
              >
                Cancel
              </button>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
