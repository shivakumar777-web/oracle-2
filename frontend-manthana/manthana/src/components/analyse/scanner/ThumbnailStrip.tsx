"use client";
import React, { useState } from "react";
import type { ImageScan } from "@/lib/analyse/types";

interface Props {
  images: ImageScan[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onRemove: (index: number) => void;
  onAddFiles: () => void;
  onAddCamera: () => void;
}

export default function ThumbnailStrip({
  images,
  activeIndex,
  onSelect,
  onRemove,
  onAddFiles,
  onAddCamera,
}: Props) {
  const [showMenu, setShowMenu] = useState(false);

  if (images.length === 0) return null;

  const isScanning = (stage: string) =>
    !["idle", "complete", "error"].includes(stage);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "6px 12px",
        overflowX: "auto",
        borderTop: "1px solid var(--glass-border)",
        background: "rgba(0,0,0,0.25)",
        flexShrink: 0,
      }}
      className="no-scrollbar"
    >
      {images.map((img, i) => {
        const isActive = i === activeIndex;
        const scanning = isScanning(img.stage);
        const done = img.stage === "complete";
        const hasCritical = img.result?.findings?.some(
          (f) => f.severity === "critical"
        );

        return (
          <div
            key={img.id}
            onClick={() => onSelect(i)}
            style={{
              position: "relative",
              width: 40,
              height: 40,
              flexShrink: 0,
              borderRadius: 6,
              overflow: "hidden",
              cursor: "pointer",
              border: isActive
                ? "2px solid var(--scan-500)"
                : "2px solid transparent",
              boxShadow: isActive ? "0 0 12px rgba(0,196,176,0.3)" : "none",
              opacity: isActive ? 1 : 0.7,
              transition: "all 0.2s ease",
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={`Scan ${i + 1}`}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />

            {scanning && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  background: "rgba(0,0,0,0.5)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div
                  style={{
                    width: 14,
                    height: 14,
                    border: "2px solid transparent",
                    borderTopColor: "var(--scan-400)",
                    borderRadius: "50%",
                    animation: "spin 0.8s linear infinite",
                  }}
                />
              </div>
            )}

            {done && (
              <div
                style={{
                  position: "absolute",
                  bottom: 1,
                  right: 1,
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  background: hasCritical ? "var(--critical)" : "var(--clear)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 8,
                  color: "#fff",
                  fontWeight: 700,
                }}
              >
                {hasCritical ? "!" : "✓"}
              </div>
            )}

            <div
              style={{
                position: "absolute",
                top: 1,
                left: 1,
                fontSize: 7,
                fontFamily: "var(--font-mono)",
                background: "rgba(0,0,0,0.6)",
                color: "var(--text-55)",
                padding: "1px 3px",
                borderRadius: 3,
              }}
            >
              {i + 1}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove(i);
              }}
              style={{
                position: "absolute",
                top: 1,
                right: 1,
                width: 12,
                height: 12,
                borderRadius: "50%",
                background: "rgba(0,0,0,0.7)",
                border: "none",
                color: "var(--text-30)",
                fontSize: 7,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                opacity: 0.4,
                transition: "opacity 0.15s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = "0.4";
              }}
              title="Remove"
            >
              ×
            </button>
          </div>
        );
      })}

      {/* Add more — with file/camera popup */}
      <div style={{ position: "relative", flexShrink: 0 }}>
        <button
          onClick={() => setShowMenu(!showMenu)}
          style={{
            width: 40,
            height: 40,
            borderRadius: 6,
            border: showMenu
              ? "2px solid var(--scan-500)"
              : "2px dashed var(--glass-border)",
            background: showMenu
              ? "rgba(0,196,176,0.06)"
              : "rgba(255,255,255,0.02)",
            cursor: "pointer",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 1,
            color: showMenu ? "var(--scan-400)" : "var(--text-30)",
            transition: "all 0.2s",
          }}
          title="Add more images"
        >
          <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
          <span
            style={{
              fontSize: 6,
              fontFamily: "var(--font-display)",
              letterSpacing: "0.05em",
            }}
          >
            ADD
          </span>
        </button>

        {showMenu && (
          <div
            style={{
              position: "absolute",
              bottom: 46,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(12,24,48,0.95)",
              backdropFilter: "blur(16px)",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-md)",
              padding: 4,
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minWidth: 130,
              boxShadow: "var(--shadow-lg)",
              animation: "fadeIn 0.15s ease-out",
              zIndex: 10,
            }}
          >
            <button
              onClick={() => {
                setShowMenu(false);
                onAddFiles();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                background: "transparent",
                border: "none",
                color: "var(--text-80)",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: 11,
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Browse Files
            </button>
            <button
              onClick={() => {
                setShowMenu(false);
                onAddCamera();
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 12px",
                borderRadius: "var(--r-sm)",
                background: "transparent",
                border: "none",
                color: "var(--text-80)",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: 11,
                transition: "background 0.15s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              Camera
            </button>
          </div>
        )}
      </div>

      {images.length > 1 && (
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 2,
            flexShrink: 0,
            paddingLeft: 12,
          }}
        >
          <span
            className="font-mono"
            style={{ fontSize: 10, color: "var(--scan-400)" }}
          >
            {images.filter((i) => i.stage === "complete").length}/
            {images.length}
          </span>
          <span
            className="font-display"
            style={{
              fontSize: 8,
              color: "var(--text-15)",
              letterSpacing: "0.08em",
            }}
          >
            SCANNED
          </span>
        </div>
      )}
    </div>
  );
}
