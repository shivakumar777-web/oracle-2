"use client";

import React from "react";

export const ecgInputStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.04)",
  border: "1px solid var(--glass-border)",
  borderRadius: "var(--r-sm)",
  padding: "7px 10px",
  color: "var(--text-100)",
  fontFamily: "var(--font-display)",
  fontSize: 12,
  outline: "none",
  width: "100%",
  transition: "border-color var(--dur-fast)",
};

export const ecgSelectStyle: React.CSSProperties = {
  ...ecgInputStyle,
  appearance: "none",
  backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1L5 5L9 1' stroke='%23555' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 10px center",
  paddingRight: 28,
};

export function EcgLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <label
      className="text-caption"
      style={{
        color: "var(--text-15)",
        fontSize: 8,
        marginBottom: 3,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      {children}
      {hint ? (
        <span title={hint} style={{ cursor: "help", color: "var(--scan-400)", fontSize: 10 }}>
          ⓘ
        </span>
      ) : null}
    </label>
  );
}

export function EcgFieldGrid({ children, compact }: { children: React.ReactNode; compact: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
        gap: 8,
      }}
    >
      {children}
    </div>
  );
}
