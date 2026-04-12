"use client";

import { useEffect } from "react";
import { setGatewayAuthToken } from "@/lib/analyse/auth-token";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";

/**
 * Copies the Supabase session access_token into the gateway auth store so
 * Manthana Labs fetch calls (analyze, report, etc.) send Authorization: Bearer.
 * Gateway verifies with SUPABASE_JWT_SECRET when set on Railway.
 */
export function useGatewayAuthBridge(): void {
  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    if (!supabase) {
      setGatewayAuthToken(null);
      return;
    }

    let cancelled = false;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session?.access_token) {
        setGatewayAuthToken(data.session.access_token);
      } else {
        setGatewayAuthToken(null);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) {
        setGatewayAuthToken(session.access_token);
      } else {
        setGatewayAuthToken(null);
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);
}
