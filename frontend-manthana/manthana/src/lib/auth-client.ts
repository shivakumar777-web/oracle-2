"use client";

/**
 * Supabase Auth — thin client compatible with prior Better Auth call sites.
 */
import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import {
  clearSupabaseSessionBackup,
  createBrowserSupabaseClient,
  tryRecoverSessionFromBackup,
} from "@/lib/supabase/browser";
import { isStandalonePwa } from "@/lib/pwa-install-nudge";
import { SUPABASE_AUTH_DISABLED_MESSAGE } from "@/lib/supabase/env";
import { safeInternalPath } from "@/lib/auth/safe-internal-path";
import { browserOAuthOrigin } from "@/lib/auth/site-public-origin";

function displayName(user: User | null | undefined): string | undefined {
  if (!user) return undefined;
  const meta = user.user_metadata as { full_name?: string; name?: string } | undefined;
  return meta?.full_name ?? meta?.name ?? user.email?.split("@")[0];
}

/** Session shape expected by Sidebar / Settings (`session.user`, optional `user.name`). */
function withDisplayName(session: Session | null): Session | null {
  if (!session?.user) return session;
  const u = session.user;
  const name = displayName(u);
  return {
    ...session,
    user: Object.assign(u, { name: name ?? u.email }),
  };
}

export function useSession(): {
  data: Session | null;
  isPending: boolean;
} {
  const [session, setSession] = useState<Session | null>(null);
  const [isPending, setPending] = useState(true);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setSession(null);
      setPending(false);
      return;
    }
    void (async () => {
      try {
        let s = (await supabase.auth.getSession()).data.session;
        if (!s) {
          s = await tryRecoverSessionFromBackup(supabase);
        }
        setSession(withDisplayName(s));
      } catch {
        setSession(null);
      } finally {
        setPending(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(withDisplayName(s));
    });

    return () => subscription.unsubscribe();
  }, []);

  return { data: session, isPending };
}

export async function getSession(): Promise<{ data: { session: Session | null } }> {
  const supabase = createBrowserSupabaseClient();
  if (!supabase) {
    return { data: { session: null } };
  }
  let {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    session = await tryRecoverSessionFromBackup(supabase);
  }
  return { data: { session: withDisplayName(session) } };
}

type EmailCb = {
  onSuccess?: () => void;
  onError?: (ctx: { error: { message: string } }) => void;
};

export const authClient = {
  useSession,

  getSession,

  /**
   * Google OAuth — user is sent to Google, then back to `/auth/callback`.
   * Enable the provider in Supabase Dashboard → Authentication → Providers → Google.
   */
  async signInWithGoogle(options?: { callbackUrl?: string | null }) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      return { error: new Error(SUPABASE_AUTH_DISABLED_MESSAGE) };
    }
    const next = safeInternalPath(options?.callbackUrl ?? "/", "/");
    const origin = browserOAuthOrigin();
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const oauthOptions = {
      redirectTo,
      queryParams: {
        prompt: "select_account",
      },
    };

    const usePopup =
      typeof window !== "undefined" &&
      isStandalonePwa() &&
      typeof window.open === "function";

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        ...oauthOptions,
        ...(usePopup ? { skipBrowserRedirect: true } : {}),
      },
    });
    if (error) {
      const raw = error.message ?? "";
      if (
        /Unsupported provider|provider is not enabled/i.test(raw) ||
        /validation_failed/i.test(raw)
      ) {
        return {
          error: new Error(
            "Google sign-in is turned off in Supabase. Open your project → Authentication → Providers → Google, enable it, and add your Google OAuth Client ID and Client Secret (from Google Cloud Console). Redirect URI in Google must be https://<your-project-ref>.supabase.co/auth/v1/callback."
          ),
        };
      }
      return { error };
    }
    if (data?.url && typeof window !== "undefined") {
      if (usePopup) {
        const popup = window.open(
          data.url,
          "manthana_google_oauth",
          "width=520,height=680,scrollbars=yes,resizable=yes"
        );
        if (!popup) {
          window.location.assign(data.url);
          return { error: null };
        }
        const dest = next;
        const poll = window.setInterval(() => {
          if (!popup.closed) return;
          window.clearInterval(poll);
          window.location.assign(dest.startsWith("/") ? dest : `/${dest}`);
        }, 400);
        const maxMs = 5 * 60 * 1000;
        window.setTimeout(() => {
          window.clearInterval(poll);
        }, maxMs);
        return { error: null };
      }
      window.location.assign(data.url);
    }
    return { error: null };
  },

  async signOut(opts?: { fetchOptions?: { onSuccess?: () => void } }) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      opts?.fetchOptions?.onSuccess?.();
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    clearSupabaseSessionBackup();
    opts?.fetchOptions?.onSuccess?.();
  },

  signIn: {
    async email(
      {
        email,
        password,
      }: {
        email: string;
        password: string;
        callbackURL?: string;
      },
      callbacks?: EmailCb
    ) {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) {
        const err = new Error(SUPABASE_AUTH_DISABLED_MESSAGE);
        callbacks?.onError?.({ error: { message: err.message } });
        return { data: null, error: err };
      }
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        callbacks?.onError?.({ error: { message: error.message } });
        return { data: null, error };
      }
      callbacks?.onSuccess?.();
      return { data, error: null };
    },
  },

  signUp: {
    async email(
      {
        email,
        password,
        name,
      }: {
        email: string;
        password: string;
        name: string;
        callbackURL?: string;
      },
      callbacks?: EmailCb
    ) {
      const supabase = createBrowserSupabaseClient();
      if (!supabase) {
        const err = new Error(SUPABASE_AUTH_DISABLED_MESSAGE);
        callbacks?.onError?.({ error: { message: err.message } });
        return { data: null, error: err };
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, name },
          emailRedirectTo:
            typeof window !== "undefined"
              ? `${browserOAuthOrigin()}/auth/callback?next=/`
              : undefined,
        },
      });
      if (error) {
        callbacks?.onError?.({ error: { message: error.message } });
        return { data: null, error };
      }
      callbacks?.onSuccess?.();
      return { data, error: null };
    },
  },

  async resetPasswordForEmail(
    email: string,
    options?: { redirectTo?: string }
  ) {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      throw new Error(SUPABASE_AUTH_DISABLED_MESSAGE);
    }
    const redirectTo =
      options?.redirectTo ??
      (typeof window !== "undefined"
        ? `${browserOAuthOrigin()}/reset-password`
        : undefined);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });
    if (error) throw new Error(error.message);
  },
};
