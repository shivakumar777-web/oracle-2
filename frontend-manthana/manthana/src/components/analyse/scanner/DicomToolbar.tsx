"use client";
import React, { useState, useCallback } from "react";
import type { DicomViewportHandle } from "./DicomViewport";
import type { DicomViewportState, DicomActiveTool } from "@/lib/analyse/types";
import { WINDOWING_PRESETS, type WindowingPreset } from "@/lib/analyse/windowingPresets";

interface Props {
  viewportRef: React.RefObject<DicomViewportHandle>;
  state: DicomViewportState;
  onStateChange: (state: DicomViewportState) => void;
  hasImage: boolean;
}

const TOOLS: { id: DicomActiveTool; icon: string; label: string; title: string }[] = [
  { id: "WindowLevel", icon: "◑", label: "W/L", title: "Window / Level (drag to adjust brightness & contrast)" },
  { id: "Pan",        icon: "✥", label: "Pan", title: "Pan (drag to move image)" },
  { id: "Zoom",       icon: "⌖", label: "Zoom", title: "Zoom (drag up/down)" },
  { id: "Length",     icon: "⟵", label: "Length", title: "Length measurement in mm" },
  { id: "EllipticalROI", icon: "⬡", label: "ROI", title: "Elliptical ROI — area + mean HU" },
  { id: "RectangleROI", icon: "⬜", label: "Rect", title: "Rectangle ROI — area + mean HU" },
  { id: "Angle",      icon: "∠", label: "Angle", title: "Angle measurement" },
];

