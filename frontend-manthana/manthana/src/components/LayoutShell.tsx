"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import CosmicBackground from "./CosmicBackground";
import Sidebar from "./Sidebar";
import BottomNav from "./BottomNav";
import { ErrorBoundary } from "./ErrorBoundary";
import { LangProvider, useLang } from "./LangProvider";
import { ToastProvider } from "@/hooks/useToast";
import ToastContainer from "./Toast";
import { ProductAccessProvider } from "./ProductAccessProvider";

// Lazy-load heavy overlays
const SettingsOverlay = dynamic(() => import("./SettingsOverlay"), { ssr: false });
const ChatHistory = dynamic(() => import("./ChatHistory"), { ssr: false });
type OverlayType = "settings" | "history" | null;

function isBareAuthPath(pathname: string): boolean {
  if (pathname === "/welcome") return true;
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/sign-up")) return true;
  if (pathname === "/forgot-password") return true;
  if (pathname === "/reset-password") return true;
  if (pathname.startsWith("/auth/")) return true;
  return false;
}

function readSettingsTabFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const q = new URLSearchParams(window.location.search);
  const st = q.get("settingsTab");
  if (st) return st;
  if (q.get("tab") === "subscription") return "subscription";
  return null;
}

function stripSettingsQueryFromUrl() {
  if (typeof window === "undefined") return;
  const q = new URLSearchParams(window.location.search);
  if (!q.has("settingsTab") && q.get("tab") !== "subscription") return;
  q.delete("settingsTab");
  q.delete("tab");
  const nq = q.toString();
  window.history.replaceState({}, "", nq ? `${window.location.pathname}?${nq}` : window.location.pathname);
}

