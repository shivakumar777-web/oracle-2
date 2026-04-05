"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import HeartbeatLogo from "../brand/HeartbeatLogo";
import ServiceHealthDots from "../shared/ServiceHealthDots";
import ThemeSwitcher from "../shared/ThemeSwitcher";
import { BRAND } from "@/lib/analyse/constants";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  scanning?: boolean;
  onNewScan?: () => void;
  onCommandPalette?: () => void;
  onOpenPacs?: () => void;
}

export default function TopBar({
  scanning = false,
  onNewScan,
  onCommandPalette,
  onOpenPacs,
}: Props) {
  const router = useRouter();
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header
      className="topbar"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        height: isMobile ? 44 : compact ? 48 : 60,
        display: "flex",
        alignItems: "center",
        padding: isMobile ? "0 8px" : compact ? "0 12px" : "0 24px",
        background: "linear-gradient(180deg, rgba(2,6,16,0.95) 0%, rgba(2,6,16,0.85) 100%)",
        backdropFilter: "blur(20px) saturate(1.4)",
        WebkitBackdropFilter: "blur(20px) saturate(1.4)",
        borderBottom: "1px solid var(--glass-border)",
      }}
    >
      {/* Brand — click to start a new scan */}
      <button
        onClick={onNewScan}
        title="New scan"
        style={{
          display: "flex",
          alignItems: "center",
          gap: compact ? 8 : 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px 6px",
          borderRadius: "var(--r-sm)",
          transition: "background 0.15s",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "none";
        }}
      >
        <HeartbeatLogo size={compact ? 28 : 34} scanning={scanning} />
        {!compact && (
          <span
            className="text-shimmer brand-text"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 14,
              fontWeight: 700,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {BRAND}
          </span>
        )}
      </button>

      {/* Center — pulsing service dots on all breakpoints; theme switcher desktop only */}
      <div
        className="health-dots"
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: compact ? 10 : 16,
          minWidth: 0,
          padding: compact ? "0 2px" : undefined,
        }}
      >
        <ServiceHealthDots compact={compact} dense={isMobile} />
        {!compact && <ThemeSwitcher />}
      </div>

      {/* PACS — top bar on all breakpoints (was floating over main area) */}
      {onOpenPacs && (
        <button
          type="button"
          className="pacs-header-btn"
          onClick={onOpenPacs}
          title="Open PACS browser"
          style={{
            flexShrink: 0,
            marginLeft: compact ? 0 : 12,
            marginRight: compact ? 8 : 0,
            padding: compact ? "5px 10px" : "6px 12px",
            fontSize: compact ? 9 : 10,
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
          }}
        >
          <span aria-hidden>🗄️</span>
          <span>PACS</span>
        </button>
      )}

      {/* Right Actions */}
      {!compact ? (
        /* Desktop: full action bar */
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={onCommandPalette}
            className="btn-ghost"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--glass-border)",
              fontSize: 11,
            }}
            title="Command Palette (Ctrl+K)"
          >
            <span style={{ opacity: 0.5 }}>⌘</span>K
          </button>
          <button
            className="btn-ghost"
            style={{
              padding: "6px 12px",
              borderRadius: "var(--r-sm)",
              border: "1px solid var(--glass-border)",
              fontSize: 11,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
            title="Case History"
            onClick={() => router.push("/analyse/history")}
          >
            <span>📜</span>
            <span>History</span>
          </button>
          <button
            className="btn-ghost"
            style={{ fontSize: 16, padding: 8 }}
            title="Settings"
            onClick={() => router.push("/analyse/settings")}
          >
            ⚙
          </button>
        </div>
      ) : (
        /* Mobile/Tablet: overflow menu */
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            style={{
              background: "none",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
              color: "var(--text-55)",
              fontSize: 16,
              padding: "6px 10px",
              cursor: "pointer",
              minHeight: 36,
              minWidth: 36,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Menu"
          >
            ⋮
          </button>
          {menuOpen && (
            <div
              style={{
                position: "absolute",
                top: "calc(100% + 4px)",
                right: 0,
                background: "rgba(10,14,28,0.98)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--r-md)",
                padding: 4,
                minWidth: 160,
                zIndex: 60,
                boxShadow: "var(--shadow-lg)",
                animation: "fadeIn 0.15s ease-out",
              }}
            >
              {([
                { label: "◐ Theme", action: () => {} , isTheme: true as const },
                { label: "⌘ Command Palette", action: () => { onCommandPalette?.(); setMenuOpen(false); }, isTheme: false as const },
                { label: "📜 History", action: () => { router.push("/analyse/history"); setMenuOpen(false); }, isTheme: false as const },
                { label: "⚙ Settings", action: () => { router.push("/analyse/settings"); setMenuOpen(false); }, isTheme: false as const },
              ] as const).map((item) => (
                item.isTheme ? (
                  <div key="theme" style={{ padding: "8px 12px", borderBottom: "1px solid var(--glass-border)" }}>
                    <ThemeSwitcher compact />
                  </div>
                ) :
                <button
                  key={item.label}
                  onClick={item.action}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "10px 12px",
                    background: "none",
                    border: "none",
                    color: "var(--text-80)",
                    fontFamily: "var(--font-display)",
                    fontSize: 12,
                    cursor: "pointer",
                    borderRadius: "var(--r-sm)",
                    transition: "background 0.15s",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.background = "none";
                  }}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </header>
  );
}
