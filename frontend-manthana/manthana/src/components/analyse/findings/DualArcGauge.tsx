"use client";
import React from "react";

interface Props {
  aiConfidence: number;     // 0-100
  clinicalScore?: number;   // 0-100 (optional)
  size?: number;
}

/**
 * Dual-Arc Confidence Gauge
 * Outer ring = AI model confidence (teal)
 * Inner ring = Clinical correlation (gold)
 */
export default function DualArcGauge({
  aiConfidence,
  clinicalScore,
  size = 120,
}: Props) {
  const center = size / 2;
  const outerR = center - 8;
  const innerR = center - 22;
  const circumOuter = 2 * Math.PI * outerR;
  const circumInner = 2 * Math.PI * innerR;

  const outerDash = (aiConfidence / 100) * circumOuter;
  const innerDash = clinicalScore
    ? (clinicalScore / 100) * circumInner
    : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Outer ring background */}
        <circle
          cx={center}
          cy={center}
          r={outerR}
          className="gauge-ring gauge-ring-bg"
          strokeWidth={4}
        />

        {/* Outer ring — AI confidence (teal) */}
        <circle
          cx={center}
          cy={center}
          r={outerR}
          className="gauge-ring gauge-ring-teal"
          strokeWidth={4}
          strokeDasharray={`${outerDash} ${circumOuter}`}
          strokeDashoffset={circumOuter * 0.25}
          transform={`rotate(-90 ${center} ${center})`}
          style={{
            animation: "confidenceFill 1.5s var(--ease-spring) forwards",
          }}
        />

        {/* Inner ring background */}
        {clinicalScore !== undefined && (
          <>
            <circle
              cx={center}
              cy={center}
              r={innerR}
              className="gauge-ring gauge-ring-bg"
              strokeWidth={3}
            />
            <circle
              cx={center}
              cy={center}
              r={innerR}
              className="gauge-ring gauge-ring-gold"
              strokeWidth={3}
              strokeDasharray={`${innerDash} ${circumInner}`}
              strokeDashoffset={circumInner * 0.25}
              transform={`rotate(-90 ${center} ${center})`}
              style={{
                animation: "confidenceFill 1.8s 0.3s var(--ease-spring) forwards",
              }}
            />
          </>
        )}

        {/* Center number */}
        <text
          x={center}
          y={center - 4}
          textAnchor="middle"
          dominantBaseline="central"
          fill="var(--text-100)"
          fontFamily="var(--font-display)"
          fontWeight="700"
          fontSize={size > 100 ? 28 : 22}
        >
          {aiConfidence}
        </text>
        <text
          x={center}
          y={center + 16}
          textAnchor="middle"
          fill="var(--text-30)"
          fontFamily="var(--font-display)"
          fontSize={10}
          letterSpacing="0.08em"
        >
          %
        </text>
      </svg>

      {/* Labels */}
      <div
        style={{
          display: "flex",
          gap: 16,
          fontFamily: "var(--font-display)",
          fontSize: 10,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <span style={{ color: "var(--scan-400)" }}>
          ◒ AI {aiConfidence}%
        </span>
        {clinicalScore !== undefined && (
          <span style={{ color: "var(--gold-400)" }}>
            ◒ Clinical {clinicalScore}%
          </span>
        )}
      </div>
    </div>
  );
}
