"use client";

import { useEffect, useCallback } from "react";

export interface UseSearchKeyboardOptions {
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  resultCount: number;
  selectedIndex: number;
  onSelectIndex: (idx: number) => void;
  onOpenResult?: (idx: number) => void;
  onCopyCitation?: (idx: number) => void;
  onFocusSearch: () => void;
  enabled?: boolean;
}

/**
 * Keyboard shortcuts for search page (power-user navigation).
 * / = focus search, Tab = cycle tabs, j/k = navigate results, Enter = open, o = open new tab, c = copy citation, Esc = focus search
 */
export function useSearchKeyboard({
  searchInputRef,
  resultCount,
  selectedIndex,
  onSelectIndex,
  onOpenResult,
  onCopyCitation,
  onFocusSearch,
  enabled = true,
}: UseSearchKeyboardOptions) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore when typing in input/textarea
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable
      ) {
        // Allow Esc and / even in input
        if (e.key !== "Escape" && e.key !== "/") return;
        if (e.key === "/") {
          e.preventDefault();
          onFocusSearch();
          return;
        }
      }

      switch (e.key) {
        case "/":
          e.preventDefault();
          onFocusSearch();
          break;
        case "Escape":
          e.preventDefault();
          onFocusSearch();
          break;
        case "j":
        case "ArrowDown":
          if (resultCount > 0) {
            e.preventDefault();
            onSelectIndex(Math.min(selectedIndex + 1, resultCount - 1));
          }
          break;
        case "k":
        case "ArrowUp":
          if (resultCount > 0) {
            e.preventDefault();
            onSelectIndex(Math.max(selectedIndex - 1, 0));
          }
          break;
        case "Enter":
          if (resultCount > 0 && selectedIndex >= 0) {
            e.preventDefault();
            onOpenResult?.(selectedIndex);
          }
          break;
        case "o":
          if (resultCount > 0 && selectedIndex >= 0) {
            e.preventDefault();
            onOpenResult?.(selectedIndex);
          }
          break;
        case "c":
          if (resultCount > 0 && selectedIndex >= 0) {
            e.preventDefault();
            onCopyCitation?.(selectedIndex);
          }
          break;
        default:
          break;
      }
    },
    [
      enabled,
      resultCount,
      selectedIndex,
      onSelectIndex,
      onOpenResult,
      onCopyCitation,
      onFocusSearch,
    ]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);
}
