"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearNudgeState,
  incrementNudgeCount,
  isIosLike,
  setDismissedForever,
  shouldShowPwaNudge,
} from "@/lib/pwa-install-nudge";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function useMobilePwaInstallNudge() {
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    setIsIos(isIosLike());
    if (shouldShowPwaNudge()) setOpen(true);
    setReady(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onBip = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const onInstalled = () => {
      clearNudgeState();
      setOpen(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    return () => window.removeEventListener("appinstalled", onInstalled);
  }, []);

  const closeNotNow = useCallback(() => {
    incrementNudgeCount();
    setOpen(false);
  }, []);

  const closeForever = useCallback(() => {
    setDismissedForever();
    setOpen(false);
  }, []);

  const tryNativeInstall = useCallback(async () => {
    const ev = deferredRef.current;
    if (!ev) return;
    await ev.prompt();
    await ev.userChoice;
    deferredRef.current = null;
    setCanNativeInstall(false);
  }, []);

  return {
    open: ready && open,
    isIos,
    canNativeInstall,
    closeNotNow,
    closeForever,
    tryNativeInstall,
  };
}
