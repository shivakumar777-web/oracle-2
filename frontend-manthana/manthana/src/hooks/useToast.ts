"use client";

import { createContext, useContext, useState, useCallback } from "react";
import React from "react";

export type ToastSeverity = "error" | "warning" | "success" | "info";

export interface ToastItem {
  id: string;
  message: string;
  severity: ToastSeverity;
  dismissAfterMs: number;
}

interface ToastContextValue {
  toasts: ToastItem[];
  addToast: (message: string, severity?: ToastSeverity, dismissAfterMs?: number) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue>({
  toasts: [],
  addToast: () => {},
  removeToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (message: string, severity: ToastSeverity = "error", dismissAfterMs: number = 5000) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-4), { id, message, severity, dismissAfterMs }]);
      if (dismissAfterMs > 0) {
        setTimeout(() => removeToast(id), dismissAfterMs);
      }
    },
    [removeToast]
  );

  return React.createElement(
    ToastContext.Provider,
    { value: { toasts, addToast, removeToast } },
    children
  );
}