function MobileLangBar() {
  const { lang, setLang } = useLang();
  return (
    <div className="px-4 py-2 flex items-center gap-2 text-[11px] text-cream/85 border-t border-white/[0.06]">
      <span className="text-[10px] uppercase tracking-[0.18em] text-cream/70">
        🗣️ AI Language
      </span>
      <select
        value={lang}
        onChange={(e) => setLang(e.target.value)}
        className="ml-auto min-w-[7rem] bg-[#020610] border border-white/25 rounded px-2 py-1.5 text-[11px] text-cream/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] focus:outline-none focus:border-teal-m focus:ring-1 focus:ring-teal-m/40"
      >
        <option value="en">English 🇮🇳</option>
        <option value="ta">தமிழ் 🇮🇳</option>
        <option value="hi">हिंदी 🇮🇳</option>
        <option value="te">తెలుగు 🇮🇳</option>
        <option value="kn">ಕನ್ನಡ 🇮🇳</option>
        <option value="ml">മലയാളം 🇮🇳</option>
      </select>
    </div>
  );
}

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAnalyseRoute = pathname.startsWith("/analyse");
  const [expanded, setExpanded] = useState(false);
  const [mobileTopOpen, setMobileTopOpen] = useState(false);
  const [overlay, setOverlay] = useState<OverlayType>(null);
  const [settingsInitialSection, setSettingsInitialSection] = useState<string | null>(null);
  const router = useRouter();

  const openOverlay = (key: string) => {
    if (key === "settings") {
      setSettingsInitialSection(null);
      setOverlay("settings");
    } else if (key === "history") {
      setOverlay("history");
    }
  };

  const openSubscriptionFromShell = () => {
    setSettingsInitialSection("subscription");
    setOverlay("settings");
  };

  const closeOverlay = () => {
    setOverlay(null);
    setSettingsInitialSection(null);
  };

  useEffect(() => {
    if (pathname !== "/") return;
    const section = readSettingsTabFromUrl();
    if (!section) return;
    stripSettingsQueryFromUrl();
    setSettingsInitialSection(section);
    setOverlay("settings");
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    (window as any).openClinicalTools = (
      toolId?: "drug" | "herb" | "trials" | "icd10",
      prefill?: any,
    ) => {
      const params = new URLSearchParams();
      if (toolId) params.set("tab", toolId);
      if (prefill?.drugs?.length) {
        params.set("drugs", prefill.drugs.join(","));
      }
      if (prefill?.herb) params.set("herb", prefill.herb);
      if (prefill?.drug) params.set("drug", prefill.drug);
      if (prefill?.query) params.set("query", prefill.query);
      const qs = params.toString();
      router.push(qs ? `/clinical-tools?${qs}` : "/clinical-tools");
    };
  }, [router]);

  if (isAnalyseRoute) {
    return (
      <LangProvider>
        <ToastProvider>
          <ProductAccessProvider>
            <div className="analyse-app-shell relative min-h-dvh overflow-x-hidden">
              <ErrorBoundary>{children}</ErrorBoundary>
              <ToastContainer />
            </div>
          </ProductAccessProvider>
        </ToastProvider>
      </LangProvider>
    );
  }

  if (isBareAuthPath(pathname)) {
    return (
      <LangProvider>
        <ToastProvider>
          <div className="relative min-h-dvh bg-[#020610] overflow-x-hidden">
            <CosmicBackground />
            <div className="relative z-10 min-h-dvh flex flex-col items-center justify-center p-4">
              <ErrorBoundary>{children}</ErrorBoundary>
            </div>
            <ToastContainer />
          </div>
        </ToastProvider>
      </LangProvider>
    );
  }

  return (
    <LangProvider>
      <ToastProvider>
      <ProductAccessProvider>
      <div className="relative min-h-dvh bg-[#020610] overflow-x-hidden">
      {/* Cosmic background canvas */}
      <CosmicBackground />

      {/* Sidebar (desktop) */}
      <Sidebar
        expanded={expanded}
        onToggle={() => setExpanded((v) => !v)}
        onOverlayOpen={openOverlay}
        onOpenSubscriptionSettings={openSubscriptionFromShell}
      />

      {/* Main content area — shifts right on expanded sidebar */}
      <main
        className={`relative z-10 min-h-dvh transition-all duration-300 ease-out
          md:ml-[60px] ${expanded ? "md:ml-[280px]" : ""}
          pb-[max(3.5rem,env(safe-area-inset-bottom,0px))] md:pb-0`}
        id="main-content"
        style={{ isolation: "isolate", willChange: "transform" }}
      >
        {/* Disclaimer bar — top on desktop, always visible */}
        <div className="hidden md:block disclaimer-bar sticky top-0 z-30">
          ⚕ MANTHANA is for research and education only. Not a substitute for professional medical advice.
          Always consult a qualified healthcare provider before making clinical decisions.
        </div>

        {/* Mobile collapsible top strip (disclaimer + language) */}
        <div className="md:hidden sticky top-0 z-30 px-2 pt-1">
          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMobileTopOpen((v) => !v)}
              className="w-7 h-7 rounded-full border border-gold/45 bg-[#050b14]/92 text-gold-h text-sm leading-none flex items-center justify-center"
              aria-expanded={mobileTopOpen}
              aria-controls="mobile-top-panel"
              aria-label={mobileTopOpen ? "Collapse top bar" : "Expand top bar"}
            >
              {mobileTopOpen ? "▴" : "▾"}
            </button>
          </div>
          {mobileTopOpen && (
            <div
              id="mobile-top-panel"
              className="mt-1 rounded-xl border border-white/[0.08] bg-[#050b14]/95 overflow-hidden"
            >
              <div className="px-3 py-2 text-[10px] leading-relaxed text-cream/70 border-b border-white/[0.06]">
                ⚕ MANTHANA is for research and education only. Not a substitute for professional medical advice.
              </div>
              <MobileLangBar />
            </div>
          )}
        </div>

        {/* Page content */}
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>

      {/* Mobile bottom navigation */}
      <BottomNav
        onOverlayOpen={openOverlay}
        onOpenSubscriptionSettings={openSubscriptionFromShell}
      />

      {/* Overlays */}
      {overlay === "settings" && (
        <SettingsOverlay
          key={`settings-${settingsInitialSection ?? "default"}`}
          initialSection={settingsInitialSection}
          onClose={closeOverlay}
        />
      )}
      {overlay === "history" && <ChatHistory onClose={closeOverlay} />}

      {/* Global Toast Notifications */}
      <ToastContainer />
    </div>
      </ProductAccessProvider>
    </ToastProvider>
    </LangProvider>
  );
}
