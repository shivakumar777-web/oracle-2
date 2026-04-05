"use client";
import { useState, useEffect } from "react";

const BREAKPOINTS = {
  mobile: 480,
  tablet: 768,
  laptop: 1024,
  desktop: 1280,
} as const;

export interface MediaQueryState {
  isMobile: boolean;   // ≤480px
  isTablet: boolean;   // 481–768px
  isLaptop: boolean;   // 769–1024px
  isDesktop: boolean;  // >1024px
  isTouch: boolean;    // touch-capable device
  width: number;
}

export function useMediaQuery(): MediaQueryState {
  const [state, setState] = useState<MediaQueryState>({
    isMobile: false,
    isTablet: false,
    isLaptop: false,
    isDesktop: true,
    isTouch: false,
    width: 1280,
  });

  useEffect(() => {
    function update() {
      const w = window.innerWidth;
      setState({
        isMobile: w <= BREAKPOINTS.mobile,
        isTablet: w > BREAKPOINTS.mobile && w <= BREAKPOINTS.tablet,
        isLaptop: w > BREAKPOINTS.tablet && w <= BREAKPOINTS.laptop,
        isDesktop: w > BREAKPOINTS.laptop,
        isTouch:
          "ontouchstart" in window || navigator.maxTouchPoints > 0,
        width: w,
      });
    }

    update();

    // Debounced resize handler
    let timeout: ReturnType<typeof setTimeout>;
    function onResize() {
      clearTimeout(timeout);
      timeout = setTimeout(update, 100);
    }

    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(timeout);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return state;
}

export { BREAKPOINTS };
