"use client";

import React, { useEffect, useState } from "react";
import { useToast, type ToastSeverity } from "@/hooks/useToast";

const SEVERITY_STYLES: Record<ToastSeverity, { bg: string; border: string; icon: string }> = {
  error:   { bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.5)",  icon: "✕" },
  warning: { bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.5)", icon: "⚠" },
  success: { bg: "rgba(34,197,94,0.12)",  border: "rgba(34,197,94,0.5)",  icon: "✓" },
  info:    { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.5)", icon: "ℹ" },
};

function ToastNotification({
  id,
  message,
  severity,
  dismissAfterMs,
}: {
  id: string;
  message: string;
  severity: ToastSeverity;
  dismissAfterMs: number;
}) {
  const { removeToast } = useToast();
  const [visible, setVisible] = useState(false);
  const style = SEVERITY_STYLES[severity];

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    setTimeout(() => removeToast(id), 300);
  };

  return (
    <div
      role="alert"
      className="font-ui text-[12px] text-cream/90 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-xl backdrop-blur-md"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}`,
        transform: visible ? "translateX(0)" : "translateX(120%)",
        opacity: visible ? 1 : 0,
        transition: "all 0.3s cubic-bezier(0.16, 1, 0.3, 1)",
        maxWidth: 420,
      }}
    >
      <span className="text-[14px] flex-shrink-0">{style.icon}</span>
      <span className="flex-1 leading-snug">{message}</span>
      <button
        type="button"
        onClick={handleDismiss}
        className="flex-shrink-0 w-5 h-5 rounded-full border border-white/20 flex items-center justify-center text-[10px] text-cream/60 hover:text-cream hover:border-cream/50"
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

export default function ToastContainer() {
  const { toasts } = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed z-[9999] flex flex-col gap-2 top-[max(1rem,env(safe-area-inset-top,0px))] right-[max(1rem,env(safe-area-inset-right,0px))]"
      aria-live="polite"
      aria-label="Notifications"
    >
      {toasts.map((toast) => (
        <ToastNotification key={toast.id} {...toast} />
      ))}
    </div>
  );
}
