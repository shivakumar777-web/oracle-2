"use client";

import React, { useState } from "react";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

const PROFESSION_OPTIONS = ["Doctor", "Researcher", "Student", "Patient", "Pharmacist"];

interface SettingsOverlayProps {
  onClose: () => void;
}

/* ═══════════════════════════════════
   Custom Dropdown — dark themed, no
   native <select> white-bg issue
   ═══════════════════════════════════ */
function Dropdown({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value);

  return (
    <div className="flex flex-col items-end">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2
          font-ui text-xs text-cream/70 outline-none hover:border-gold/25 transition-colors min-w-[140px]"
      >
        <span className="flex-1 text-left truncate">{current?.label ?? value}</span>
        <span className={`text-cream/30 text-[10px] transition-transform duration-200 ${open ? "rotate-180" : ""}`}>▾</span>
      </button>
      {/* Inline expansion — flows in the document, never clipped */}
      <div className={`overflow-hidden transition-all duration-200 w-full
        ${open ? "max-h-[300px] mt-1.5 opacity-100" : "max-h-0 opacity-0"}`}>
        <div className="rounded-lg border border-gold/10 bg-[#080D18] overflow-hidden">
          {options.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 font-ui text-xs transition-colors border-b border-white/[0.03] last:border-0
                ${opt.value === value
                  ? "text-gold-h bg-gold/[0.06]"
                  : "text-cream/50 hover:text-cream/80 hover:bg-white/[0.03]"
                }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   Toggle Switch — animated, premium
   ═══════════════════════════════════ */
function Toggle({ value, onChange }: { value: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className={`w-11 h-6 rounded-full transition-all duration-300 relative flex-shrink-0 border
        ${value ? "bg-teal/20 border-teal/40" : "bg-white/[0.06] border-white/[0.08]"}`}
      role="switch"
      aria-checked={value}
    >
      <div
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full transition-all duration-300 shadow-md
          ${value
            ? "translate-x-[22px] bg-teal-m shadow-teal/30"
            : "translate-x-[3px] bg-cream/40"
          }`}
      />
    </button>
  );
}

/* ═══════════════════════════════════
   Custom Range Slider
   ═══════════════════════════════════ */
function DetailSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const labels = ["Concise", "Detailed", "Comprehensive"];
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="font-body text-sm text-cream/45">Detail Level</span>
        <span className="font-ui text-[10px] px-2.5 py-0.5 rounded-full bg-gold/[0.08] border border-gold/20 text-gold-h tracking-wider uppercase">
          {labels[value]}
        </span>
      </div>
      {/* Custom track */}
      <div className="relative h-8 flex items-center">
        <div className="absolute h-1 w-full bg-white/[0.06] rounded-full" />
        <div
          className="absolute h-1 bg-gradient-to-r from-gold-d to-gold-h rounded-full transition-all duration-300"
          style={{ width: `${(value / 2) * 100}%` }}
        />
        {/* Step dots */}
        {[0, 1, 2].map((i) => (
          <button
            key={i}
            onClick={() => onChange(i)}
            className={`absolute w-4 h-4 rounded-full border-2 transition-all duration-300 z-10
              ${i <= value
                ? "bg-gold border-gold-h shadow-sm shadow-gold/20"
                : "bg-[#0A0F18] border-white/[0.12] hover:border-gold/40"
              }`}
            style={{ left: `calc(${(i / 2) * 100}% - 8px)` }}
          />
        ))}
        {/* Hidden native input for accessibility */}
        <input
          type="range" min={0} max={2} value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute w-full h-8 opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between">
        {labels.map((l) => (
          <span key={l} className="font-ui text-[8px] text-cream/15 tracking-wider uppercase">{l}</span>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════
   Accordion Section
   ═══════════════════════════════════ */
function Section({
  id,
  title,
  icon,
  subtitle,
  isOpen,
  onToggle,
  children,
}: {
  id: string;
  title: string;
  icon: string;
  subtitle?: string;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.04]">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3.5 px-6 py-4 hover:bg-white/[0.02] transition-colors group"
      >
        <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center group-hover:bg-white/[0.05] transition-colors">
          <span className="text-sm">{icon}</span>
        </div>
        <div className="flex-1 text-left">
          <span className="font-ui text-xs tracking-[0.06em] uppercase text-cream/55 group-hover:text-cream/75 transition-colors">
            {title}
          </span>
          {subtitle && (
            <span className="block font-body text-[10px] text-cream/20 mt-0.5">{subtitle}</span>
          )}
        </div>
        <span className={`text-cream/15 text-[10px] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`}>
          ▾
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-out ${isOpen ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"}`}
      >
        <div className="px-6 pb-5 space-y-5">{children}</div>
      </div>
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <span className="font-body text-sm text-cream/50">{label}</span>
        {hint && <span className="block font-body text-[10px] text-cream/15 mt-0.5">{hint}</span>}
      </div>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════
   MAIN SETTINGS OVERLAY
   ═══════════════════════════════════ */
export default function SettingsOverlay({ onClose }: SettingsOverlayProps) {
  const { data: session } = authClient.useSession();
  const [profession, setProfession] = useState("Doctor");
  const [detailLevel, setDetailLevel] = useState(1);
  const [animations, setAnimations] = useState(true);
  const [citations, setCitations] = useState(true);
  const [autoDetect, setAutoDetect] = useState(true);
  const [disclaimer, setDisclaimer] = useState(true);
  const [history, setHistory] = useState(true);
  const [analytics, setAnalytics] = useState(false);
  const [language, setLanguage] = useState("en");
  const [defaultMode, setDefaultMode] = useState("auto");
  const [openSection, setOpenSection] = useState<string | null>("interface");

  const toggleSection = (id: string) =>
    setOpenSection((prev) => (prev === id ? null : id));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Panel — slides from right */}
      <div className="settings-panel relative w-full max-w-md h-full bg-[#050A14] border-l border-gold/[0.08] flex flex-col">
        {/* ─── Header ─── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/[0.06] flex-shrink-0">
          <div>
            <h2 className="font-ui text-xs tracking-[0.5em] uppercase text-cream/50">
              SETTINGS
            </h2>
            <p className="font-body text-[10px] text-cream/15 mt-0.5">
              Customize your experience
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center
              text-cream/30 hover:text-cream/80 hover:bg-white/[0.06] hover:border-gold/20 transition-all"
            aria-label="Close settings"
          >
            ✕
          </button>
        </div>

        {/* ─── Scrollable sections ─── */}
        <div className="flex-1 overflow-y-auto settings-scroll">
          {/* 0. Account */}
          <div className="border-b border-white/[0.04] px-6 py-4">
            {session?.user ? (
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-ui text-[10px] text-cream/60 truncate">
                    {session.user.name ?? session.user.email}
                  </p>
                  <p className="font-body text-[9px] text-cream/30 truncate">
                    {session.user.email}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    authClient.signOut({
                      fetchOptions: { onSuccess: () => { onClose(); window.location.reload(); } },
                    });
                  }}
                  className="font-ui text-[9px] tracking-[0.12em] uppercase text-cream/40 hover:text-gold-h transition-colors px-3 py-1.5 rounded-lg border border-white/[0.08] hover:border-gold/30"
                >
                  Sign out
                </button>
              </div>
            ) : (
              <Link
                href="/sign-in"
                onClick={onClose}
                className="flex items-center gap-2 text-cream/50 hover:text-gold-h transition-colors"
              >
                <span>🔐</span>
                <span className="font-ui text-[10px] tracking-[0.12em] uppercase">
                  Sign in to sync preferences
                </span>
              </Link>
            )}
          </div>

          {/* 1. Interface */}
          <Section
            id="interface" title="Interface" icon="⌥"
            subtitle="Appearance & preferences"
            isOpen={openSection === "interface"}
            onToggle={() => toggleSection("interface")}
          >
            <Row label="Animations" hint="Motion effects throughout the app">
              <Toggle value={animations} onChange={() => setAnimations(!animations)} />
            </Row>
            <Row label="Language">
              <Dropdown
                value={language}
                options={[
                  { value: "en", label: "English" },
                  { value: "hi", label: "हिंदी" },
                  { value: "sa", label: "संस्कृत" },
                ]}
                onChange={setLanguage}
              />
            </Row>
            <Row label="Default Mode">
              <Dropdown
                value={defaultMode}
                options={[
                  { value: "auto", label: "Auto" },
                  { value: "search", label: "Manthana Web" },
                  { value: "deep-research", label: "Med Deep Research" },
                ]}
                onChange={setDefaultMode}
              />
            </Row>
          </Section>

          {/* 2. AI Response */}
          <Section
            id="ai" title="AI Response" icon="🧠"
            subtitle="Control output quality & detail"
            isOpen={openSection === "ai"}
            onToggle={() => toggleSection("ai")}
          >
            <DetailSlider value={detailLevel} onChange={setDetailLevel} />
            <Row label="Auto-cite sources" hint="Attach references to every response">
              <Toggle value={citations} onChange={() => setCitations(!citations)} />
            </Row>
            <Row label="Auto-detect image type" hint="Route scans to the right AI model">
              <Toggle value={autoDetect} onChange={() => setAutoDetect(!autoDetect)} />
            </Row>
            <Row label="Medical disclaimer" hint="Show disclaimer on every response">
              <Toggle value={disclaimer} onChange={() => setDisclaimer(!disclaimer)} />
            </Row>
          </Section>

          {/* 3. Medical Profile */}
          <Section
            id="profile" title="Medical Profile" icon="👤"
            subtitle="Your role & specialization"
            isOpen={openSection === "profile"}
            onToggle={() => toggleSection("profile")}
          >
            <div>
              <p className="font-ui text-[9px] text-cream/25 uppercase tracking-[0.3em] mb-3">
                PROFESSION
              </p>
              <div className="flex flex-wrap gap-2">
                {PROFESSION_OPTIONS.map((p) => (
                  <button
                    key={p}
                    onClick={() => setProfession(p)}
                    className={`px-3.5 py-1.5 rounded-lg font-ui text-[10px] tracking-wider uppercase transition-all duration-300 border
                      ${profession === p
                        ? "bg-gold/[0.12] border-gold/40 text-gold-h shadow-sm shadow-gold/10"
                        : "bg-white/[0.02] border-white/[0.06] text-cream/30 hover:text-cream/60 hover:border-white/[0.12]"
                      }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="font-ui text-[9px] text-cream/25 uppercase tracking-[0.3em] block mb-2">
                SPECIALTY
              </label>
              <input
                type="text"
                placeholder="e.g. Cardiology"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5
                  font-body text-sm text-cream/70 outline-none
                  focus:border-gold/25 focus:bg-white/[0.04] placeholder:text-cream/15 transition-all"
              />
            </div>
            <div>
              <label className="font-ui text-[9px] text-cream/25 uppercase tracking-[0.3em] block mb-2">
                INSTITUTION
              </label>
              <input
                type="text"
                placeholder="e.g. AIIMS Delhi"
                className="w-full bg-white/[0.03] border border-white/[0.06] rounded-lg px-4 py-2.5
                  font-body text-sm text-cream/70 outline-none
                  focus:border-gold/25 focus:bg-white/[0.04] placeholder:text-cream/15 transition-all"
              />
            </div>
          </Section>

          {/* 4. Privacy */}
          <Section
            id="privacy" title="Privacy & Data" icon="🔒"
            subtitle="History, analytics & retention"
            isOpen={openSection === "privacy"}
            onToggle={() => toggleSection("privacy")}
          >
            <Row label="Save chat history" hint="Keep past conversations accessible">
              <Toggle value={history} onChange={() => setHistory(!history)} />
            </Row>
            <Row label="Usage analytics" hint="Help improve MANTHANA">
              <Toggle value={analytics} onChange={() => setAnalytics(!analytics)} />
            </Row>
            <Row label="Auto-delete after">
              <Dropdown
                value="30"
                options={[
                  { value: "30", label: "30 days" },
                  { value: "90", label: "90 days" },
                  { value: "never", label: "Never" },
                ]}
                onChange={() => {}}
              />
            </Row>
            <button className="w-full mt-2 py-2.5 rounded-lg border border-red-500/20 bg-red-500/[0.04]
              font-ui text-[10px] tracking-[0.2em] uppercase text-red-400/50
              hover:bg-red-500/[0.08] hover:text-red-400/80 hover:border-red-500/40 transition-all">
              Clear All Data
            </button>
          </Section>

          {/* 5. Subscription */}
          <Section
            id="subscription" title="Subscription" icon="💎"
            subtitle="Plan & usage"
            isOpen={openSection === "subscription"}
            onToggle={() => toggleSection("subscription")}
          >
            <div className="flex items-center gap-3">
              <span className="font-ui text-[10px] tracking-[0.3em] uppercase text-gold-h px-4 py-1.5
                rounded-full border border-gold/30 bg-gold/[0.08]">
                PRO
              </span>
              <div>
                <span className="font-body text-xs text-cream/40 block">Active plan</span>
                <span className="font-ui text-[9px] text-cream/15">Renews April 2026</span>
              </div>
            </div>
            <div className="bg-white/[0.02] rounded-lg p-4 border border-white/[0.04]">
              <div className="flex justify-between mb-2">
                <span className="font-ui text-[10px] text-cream/35">Monthly queries</span>
                <span className="font-ui text-[10px] text-gold/70">1,247 / 5,000</span>
              </div>
              <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                <div className="h-full w-[25%] bg-gradient-to-r from-gold-d to-gold-h rounded-full
                  shadow-sm shadow-gold/20" />
              </div>
              <p className="font-ui text-[9px] text-cream/15 mt-2">3,753 queries remaining</p>
            </div>
            <button className="btn-gold w-full text-xs py-2.5">Upgrade Plan</button>
          </Section>

          {/* 6. About */}
          <Section
            id="about" title="About MANTHANA" icon="ℹ️"
            subtitle="Version & capabilities"
            isOpen={openSection === "about"}
            onToggle={() => toggleSection("about")}
          >
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "🫁", label: "Radiology" },
                { icon: "❤️", label: "ECG" },
                { icon: "👁", label: "Ophthalmo" },
                { icon: "⚕", label: "Ayurveda" },
                { icon: "💊", label: "Drug DB" },
                { icon: "🧬", label: "Oncology" },
                { icon: "🧠", label: "Neuro" },
                { icon: "🔬", label: "Pathology" },
              ].map((item) => (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                >
                  <span className="text-sm">{item.icon}</span>
                  <span className="font-ui text-[10px] text-cream/35">{item.label}</span>
                </div>
              ))}
            </div>
            <div className="bg-white/[0.02] rounded-xl p-4 border border-gold/[0.08]">
              <div className="flex items-baseline gap-2 mb-1">
                <span className="font-ui text-2xl text-gold-h font-light">41</span>
                <span className="font-ui text-[9px] text-cream/25 tracking-wider uppercase">specialized AI models</span>
              </div>
              <div className="h-px bg-white/[0.04] my-3" />
              <div className="flex justify-between">
                <span className="font-ui text-[9px] text-cream/20">Version</span>
                <span className="font-ui text-[9px] text-cream/30">1.0.0 — Production</span>
              </div>
            </div>
            <p className="font-body text-[10px] italic text-cream/20 leading-relaxed px-1">
              For research and education only. Not a substitute for professional medical advice.
              Always consult a qualified healthcare provider.
            </p>
          </Section>
        </div>

        {/* ─── Footer ─── */}
        <div className="px-6 py-5 border-t border-white/[0.04] flex-shrink-0 bg-[#050A14]">
          <p className="font-body text-[10px] italic text-gold-s/50 text-center">
            सर्वे भवन्तु निरामयाः
          </p>
          <p className="font-ui text-[8px] text-cream/15 text-center mt-1 tracking-[0.4em] uppercase">
            May all be free from illness
          </p>
        </div>
      </div>
    </div>
  );
}