export default function DicomToolbar({ viewportRef, state, onStateChange, hasImage }: Props) {
  const [wwInput, setWwInput] = useState(String(state.windowState.windowWidth));
  const [wcInput, setWcInput] = useState(String(state.windowState.windowCenter));
  const [presetsOpen, setPresetsOpen] = useState(false);

  // Sync inputs when state changes externally
  React.useEffect(() => {
    setWwInput(String(state.windowState.windowWidth));
    setWcInput(String(state.windowState.windowCenter));
  }, [state.windowState.windowWidth, state.windowState.windowCenter]);

  const applyPreset = useCallback((preset: WindowingPreset) => {
    viewportRef.current?.applyPreset(preset);
    setPresetsOpen(false);
    onStateChange({
      ...state,
      windowState: { windowWidth: preset.ww, windowCenter: preset.wc, preset: preset.id },
    });
  }, [viewportRef, state, onStateChange]);

  const applyWwWc = useCallback(() => {
    const ww = parseInt(wwInput, 10);
    const wc = parseInt(wcInput, 10);
    if (isNaN(ww) || isNaN(wc)) return;
    viewportRef.current?.setWindowLevel(ww, wc);
    onStateChange({
      ...state,
      windowState: { windowWidth: ww, windowCenter: wc, preset: "custom" },
    });
  }, [wwInput, wcInput, viewportRef, state, onStateChange]);

  const setTool = useCallback((tool: DicomActiveTool) => {
    viewportRef.current?.setTool(tool);
    onStateChange({ ...state, activeTool: tool });
  }, [viewportRef, state, onStateChange]);

  const goSlice = useCallback((dir: 1 | -1) => {
    if (dir > 0) viewportRef.current?.nextSlice();
    else viewportRef.current?.prevSlice();
  }, [viewportRef]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const idx = parseInt(e.target.value, 10);
    viewportRef.current?.setSlice(idx);
    onStateChange({
      ...state,
      seriesState: { ...state.seriesState, currentIndex: idx },
    });
  }, [viewportRef, state, onStateChange]);

  if (!hasImage) return null;

  const { windowState: ws, seriesState: ss, activeTool } = state;
  const isMultiFrame = ss.totalFrames > 1;
  const activePreset = WINDOWING_PRESETS.find((p) => p.id === ws.preset);

  return (
    <div
      className="dicom-toolbar"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: "rgba(4, 8, 15, 0.88)",
        backdropFilter: "blur(20px) saturate(120%)",
        borderBottom: "1px solid rgba(0,196,176,0.1)",
        flexWrap: "wrap",
        userSelect: "none",
        zIndex: 30,
      }}
    >
      {/* ── DICOM badge ── */}
      <span
        className="font-mono"
        style={{
          fontSize: 8,
          color: "var(--scan-400)",
          border: "1px solid rgba(0,196,176,0.25)",
          borderRadius: 3,
          padding: "2px 6px",
          letterSpacing: "0.12em",
          background: "rgba(0,196,176,0.06)",
          flexShrink: 0,
        }}
      >
        DICOM
      </span>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

      {/* ── Windowing Preset Picker ── */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setPresetsOpen((v) => !v)}
          className="font-display"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "3px 10px",
            borderRadius: 4,
            border: "1px solid rgba(0,196,176,0.2)",
            background: "rgba(0,196,176,0.06)",
            color: "var(--scan-300)",
            fontSize: 9,
            cursor: "pointer",
            letterSpacing: "0.06em",
            whiteSpace: "nowrap",
            textTransform: "uppercase",
          }}
        >
          {activePreset?.icon || "⬛"} {activePreset?.label || "Custom"}
          <span style={{ opacity: 0.5, fontSize: 7, marginLeft: 2 }}>▾</span>
        </button>

        {/* Preset dropdown */}
        {presetsOpen && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              marginTop: 4,
              background: "rgba(8, 14, 28, 0.97)",
              backdropFilter: "blur(20px)",
              border: "1px solid rgba(0,196,176,0.15)",
              borderRadius: 6,
              padding: "4px 0",
              zIndex: 100,
              minWidth: 160,
              boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
            }}
          >
            {WINDOWING_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => applyPreset(preset)}
                title={preset.description}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  width: "100%",
                  padding: "5px 12px",
                  background: ws.preset === preset.id ? "rgba(0,196,176,0.08)" : "transparent",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  color: ws.preset === preset.id ? "var(--scan-400)" : "var(--text-55)",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.04)"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ws.preset === preset.id ? "rgba(0,196,176,0.08)" : "transparent"; }}
              >
                <span style={{ fontSize: 11 }}>{preset.icon}</span>
                <span className="font-display" style={{ fontSize: 9, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                  {preset.label}
                </span>
                <span className="font-mono" style={{ fontSize: 8, color: "var(--text-30)", marginLeft: "auto" }}>
                  {preset.ww}/{preset.wc}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── WW / WC Inputs ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <span className="font-mono" style={{ fontSize: 8, color: "var(--text-30)", letterSpacing: "0.1em" }}>WW</span>
        <input
          type="number"
          value={wwInput}
          onChange={(e) => setWwInput(e.target.value)}
          onBlur={applyWwWc}
          onKeyDown={(e) => e.key === "Enter" && applyWwWc()}
          className="dicom-ww-input"
          style={{
            width: 52,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 3,
            color: "var(--text-80)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "2px 4px",
            textAlign: "center",
          }}
        />
        <span className="font-mono" style={{ fontSize: 8, color: "var(--text-30)", letterSpacing: "0.1em" }}>WC</span>
        <input
          type="number"
          value={wcInput}
          onChange={(e) => setWcInput(e.target.value)}
          onBlur={applyWwWc}
          onKeyDown={(e) => e.key === "Enter" && applyWwWc()}
          className="dicom-ww-input"
          style={{
            width: 52,
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 3,
            color: "var(--text-80)",
            fontFamily: "var(--font-mono)",
            fontSize: 9,
            padding: "2px 4px",
            textAlign: "center",
          }}
        />
      </div>

      {/* Divider */}
      <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />

      {/* ── Tool Buttons ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, flexWrap: "nowrap" }}>
        {TOOLS.map((tool) => {
          const isActive = activeTool === tool.id;
          return (
            <button
              key={tool.id}
              onClick={() => setTool(tool.id)}
              title={tool.title}
              className="dicom-tool-btn"
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "3px 7px",
                borderRadius: 4,
                border: isActive
                  ? "1px solid rgba(0, 196, 176, 0.4)"
                  : "1px solid rgba(255,255,255,0.06)",
                background: isActive
                  ? "rgba(0, 196, 176, 0.12)"
                  : "rgba(255,255,255,0.02)",
                cursor: "pointer",
                transition: "all 0.2s ease",
                boxShadow: isActive ? "0 0 8px rgba(0,196,176,0.2)" : "none",
                minWidth: 28,
              }}
            >
              <span style={{ fontSize: 11, color: isActive ? "var(--scan-400)" : "var(--text-55)", lineHeight: 1 }}>
                {tool.icon}
              </span>
              <span
                className="font-mono"
                style={{
                  fontSize: 6,
                  color: isActive ? "var(--scan-300)" : "var(--text-30)",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  marginTop: 1,
                }}
              >
                {tool.label}
              </span>
            </button>
          );
        })}

        {/* Reset View */}
        <button
          onClick={() => viewportRef.current?.resetView()}
          title="Reset view (fit to window)"
          className="dicom-tool-btn"
          style={{
            padding: "3px 7px",
            borderRadius: 4,
            border: "1px solid rgba(255,255,255,0.06)",
            background: "rgba(255,255,255,0.02)",
            cursor: "pointer",
            color: "var(--text-55)",
            fontSize: 9,
            letterSpacing: "0.06em",
            fontFamily: "var(--font-mono)",
          }}
        >
          FIT
        </button>
      </div>

      {/* Divider */}
      {isMultiFrame && <div style={{ width: 1, height: 20, background: "rgba(255,255,255,0.07)", flexShrink: 0 }} />}

      {/* ── Slice Navigator ── */}
      {isMultiFrame && (
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <button
            onClick={() => goSlice(-1)}
            className="dicom-tool-btn"
            title="Previous slice (←)"
            style={{
              padding: "3px 6px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-55)",
              fontSize: 10,
            }}
          >
            ◀
          </button>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <span className="font-mono" style={{ fontSize: 9, color: "var(--text-55)", minWidth: 52, textAlign: "center" }}>
              {ss.currentIndex + 1} / {ss.totalFrames}
            </span>
            <input
              type="range"
              min={0}
              max={ss.totalFrames - 1}
              value={ss.currentIndex}
              onChange={handleSliderChange}
              className="dicom-slice-slider"
              style={{
                width: 80,
                height: 3,
                appearance: "none",
                WebkitAppearance: "none",
                background: `linear-gradient(90deg, rgba(0,196,176,0.6) 0%, rgba(0,196,176,0.6) ${(ss.currentIndex / (ss.totalFrames - 1)) * 100}%, rgba(255,255,255,0.06) ${(ss.currentIndex / (ss.totalFrames - 1)) * 100}%)`,
                borderRadius: 2,
                outline: "none",
                cursor: "pointer",
              }}
            />
          </div>

          <button
            onClick={() => goSlice(1)}
            className="dicom-tool-btn"
            title="Next slice (→)"
            style={{
              padding: "3px 6px",
              borderRadius: 4,
              border: "1px solid rgba(255,255,255,0.06)",
              background: "transparent",
              cursor: "pointer",
              color: "var(--text-55)",
              fontSize: 10,
            }}
          >
            ▶
          </button>
        </div>
      )}
    </div>
  );
}
