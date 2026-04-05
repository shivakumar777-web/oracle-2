"use client";
import React from "react";
import TopBar from "@/components/analyse/layout/TopBar";
import DisclaimerBar from "@/components/analyse/layout/DisclaimerBar";
import ThemeSwitcher from "@/components/analyse/shared/ThemeSwitcher";
import { useTheme, THEMES } from "@/components/analyse/shared/ThemeProvider";

/**
 * Settings — API config, language, appearance, about
 */
export default function SettingsPage() {
  const { theme } = useTheme();

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
      <TopBar />

      <main style={{ flex: 1, padding: "32px 24px", overflowY: "auto" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h1 className="text-headline" style={{ color: "var(--text-100)", marginBottom: 32 }}>
            Settings
          </h1>

          {/* Appearance */}
          <Section title="Appearance">
            <SettingRow label="Theme">
              <ThemeSwitcher />
            </SettingRow>
            <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
              {THEMES.map((t) => (
                <div
                  key={t.id}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: "var(--r-md)",
                    border: theme === t.id
                      ? "2px solid var(--scan-400)"
                      : "1px solid var(--glass-border)",
                    background: theme === t.id ? "var(--glass-hover)" : "var(--glass)",
                    textAlign: "center",
                    transition: "all 0.2s",
                  }}
                >
                  <div style={{ fontSize: 20, marginBottom: 4 }}>{t.icon}</div>
                  <div className="font-display" style={{ fontSize: 10, fontWeight: 600, color: "var(--text-80)" }}>
                    {t.label}
                  </div>
                  <div className="font-mono" style={{ fontSize: 8, color: "var(--text-30)", marginTop: 2 }}>
                    {t.description}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          {/* Gateway Config */}
          <Section title="Gateway Connection">
            <SettingRow label="Gateway URL">
              <input
                type="text"
                defaultValue="http://localhost:8000"
                style={{
                  background: "var(--glass)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--r-sm)",
                  padding: "8px 12px",
                  color: "var(--text-100)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  width: "100%",
                  maxWidth: 300,
                  outline: "none",
                }}
              />
            </SettingRow>
          </Section>

          {/* Language */}
          <Section title="Language">
            <SettingRow label="Report Language">
              <select
                defaultValue="en"
                style={{
                  background: "var(--void-3)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--r-sm)",
                  padding: "8px 12px",
                  color: "var(--text-100)",
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  outline: "none",
                }}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="kn">ಕನ್ನಡ (Kannada)</option>
                <option value="ml">മലയാളം (Malayalam)</option>
                <option value="mr">मराठी (Marathi)</option>
                <option value="bn">বাংলা (Bengali)</option>
                <option value="gu">ગુજરાતી (Gujarati)</option>
                <option value="pa">ਪੰਜਾਬੀ (Punjabi)</option>
              </select>
            </SettingRow>
          </Section>

          {/* Analysis */}
          <Section title="Analysis Defaults">
            <SettingRow label="Default Modality">
              <select
                defaultValue="auto"
                style={{
                  background: "var(--void-3)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: "var(--r-sm)",
                  padding: "8px 12px",
                  color: "var(--text-100)",
                  fontFamily: "var(--font-display)",
                  fontSize: 12,
                  outline: "none",
                }}
              >
                <option value="auto">Auto-Detect</option>
                <option value="xray">X-Ray</option>
                <option value="brain_mri">Brain MRI</option>
                <option value="spine_mri">Spine / Neuro MRI</option>
                <option value="cardiac_ct">Cardiac CT</option>
                <option value="ecg">ECG</option>
              </select>
            </SettingRow>
          </Section>

          {/* About */}
          <Section title="About">
            <div style={{ padding: "4px 0" }}>
              <p className="font-body" style={{ fontSize: 12, color: "var(--text-55)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--text-100)" }}>Manthana Radiologist Copilot</strong> — AI-powered
                radiology second-opinion suite with 13 specialized services and 23+ models for clinical decision support.
              </p>
              <p className="font-mono" style={{ fontSize: 10, color: "var(--text-15)", marginTop: 8 }}>
                v1.0.0 · Built with Next.js 14 · Gateway at port 8000
              </p>
            </div>
          </Section>
        </div>
      </main>

      <DisclaimerBar />
    </div>
  );
}

/* ── Section wrapper ── */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <h2 className="text-label" style={{ color: "var(--text-30)", marginBottom: 16 }}>
        {title}
      </h2>
      <div
        className="glass-panel"
        style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}
      >
        {children}
      </div>
    </div>
  );
}

/* ── Setting row ── */
function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
      <span className="font-display" style={{ fontSize: 13, color: "var(--text-80)" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
