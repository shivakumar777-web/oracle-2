"use client";
import React from "react";
import { MODALITIES } from "@/lib/analyse/constants";
import { useMediaQuery } from "@/hooks/analyse/useMediaQuery";

interface Props {
  selectedModalities: string[];
  onToggle: (modalityId: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MultiModelSelector({
  selectedModalities,
  onToggle,
  onConfirm,
  onCancel,
}: Props) {
  const { isMobile, isTablet } = useMediaQuery();
  const compact = isMobile || isTablet;
  const selectableModalities = MODALITIES.filter((m) => m.id !== "auto");
  const canConfirm = selectedModalities.length >= 2;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--mm-overlay)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        animation: "fadeIn 0.3s ease-out",
      }}
    >
      <div
        className="multi-model-selector"
        style={{
          width: compact ? "95%" : "90%",
          maxWidth: compact ? "none" : 720,
          maxHeight: "85vh",
          background: "var(--mm-bg)",
          border: "1px solid var(--mm-border)",
          borderRadius: "var(--r-lg)",
          padding: 0,
          overflow: "hidden",
          boxShadow: "var(--mm-shadow)",
          animation: "fadeIn 0.4s ease-out",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: compact ? "16px 16px 12px" : "24px 28px 16px",
            borderBottom: "1px solid var(--mm-header-border)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <h2
                className="font-display"
                style={{
                  fontSize: 14,
                  color: "var(--mm-pill-text-active)",
                  letterSpacing: "0.15em",
                  textTransform: "uppercase",
                  margin: 0,
                }}
              >
                ✦ Multi-Model Selection
              </h2>
              <p
                className="font-body"
                style={{
                  fontSize: 11,
                  color: "var(--text-30)",
                  marginTop: 6,
                }}
              >
                Select 2 to 4 modalities for cross-modality unified analysis
              </p>
            </div>
            <div
              className="font-mono"
              style={{
                fontSize: 11,
                color: selectedModalities.length >= 2 ? "var(--mm-pill-text-active)" : "var(--text-30)",
                padding: "5px 12px",
                background: selectedModalities.length >= 2 ? "var(--mm-pill-bg)" : "var(--mm-counter-bg-idle)",
                borderRadius: "var(--r-full)",
                border: `1px solid ${selectedModalities.length >= 2 ? "var(--mm-pill-border)" : "var(--glass-border)"}`,
                transition: "all 0.3s",
              }}
            >
              {selectedModalities.length}/4 selected
            </div>
          </div>
        </div>

        {/* Modality Grid */}
        <div
          style={{
            padding: compact ? "12px 12px" : "20px 28px",
            overflowY: "auto",
            flex: 1,
          }}
          className="no-scrollbar"
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(auto-fill, minmax(${compact ? "120px" : "160px"}, 1fr))`,
              gap: 10,
            }}
          >
            {selectableModalities.map((m) => {
              const isSelected = selectedModalities.includes(m.id);
              const isDisabled = !isSelected && selectedModalities.length >= 4;

              return (
                <button
                  key={m.id}
                  onClick={() => !isDisabled && onToggle(m.id)}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-start",
                    gap: 8,
                    padding: "14px 16px",
                    background: isSelected
                      ? "var(--mm-card-bg-selected)"
                      : "var(--mm-card-bg)",
                    border: `1.5px solid ${
                      isSelected ? "var(--mm-card-border-selected)" : "var(--mm-card-border)"
                    }`,
                    borderRadius: "var(--r-md)",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.35 : 1,
                    transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    textAlign: "left",
                    fontFamily: "var(--font-display)",
                    position: "relative",
                    overflow: "hidden",
                    boxShadow: isSelected ? "var(--mm-card-glow-selected)" : "none",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected) {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--mm-card-hover-border)";
                      (e.currentTarget as HTMLElement).style.background = "var(--mm-card-hover-bg)";
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      (e.currentTarget as HTMLElement).style.borderColor = "var(--mm-card-border)";
                      (e.currentTarget as HTMLElement).style.background = "var(--mm-card-bg)";
                    }
                  }}
                >
                  {/* Selection checkmark */}
                  {isSelected && (
                    <div
                      style={{
                        position: "absolute",
                        top: 8,
                        right: 8,
                        width: 18,
                        height: 18,
                        borderRadius: "50%",
                        background: "var(--gold-500)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 10,
                        color: "var(--mm-check-fg)",
                        fontWeight: 700,
                        animation: "fadeIn 0.2s ease-out",
                      }}
                    >
                      ✓
                    </div>
                  )}

                  {/* Icon + Label */}
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.08em", color: isSelected ? "var(--mm-pill-text-active)" : "#e53e3e" }}>{m.icon}</span>
                    <span
                      style={{
                        fontSize: 11,
                        color: isSelected ? "var(--mm-pill-text-active)" : "var(--text-80)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {m.label}
                    </span>
                  </div>

                  {/* Description */}
                  <p
                    className="font-body"
                    style={{
                      fontSize: 9,
                      color: "var(--text-55)",
                      lineHeight: 1.4,
                      margin: 0,
                    }}
                  >
                    {m.description}
                  </p>

                  {/* Models count */}
                  <div
                    className="font-mono"
                    style={{
                      fontSize: 8,
                      color: "var(--mm-model-tag-fg)",
                      padding: "2px 6px",
                      background: "var(--mm-model-tag-bg)",
                      borderRadius: "var(--r-full)",
                    }}
                  >
                    {m.models.length} model{m.models.length > 1 ? "s" : ""}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Info banner */}
        <div
          style={{
            padding: compact ? "10px 12px" : "12px 28px",
            background: "var(--mm-banner-bg)",
            borderTop: "1px solid var(--mm-banner-border)",
          }}
        >
          <p
            className="font-body"
            style={{
              fontSize: 10,
              color: "var(--text-55)",
              lineHeight: 1.5,
              margin: 0,
              display: "flex",
              alignItems: "flex-start",
              gap: 8,
            }}
          >
            <span className="font-mono" style={{ fontSize: 10, fontWeight: 700, color: "var(--mm-pill-text-active)", letterSpacing: "0.08em", flexShrink: 0 }}>AI</span>
            <span>
              <strong style={{ color: "var(--mm-pill-text-active)" }}>Multi-Model Analysis:</strong> AI analyzes each modality
              independently with specialized models, then the clinical language model synthesizes a unified cross-modality report for
              the highest diagnostic accuracy.
            </span>
          </p>
        </div>

        {/* Action buttons */}
        <div
          style={{
            padding: compact ? "12px 12px 16px" : "16px 28px 20px",
            display: "flex",
            flexDirection: compact ? "column" : "row" as const,
            gap: 10,
            justifyContent: compact ? "stretch" : "flex-end",
            borderTop: "1px solid var(--mm-footer-border)",
          }}
        >
          <button
            className="btn-ghost"
            onClick={onCancel}
            style={{
              padding: "8px 20px",
              fontSize: 11,
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            Cancel
          </button>
          <button
            className={canConfirm ? "btn-gold" : "btn-ghost"}
            onClick={canConfirm ? onConfirm : undefined}
            disabled={!canConfirm}
            style={{
              padding: "8px 24px",
              fontSize: 11,
              opacity: canConfirm ? 1 : 0.4,
              cursor: canConfirm ? "pointer" : "not-allowed",
            }}
          >
            Continue with {selectedModalities.length} Modalities →
          </button>
        </div>
      </div>
    </div>
  );
}
