"use client";
import React, { useRef, useEffect, useCallback } from "react";
import type { Finding, HeatmapColorScheme } from "@/lib/analyse/types";

/* ═══════════════════════════════════════════════════════════
   ANATOMICAL REGION MAPPING — Maps finding region strings
   to fractional (cy, cx, radius) coordinates on the image
   ═══════════════════════════════════════════════════════════ */
const CHEST_REGIONS: Record<string, [number, number, number]> = {
  "right upper lobe":   [0.25, 0.35, 0.12],
  "right middle lobe":  [0.40, 0.35, 0.10],
  "right lower lobe":   [0.55, 0.35, 0.13],
  "left upper lobe":    [0.25, 0.65, 0.12],
  "left lower lobe":    [0.55, 0.65, 0.13],
  "right lung":         [0.40, 0.35, 0.18],
  "left lung":          [0.40, 0.65, 0.18],
  "right lung field":   [0.40, 0.35, 0.18],
  "left lung field":    [0.40, 0.65, 0.18],
  "cardiac silhouette": [0.50, 0.52, 0.14],
  "heart":              [0.50, 0.52, 0.14],
  "mediastinum":        [0.35, 0.50, 0.10],
  "diaphragm":          [0.70, 0.50, 0.16],
  "central venous line":[0.32, 0.48, 0.06],
  "aortic arch":        [0.25, 0.52, 0.08],
  "trachea":            [0.18, 0.50, 0.05],
};

const SEVERITY_INTENSITY: Record<string, number> = {
  critical: 1.0,
  warning:  0.7,
  info:     0.4,
  clear:    0.15,
};

function findRegionCoords(region: string): [number, number, number] {
  const lower = (region || "").toLowerCase().trim();
  for (const [key, coords] of Object.entries(CHEST_REGIONS)) {
    if (lower.includes(key)) return coords;
  }
  return [0.45, 0.50, 0.15];
}

/* ═══ JET COLORMAP ═══ */
function jetColor(t: number): [number, number, number] {
  const r = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 3)));
  const g = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 2)));
  const b = Math.min(1, Math.max(0, 1.5 - Math.abs(4 * t - 1)));
  return [r * 255, g * 255, b * 255];
}

function infernoColor(t: number): [number, number, number] {
  const r = Math.min(255, Math.max(0, t < 0.5 ? t * 2 * 180 : 180 + (t - 0.5) * 2 * 75));
  const g = Math.min(255, Math.max(0, t < 0.5 ? t * 2 * 40 : 40 + (t - 0.5) * 2 * 215));
  const b = Math.min(255, Math.max(0, t < 0.3 ? 40 + t * 3.33 * 180 : 220 - (t - 0.3) * 1.43 * 220));
  return [r, g, b];
}

function viridisColor(t: number): [number, number, number] {
  const r = Math.min(255, Math.max(0, 68 + t * (253 - 68)));
  const g = Math.min(255, Math.max(0, 1 + t * (231 - 1)));
  const b = Math.min(255, Math.max(0, 84 + (t < 0.5 ? t * 2 * (84) : (1 - t) * 2 * 84)));
  return [r, g, b];
}

function getColorFunc(scheme: HeatmapColorScheme) {
  switch (scheme) {
    case "inferno": return infernoColor;
    case "viridis": return viridisColor;
    default: return jetColor;
  }
}

/* ═══════════════════════════════════════════════════════════
   HEATMAP OVERLAY COMPONENT
   Canvas-based overlay rendered on top of the medical image
   ═══════════════════════════════════════════════════════════ */

interface Props {
  heatmapUrl: string | null;    // Server-generated heatmap PNG
  findings: Finding[];          // For client-side synthetic fallback
  opacity: number;              // 0-1
  zoom: number;
  activeFindingIndex: number | null;
  colorScheme: HeatmapColorScheme;
  imageWidth: number;
  imageHeight: number;
}

export default function HeatmapOverlay({
  heatmapUrl,
  findings,
  opacity,
  zoom,
  activeFindingIndex,
  colorScheme,
  imageWidth,
  imageHeight,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  /* ── Draw server-provided heatmap image ── */
  const drawServerHeatmap = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      if (!heatmapUrl) return;
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.clearRect(0, 0, w, h);
        ctx.globalAlpha = 1;
        ctx.drawImage(img, 0, 0, w, h);
      };
      img.src = heatmapUrl;
    },
    [heatmapUrl]
  );

  /* ── Generate client-side synthetic heatmap from findings ── */
  const drawSyntheticHeatmap = useCallback(
    (ctx: CanvasRenderingContext2D, w: number, h: number) => {
      const imageData = ctx.createImageData(w, h);
      const data = imageData.data;
      const colorFn = getColorFunc(colorScheme);

      // Compute per-pixel intensity from Gaussian blobs
      const intensityMap = new Float32Array(w * h);

      const findingsToRender =
        activeFindingIndex !== null
          ? [findings[activeFindingIndex]].filter(Boolean)
          : findings;

      for (const finding of findingsToRender) {
        if (!finding) continue;
        const [cy, cx, radius] = findRegionCoords(finding.region || "");
        const intensity =
          (SEVERITY_INTENSITY[finding.severity] ?? 0.5) *
          (finding.confidence / 100);

        const centerX = cx * w;
        const centerY = cy * h;
        const r = radius * Math.max(w, h);

        // Optimized: only iterate over bounding box of the blob
        const x0 = Math.max(0, Math.floor(centerX - r * 2));
        const x1 = Math.min(w, Math.ceil(centerX + r * 2));
        const y0 = Math.max(0, Math.floor(centerY - r * 2));
        const y1 = Math.min(h, Math.ceil(centerY + r * 2));

        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            const dx = (x - centerX) / r;
            const dy = (y - centerY) / r;
            const distSq = dx * dx + dy * dy;
            const val = Math.exp(-distSq * 2) * intensity;
            const idx = y * w + x;
            intensityMap[idx] = Math.max(intensityMap[idx], val);
          }
        }
      }

      // Apply colormap
      for (let i = 0; i < w * h; i++) {
        const t = Math.min(1, intensityMap[i]);
        if (t < 0.02) {
          // Transparent for very low values
          data[i * 4 + 3] = 0;
          continue;
        }
        const [r, g, b] = colorFn(t);
        data[i * 4] = r;
        data[i * 4 + 1] = g;
        data[i * 4 + 2] = b;
        data[i * 4 + 3] = Math.floor(t * 200); // Alpha proportional to intensity
      }

      ctx.putImageData(imageData, 0, 0);
    },
    [findings, activeFindingIndex, colorScheme]
  );

  /* ── Redraw on any change ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const w = imageWidth || 512;
    const h = imageHeight || 512;

    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, w, h);

    if (heatmapUrl) {
      drawServerHeatmap(ctx, w, h);
    } else if (findings.length > 0) {
      drawSyntheticHeatmap(ctx, w, h);
    }
  }, [
    heatmapUrl,
    findings,
    activeFindingIndex,
    colorScheme,
    imageWidth,
    imageHeight,
    drawServerHeatmap,
    drawSyntheticHeatmap,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="heatmap-overlay"
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        objectFit: "contain",
        opacity: opacity,
        pointerEvents: "none",
        mixBlendMode: "screen",
        transform: `scale(${zoom})`,
        transformOrigin: "center",
        transition: "opacity 0.4s ease",
      }}
    />
  );
}
