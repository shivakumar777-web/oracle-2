"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Deep links (e.g. email receipts) use /settings?tab=subscription.
 * Oracle shell lives on `/` with a slide-over Settings overlay — redirect there.
 */
function SettingsRedirectInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tab = searchParams.get("tab") ?? "subscription";
    router.replace(`/?settingsTab=${encodeURIComponent(tab)}`);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#020610] text-cream/50 text-sm font-ui tracking-wide">
      Opening settings…
    </div>
  );
}

export default function SettingsDeepLinkPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#020610] flex items-center justify-center text-cream/30 text-xs">
          Loading…
        </div>
      }
    >
      <SettingsRedirectInner />
    </Suspense>
  );
}
