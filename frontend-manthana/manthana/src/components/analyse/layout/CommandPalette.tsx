"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

interface Props {
  open: boolean;
  onClose: () => void;
  onUpload?: () => void;
  onNewScan?: () => void;
}

interface Command {
  id: string;
  icon: string;
  label: string;
  shortcut?: string;
  action: () => void;
}

export default function CommandPalette({ open, onClose, onUpload, onNewScan }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: Command[] = [
    { id: "upload", icon: "↑", label: "Upload Image", shortcut: "Ctrl+U", action: () => { onUpload?.(); onClose(); } },
    { id: "camera", icon: "◎", label: "Open Camera", action: () => onClose() },
    { id: "new", icon: "↻", label: "New Scan", action: () => { onNewScan?.(); onClose(); } },
    { id: "xray", icon: "✦", label: "Analyse as X-Ray", action: () => onClose() },
    { id: "brain", icon: "✦", label: "Analyse as Brain MRI", action: () => onClose() },
    { id: "cardiac", icon: "✦", label: "Analyse as Cardiac CT", action: () => onClose() },
    { id: "ecg", icon: "✦", label: "Analyse as ECG", action: () => onClose() },
    { id: "report", icon: "⊞", label: "Universal Report Engine", shortcut: "Ctrl+P", action: () => onClose() },
    { id: "history", icon: "≡", label: "View History", action: () => { router.push("/analyse/history"); onClose(); } },
    { id: "settings", icon: "⚙", label: "Settings", action: () => onClose() },
  ];

  const filtered = query
    ? commands.filter((c) =>
        c.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: 120,
        background: "rgba(0,0,0,0.6)",
        backdropFilter: "blur(8px)",
        animation: "fadeIn 0.15s ease-out",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="glass-panel"
        style={{
          width: "100%",
          maxWidth: 480,
          animation: "modalIn 0.2s var(--ease-out-expo)",
          overflow: "hidden",
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--glass-border)",
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}
        >
          <span className="font-mono" style={{ fontSize: 12, color: "var(--text-30)", fontWeight: 600 }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command…"
            className="font-display"
            style={{
              flex: 1,
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-100)",
              fontSize: 14,
              letterSpacing: "0.02em",
            }}
          />
          <span
            className="font-display"
            style={{
              fontSize: 10,
              color: "var(--text-15)",
              padding: "3px 8px",
              border: "1px solid var(--glass-border)",
              borderRadius: "var(--r-sm)",
            }}
          >
            ESC
          </span>
        </div>

        {/* Command list */}
        <div style={{ maxHeight: 320, overflowY: "auto", padding: 8 }}>
          {filtered.map((cmd) => (
            <button
              key={cmd.id}
              onClick={cmd.action}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                borderRadius: "var(--r-sm)",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontFamily: "var(--font-display)",
                fontSize: 13,
                color: "var(--text-80)",
                textAlign: "left",
                transition: "background var(--dur-fast)",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--glass-hover)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }}
            >
              <span style={{ fontSize: 16 }}>{cmd.icon}</span>
              <span style={{ flex: 1 }}>{cmd.label}</span>
              {cmd.shortcut && (
                <span
                  className="font-mono"
                  style={{
                    fontSize: 10,
                    color: "var(--text-15)",
                    padding: "2px 6px",
                    border: "1px solid var(--glass-border)",
                    borderRadius: 4,
                  }}
                >
                  {cmd.shortcut}
                </span>
              )}
            </button>
          ))}
          {filtered.length === 0 && (
            <p
              className="font-body"
              style={{ textAlign: "center", padding: 20, color: "var(--text-30)", fontStyle: "italic" }}
            >
              No commands found
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
