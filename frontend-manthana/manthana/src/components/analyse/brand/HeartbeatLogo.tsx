"use client";
import React from "react";

interface Props {
  size?: number;
  scanning?: boolean;
}

/**
 * Living Heartbeat Logo — the brand mark that breathes.
 * Idle: slow breath (3s). Scanning: fast teal pulse (0.8s). Complete: gold flash.
 */
export default function HeartbeatLogo({ size = 36, scanning = false }: Props) {
  const r = size / 2;
  const ringR = r - 4;
  const innerR = r - 10;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      style={{ flexShrink: 0 }}
    >
      {/* Outer glow ring */}
      <circle
        cx={r}
        cy={r}
        r={ringR}
        stroke={scanning ? "var(--scan-500)" : "var(--gold-500)"}
        strokeWidth={1.5}
        strokeOpacity={0.3}
        fill="none"
        style={{
          animation: scanning
            ? "heartbeatScan 0.8s ease-in-out infinite"
            : "heartbeat 3s ease-in-out infinite",
          transformOrigin: "center",
        }}
      />

      {/* Middle ring */}
      <circle
        cx={r}
        cy={r}
        r={ringR - 4}
        stroke={scanning ? "var(--scan-400)" : "var(--gold-400)"}
        strokeWidth={1}
        strokeOpacity={scanning ? 0.6 : 0.2}
        fill="none"
        strokeDasharray={scanning ? "4 6" : "none"}
        style={{
          animation: scanning ? "heartbeatScan 1.2s ease-in-out infinite" : "none",
          transformOrigin: "center",
        }}
      />

      {/* Core — inner circle */}
      <circle
        cx={r}
        cy={r}
        r={innerR}
        fill={scanning ? "var(--scan-900)" : "var(--gold-900)"}
        stroke={scanning ? "var(--scan-500)" : "var(--gold-500)"}
        strokeWidth={1}
        strokeOpacity={0.5}
      />

      {/* Center cross / scan symbol (idle color: --heartbeat-cross; Clinical = light on navy core) */}
      <line
        x1={r - 4}
        y1={r}
        x2={r + 4}
        y2={r}
        stroke={scanning ? "var(--scan-400)" : "var(--heartbeat-cross)"}
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      <line
        x1={r}
        y1={r - 4}
        x2={r}
        y2={r + 4}
        stroke={scanning ? "var(--scan-400)" : "var(--heartbeat-cross)"}
        strokeWidth={1.5}
        strokeLinecap="round"
      />

      {/* Teal scan glow (only during scanning) */}
      {scanning && (
        <circle
          cx={r}
          cy={r}
          r={ringR + 2}
          stroke="var(--scan-500)"
          strokeWidth={2}
          fill="none"
          strokeOpacity={0.15}
          style={{
            filter: "blur(3px)",
            animation: "pulse 1.5s ease-in-out infinite",
          }}
        />
      )}
    </svg>
  );
}
