"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Session, SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "./env";

let client: SupabaseClient | undefined;

/** Mirrors cookie session for PWA / cookie-eviction recovery (not a security boundary). */
export const SUPABASE_SESSION_BACKUP_KEY = "manthana_supabase_session_backup";

function syncSessionBackup(event: string, session: Session | null) {
  if (typeof window === "undefined") return;
  try {
    if (event === "SIGNED_OUT") {
      localStorage.removeItem(SUPABASE_SESSION_BACKUP_KEY);
      return;
    }
    if (session?.access_token && session.refresh_token) {
      localStorage.setItem(
        SUPABASE_SESSION_BACKUP_KEY,
        JSON.stringify({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
          expires_at: session.expires_at,
        })
      );
    }
  } catch {
    /* quota / private mode */
  }
}

/** If cookies have no session, restore from localStorage backup via setSession. */
export async function tryRecoverSessionFromBackup(
  supabase: SupabaseClient
): Promise<Session | null> {
  const {
    data: { session: existing },
  } = await supabase.auth.getSession();
  if (existing) return existing;

  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SUPABASE_SESSION_BACKUP_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as {
      access_token?: string;
      refresh_token?: string;
    };
    if (!parsed?.access_token || !parsed?.refresh_token) return null;
    const { data, error } = await supabase.auth.setSession({
      access_token: parsed.access_token,
      refresh_token: parsed.refresh_token,
    });
    if (error || !data.session) return null;
    return data.session;
  } catch {
    return null;
  }
}

export function clearSupabaseSessionBackup(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SUPABASE_SESSION_BACKUP_KEY);
  } catch {
    /* ignore */
  }
}

/** Returns `null` if public Supabase env is missing (avoid crashing the whole app on Vercel). */
export function createBrowserSupabaseClient(): SupabaseClient | null {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  if (!client) {
    client = createBrowserClient(env.url, env.key, {
      cookieOptions: {
        path: "/",
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      },
    });
    client.auth.onAuthStateChange((event, session) => {
      syncSessionBackup(event, session);
    });
  }
  return client;
}
