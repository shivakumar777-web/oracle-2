"use client";
import React, { useState, useRef, useCallback, useEffect } from "react";

interface Props {
  children: React.ReactNode;
  collapsedContent?: React.ReactNode;
  peekHeight?: number;
}

type SheetState = "collapsed" | "full";

export default function BottomSheet({
  children,
  collapsedContent,
  peekHeight = 72,
}: Props) {
  const [sheetState, setSheetState] = useState<SheetState>("collapsed");
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef({
    startY: 0,
    startHeight: 0,
    isDragging: false,
  });

  const heights: Record<SheetState, string> = {
    collapsed: `${peekHeight}px`,
    full: "100vh",
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragRef.current.startY = touch.clientY;
    dragRef.current.startHeight = sheetRef.current?.offsetHeight || 0;
    dragRef.current.isDragging = true;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragRef.current.isDragging || !sheetRef.current) return;
    const touch = e.touches[0];
    const deltaY = dragRef.current.startY - touch.clientY;
    const newHeight = Math.max(
      peekHeight,
      Math.min(window.innerHeight, dragRef.current.startHeight + deltaY)
    );
    sheetRef.current.style.height = `${newHeight}px`;
    sheetRef.current.style.transition = "none";
  }, [peekHeight]);

  const handleTouchEnd = useCallback(() => {
    if (!sheetRef.current) return;
    dragRef.current.isDragging = false;
    const currentHeight = sheetRef.current.offsetHeight;
    const windowHeight = window.innerHeight;
    sheetRef.current.style.transition = "height 0.4s cubic-bezier(0.32, 0.72, 0, 1)";

    // If dragged up more than 15% from collapsed, go full screen
    if (currentHeight > peekHeight + windowHeight * 0.15) {
      setSheetState("full");
    } else {
      setSheetState("collapsed");
    }
    sheetRef.current.style.height = "";
  }, [peekHeight]);

  // Toggle between collapsed and full — no half state
  const toggleSheet = useCallback(() => {
    setSheetState((prev) => (prev === "collapsed" ? "full" : "collapsed"));
  }, []);

  // Close on backdrop click
  const handleBackdropClick = useCallback(() => {
    setSheetState("collapsed");
  }, []);

  // Lock body scroll when expanded
  useEffect(() => {
    if (sheetState === "full") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [sheetState]);

  return (
    <>
      {/* Backdrop */}
      {sheetState === "full" && (
        <div
          onClick={handleBackdropClick}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 89,
            animation: "fadeIn 0.2s ease-out",
          }}
        />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: heights[sheetState],
          zIndex: 90,
          background: "linear-gradient(180deg, rgba(12,24,48,0.98) 0%, rgba(6,12,26,0.99) 100%)",
          borderTopLeftRadius: sheetState === "full" ? 0 : 16,
          borderTopRightRadius: sheetState === "full" ? 0 : 16,
          borderTop: sheetState === "full" ? "none" : "1px solid rgba(0,196,176,0.2)",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.5), 0 -2px 12px rgba(0,196,176,0.06)",
          transition: "height 0.4s cubic-bezier(0.32, 0.72, 0, 1)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Drag handle */}
        <div
          onClick={toggleSheet}
          style={{
            display: "flex",
            justifyContent: "center",
            padding: "10px 0 6px",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: 36,
              height: 4,
              borderRadius: 2,
              background: "rgba(0,196,176,0.35)",
              transition: "width 0.2s, background 0.2s",
              boxShadow: "0 0 8px rgba(0,196,176,0.15)",
            }}
          />
        </div>

        {/* Collapsed summary */}
        {sheetState === "collapsed" && collapsedContent && (
          <div
            onClick={toggleSheet}
            style={{
              padding: "0 16px 12px",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            {collapsedContent}
          </div>
        )}

        {/* Full content — scrollable, covers entire screen */}
        <div
          className="no-scrollbar"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflowY: "auto",
            WebkitOverflowScrolling: "touch",
            padding: sheetState === "collapsed" ? "0" : "0 4px 24px",
            opacity: sheetState === "collapsed" ? 0 : 1,
            transition: "opacity 0.2s",
            pointerEvents: sheetState === "collapsed" ? "none" : "auto",
          }}
        >
          {children}
        </div>
      </div>
    </>
  );
}
