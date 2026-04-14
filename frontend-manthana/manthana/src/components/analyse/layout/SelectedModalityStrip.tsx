"use client";

import React, { useMemo } from "react";
import { AI_ORCHESTRATION_ENABLED } from "@/lib/analyse/constants";
import {
  formatModalityPeek,
  orchestrationSerial,
  resolveModalityMeta,
} from "@/lib/analyse/modality-display";

const ACCENT: Record<string, string> = {
  auto: "0,196,176",
  xray: "100,180,255",
  ct_brain_vista: "255,200,120",
  premium_ct_unified: "255,180,90",
};

const DEFAULT_RGB = "0,196,176";

interface Props {
  modalityId: string;
  /** Tighter padding on small viewports */
  compact?: boolean;
}

/**
 * Always-visible summary of the modality chosen in the bar (default: Auto-Detect).
 * Placed above the scan viewport so upload + findings context stay aligned.
 */
export default function SelectedModalityStrip({ modalityId, compact }: Props) {
  const { rgb, serialLabel, icon, labelLine } = useMemo(() => {
    const meta = resolveModalityMeta(modalityId);
    const rgb = ACCENT[modalityId] ?? DEFAULT_RGB;
    const serial = orchestrationSerial(modalityId);
    let serialLabel: string;
    if (serial === "auto") serialLabel = "—";
    else if (serial !== null && AI_ORCHESTRATION_ENABLED) serialLabel = `M-${serial}`;
    else serialLabel = "";

    const icon = meta?.icon ?? "?";
    const labelLine = formatModalityPeek(modalityId);

    return { rgb, serialLabel, icon, labelLine };
  }, [modalityId]);

  return (
    <div
      className="glass-panel no-print"
      role="status"
      aria-live="polite"
      style={{
        padding: compact ? "8px 12px" : "10px 16px",
        borderRadius: 0,
        borderTop: "1px solid rgba(255,255,255,0.06)",
        borderBottom: "none",
        display: "flex",
        alignItems: "center",
        gap: compact ? 8 : 10,
        flexWrap: "wrap",
        background: `linear-gradient(90deg, rgba(${rgb},0.08) 0%, rgba(0,0,0,0.12) 100%)`,
      }}
    >
      <span
        className="font-mono"
        style={{
          fontSize: 8,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: "var(--text-30)",
          flexShrink: 0,
        }}
      >
        Active modality
      </span>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          minWidth: 0,
          flex: "1 1 auto",
        }}
      >
        {serialLabel ? (
          <span
            className="font-mono"
            style={{
              fontSize: compact ? 10 : 10,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: `rgb(${rgb})`,
              flexShrink: 0,
              width: compact ? 40 : 44,
              textAlign: "right",
            }}
          >
            {serialLabel}
          </span>
        ) : null}
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: "0.1em",
            color: `rgb(${rgb})`,
            flexShrink: 0,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            width: 1,
            height: 12,
            background: `rgba(${rgb},0.35)`,
            flexShrink: 0,
          }}
        />
        <span
          className="font-display"
          style={{
            fontSize: compact ? 10 : 11,
            fontWeight: 600,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            color: "var(--text-80)",
            minWidth: 0,
            lineHeight: 1.35,
          }}
        >
          {labelLine}
        </span>
      </div>
    </div>
  );
}
