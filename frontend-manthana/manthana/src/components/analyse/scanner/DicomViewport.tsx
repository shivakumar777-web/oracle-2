"use client";
/**
 * DicomViewport — Cornerstone3D DICOM Renderer
 *
 * Handles: DICOM file loading, stack/volume rendering, windowing,
 * tool interactions (W/L, zoom, pan, scroll, measurements).
 * 
 * Client-only: must be dynamically imported with { ssr: false }
 */
import React, {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  useState,
} from "react";
import type {
  DicomViewportState,
  DicomMetadataType,
  DicomActiveTool,
} from "@/lib/analyse/types";
import { WINDOWING_PRESETS, getAutoPreset, getHULabel, type WindowingPreset } from "@/lib/analyse/windowingPresets";
import { initCornerstone, makeRenderingEngineId, fileToImageId, sortDicomFiles } from "@/lib/analyse/cornerstoneInit";

/* ═══ PUBLIC API (exposed via ref) ═══ */
export interface DicomViewportHandle {
  setWindowLevel: (ww: number, wc: number) => void;
  applyPreset: (preset: WindowingPreset) => void;
  nextSlice: () => void;
  prevSlice: () => void;
  setSlice: (index: number) => void;
  setTool: (tool: DicomActiveTool) => void;
  resetView: () => void;
  toggleMpr: () => void;
  getMetadata: () => DicomMetadataType | null;
}

interface Props {
  files: File[];
  onStateChange?: (state: DicomViewportState) => void;
  onMetadataExtracted?: (meta: DicomMetadataType) => void;
  onReady?: () => void;
  onError?: (err: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

/* ═══ COMPONENT ═══ */
const DicomViewport = forwardRef<DicomViewportHandle, Props>(
  ({ files, onStateChange, onMetadataExtracted, onReady, onError, className, style }, ref) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const engineRef = useRef<any>(null);
    const viewportRef = useRef<any>(null);
    const toolGroupRef = useRef<any>(null);
    const engineIdRef = useRef<string>(makeRenderingEngineId());
    const toolGroupIdRef = useRef<string>(`tg-${engineIdRef.current}`);
    const imageIdsRef = useRef<string[]>([]);
    const metadataRef = useRef<DicomMetadataType | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [huReadout, setHuReadout] = useState<string | null>(null);
    const [currentState, setCurrentState] = useState<DicomViewportState>({
      windowState: { windowWidth: 400, windowCenter: 40, preset: "default" },
      seriesState: { currentIndex: 0, totalFrames: 1 },
      activeTool: "WindowLevel",
      mprMode: false,
    });

    /* ── Extract DICOM metadata from first file ── */
    const extractMetadata = useCallback(async (file: File): Promise<DicomMetadataType> => {
      try {
        const { default: dicomParser } = await import("dicom-parser");
        const buffer = await file.arrayBuffer();
        const byteArray = new Uint8Array(buffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        const str = (tag: string) => {
          try { return dataSet.string(tag)?.trim() || undefined; } catch { return undefined; }
        };

        const meta: DicomMetadataType = {
          patientName: str("x00100010")?.replace(/\^/g, " "),
          patientId: str("x00100020"),
          patientAge: str("x00101010"),
          patientSex: str("x00100040"),
          studyDate: str("x00080020"),
          studyDescription: str("x00081030"),
          institutionName: str("x00080080"),
          modality: str("x00080060"),
          seriesDescription: str("x0008103e"),
          sliceThickness: str("x00500088") || str("x00180050"),
          pixelSpacing: str("x00280030"),
          instanceNumber: str("x00200013"),
          seriesCount: String(files.length),
          sliceLocation: str("x00201041"),
          bodyPartExamined: str("x00180015"),
        };

        return meta;
      } catch {
        return { seriesCount: String(files.length) };
      }
    }, [files.length]);

    /* ── Initialize Cornerstone3D viewport ── */
    useEffect(() => {
      if (!containerRef.current || files.length === 0) return;

      let destroyed = false;
      const container = containerRef.current;

      (async () => {
        try {
          setIsLoading(true);
          setError(null);

          // 1. Init Cornerstone3D
          await initCornerstone();
          if (destroyed) return;

          setLoadProgress(15);

          // 2. Sort DICOM files by InstanceNumber for correct slice order
          const sortedFiles = await sortDicomFiles(files);
          if (destroyed) return;

          // 3. Generate imageIds
          const imageIds = sortedFiles.map(fileToImageId);
          imageIdsRef.current = imageIds;

          setLoadProgress(30);

          // 4. Extract metadata from first file
          const meta = await extractMetadata(sortedFiles[0]);
          metadataRef.current = meta;
          if (!destroyed && onMetadataExtracted) {
            onMetadataExtracted(meta);
          }

          setLoadProgress(50);

          // 5. Dynamic imports (only after initCornerstone)
          const [
            { RenderingEngine, Enums: CsEnums },
            {
              ToolGroupManager,
              WindowLevelTool,
              ZoomTool,
              PanTool,
              StackScrollTool,
              LengthTool,
              EllipticalROITool,
              RectangleROITool,
              AngleTool,
              MagnifyTool,
              Enums: ToolEnums,
              annotation,
            },
          ] = await Promise.all([
            import("@cornerstonejs/core"),
            import("@cornerstonejs/tools"),
          ]);

          if (destroyed) return;
          setLoadProgress(65);

          // 6. Create rendering engine
          const renderingEngine = new RenderingEngine(engineIdRef.current);
          engineRef.current = renderingEngine;

          // 7. Add viewport
          const viewportInput = {
            viewportId: "viewport-main",
            type: CsEnums.ViewportType.STACK,
            element: container,
            defaultOptions: {
              background: [0, 0, 0] as [number, number, number],
            },
          };
          renderingEngine.setViewports([viewportInput]);
          const viewport = renderingEngine.getViewport("viewport-main") as any;
          viewportRef.current = viewport;

          setLoadProgress(80);

          // 8. Load image stack
          await viewport.setStack(imageIds);

          // 9. Apply auto windowing preset based on modality/body part
          const autoPreset = getAutoPreset(
            meta.modality || "",
            meta.bodyPartExamined || meta.seriesDescription || ""
          );
          viewport.setProperties({
            voiRange: {
              lower: autoPreset.wc - autoPreset.ww / 2,
              upper: autoPreset.wc + autoPreset.ww / 2,
            },
          });

          // 10. Create tool group
          const toolGroup = ToolGroupManager.createToolGroup(toolGroupIdRef.current);
          if (!toolGroup) throw new Error("Failed to create tool group");
          toolGroupRef.current = toolGroup;

          // Add tools
          toolGroup.addTool(WindowLevelTool.toolName);
          toolGroup.addTool(ZoomTool.toolName);
          toolGroup.addTool(PanTool.toolName);
          toolGroup.addTool(StackScrollTool.toolName);
          toolGroup.addTool(LengthTool.toolName);
          toolGroup.addTool(EllipticalROITool.toolName);
          toolGroup.addTool(RectangleROITool.toolName);
          toolGroup.addTool(AngleTool.toolName);

          toolGroup.addViewport("viewport-main", engineIdRef.current);

          // Set default active tools
          toolGroup.setToolActive(WindowLevelTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
          });
          toolGroup.setToolActive(ZoomTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Secondary }],
          });
          toolGroup.setToolActive(PanTool.toolName, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Auxiliary }],
          });
          toolGroup.setToolActive(StackScrollTool.toolName, {
            bindings: [],
          });

          // 11. Render
          renderingEngine.renderViewports(["viewport-main"]);

          setLoadProgress(100);
          setIsLoading(false);

          // 12. Update state
          const newState: DicomViewportState = {
            windowState: {
              windowWidth: autoPreset.ww,
              windowCenter: autoPreset.wc,
              preset: autoPreset.id,
            },
            seriesState: {
              currentIndex: 0,
              totalFrames: imageIds.length,
            },
            activeTool: "WindowLevel",
            mprMode: false,
          };
          setCurrentState(newState);
          onStateChange?.(newState);
          onReady?.();

          // 13. Mouse move for HU readout
          container.addEventListener("mousemove", (e: MouseEvent) => {
            try {
              const vp = viewportRef.current;
              if (!vp) return;
              const rect = container.getBoundingClientRect();
              const canvasPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
              const worldPoint = vp.canvasToWorld(canvasPoint);
              if (!worldPoint) return;
              const pixelData = vp.getImageData?.();
              if (!pixelData) return;
              // HU readout via pixel value
              const imagePoint = vp.worldToIndex?.(worldPoint);
              if (imagePoint) {
                const image = vp.getCornerstoneImage?.();
                if (image?.getPixelData) {
                  const w = image.width;
                  const idx = Math.round(imagePoint[1]) * w + Math.round(imagePoint[0]);
                  const raw = image.getPixelData()[idx];
                  if (raw !== undefined) {
                    const hu = raw * (image.slope ?? 1) + (image.intercept ?? 0);
                    setHuReadout(`${Math.round(hu)} HU · ${getHULabel(hu)}`);
                  }
                }
              }
            } catch {
              // HU readout is best-effort
            }
          });

        } catch (err: any) {
          if (!destroyed) {
            const msg = err?.message || "Failed to load DICOM";
            setError(msg);
            setIsLoading(false);
            onError?.(msg);
          }
        }
      })();

      return () => {
        destroyed = true;
        // Cleanup
        try {
          if (engineRef.current) {
            engineRef.current.destroy?.();
            engineRef.current = null;
          }
          if (toolGroupRef.current) {
            toolGroupRef.current = null;
          }
          // Revoke object URLs
          imageIdsRef.current.forEach((id) => {
            const url = id.replace("wadouri:", "");
            URL.revokeObjectURL(url);
          });
          imageIdsRef.current = [];
        } catch {
          // Cleanup errors are non-critical
        }
      };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [files]);

    /* ═══ IMPERATIVE HANDLE ═══ */
    useImperativeHandle(ref, () => ({
      setWindowLevel: (ww: number, wc: number) => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.setProperties({
          voiRange: { lower: wc - ww / 2, upper: wc + ww / 2 },
        });
        vp.render();
        setCurrentState((prev) => ({
          ...prev,
          windowState: { windowWidth: ww, windowCenter: wc, preset: "custom" },
        }));
      },

      applyPreset: (preset: WindowingPreset) => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.setProperties({
          voiRange: {
            lower: preset.wc - preset.ww / 2,
            upper: preset.wc + preset.ww / 2,
          },
        });
        vp.render();
        setCurrentState((prev) => ({
          ...prev,
          windowState: { windowWidth: preset.ww, windowCenter: preset.wc, preset: preset.id },
        }));
      },

      nextSlice: () => {
        const vp = viewportRef.current;
        if (!vp) return;
        const current = vp.getCurrentImageIdIndex?.() ?? 0;
        const total = imageIdsRef.current.length;
        if (current < total - 1) {
          vp.setImageIdIndex(current + 1);
          vp.render();
          setCurrentState((prev) => ({
            ...prev,
            seriesState: { ...prev.seriesState, currentIndex: current + 1 },
          }));
        }
      },

      prevSlice: () => {
        const vp = viewportRef.current;
        if (!vp) return;
        const current = vp.getCurrentImageIdIndex?.() ?? 0;
        if (current > 0) {
          vp.setImageIdIndex(current - 1);
          vp.render();
          setCurrentState((prev) => ({
            ...prev,
            seriesState: { ...prev.seriesState, currentIndex: current - 1 },
          }));
        }
      },

      setSlice: (index: number) => {
        const vp = viewportRef.current;
        if (!vp) return;
        const clamped = Math.max(0, Math.min(index, imageIdsRef.current.length - 1));
        vp.setImageIdIndex(clamped);
        vp.render();
        setCurrentState((prev) => ({
          ...prev,
          seriesState: { ...prev.seriesState, currentIndex: clamped },
        }));
      },

      setTool: async (tool: DicomActiveTool) => {
        const tg = toolGroupRef.current;
        if (!tg) return;
        const { ToolGroupManager, WindowLevelTool, ZoomTool, PanTool, LengthTool,
          EllipticalROITool, RectangleROITool, AngleTool, MagnifyTool,
          Enums: ToolEnums } = await import("@cornerstonejs/tools");

        const toolNameMap: Record<DicomActiveTool, string> = {
          WindowLevel: WindowLevelTool.toolName,
          Zoom: ZoomTool.toolName,
          Pan: PanTool.toolName,
          Length: LengthTool.toolName,
          EllipticalROI: EllipticalROITool.toolName,
          RectangleROI: RectangleROITool.toolName,
          Angle: AngleTool.toolName,
          Magnify: MagnifyTool?.toolName || "Magnify",
          Eraser: "Eraser",
        };

        const name = toolNameMap[tool];
        // Set previous primary tool to passive
        [WindowLevelTool.toolName, LengthTool.toolName, EllipticalROITool.toolName,
          RectangleROITool.toolName, AngleTool.toolName].forEach((t) => {
          try { tg.setToolPassive(t); } catch {}
        });
        // Activate new tool on primary mouse button
        try {
          tg.setToolActive(name, {
            bindings: [{ mouseButton: ToolEnums.MouseBindings.Primary }],
          });
        } catch {}
        setCurrentState((prev) => ({ ...prev, activeTool: tool }));
      },

      resetView: () => {
        const vp = viewportRef.current;
        if (!vp) return;
        vp.resetCamera(true);
        vp.render();
      },

      toggleMpr: () => {
        // MPR toggle is a future phase — placeholder
        setCurrentState((prev) => ({ ...prev, mprMode: !prev.mprMode }));
      },

      getMetadata: () => metadataRef.current,
    }));

    /* ═══ RENDER ═══ */
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", ...style }} className={className}>
        {/* The Cornerstone3D render target */}
        <div
          ref={containerRef}
          style={{
            width: "100%",
            height: "100%",
            minHeight: 420,
            background: "#000",
            cursor: "crosshair",
          }}
        />

        {/* Loading overlay */}
        {isLoading && !error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.85)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 16,
              zIndex: 50,
            }}
          >
            {/* Animated DICOM icon */}
            <div
              style={{
                width: 48,
                height: 48,
                border: "2px solid rgba(0,196,176,0.2)",
                borderTop: "2px solid var(--scan-400, #1DDFC8)",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
            <div style={{ textAlign: "center" }}>
              <p className="font-mono" style={{ fontSize: 10, color: "var(--scan-400, #1DDFC8)", letterSpacing: "0.15em", textTransform: "uppercase" }}>
                LOADING DICOM
              </p>
              <p className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)", marginTop: 4 }}>
                {loadProgress}% · {files.length} frame{files.length !== 1 ? "s" : ""}
              </p>
            </div>

            {/* Progress bar */}
            <div style={{ width: 160, height: 2, background: "rgba(255,255,255,0.06)", borderRadius: 1 }}>
              <div
                style={{
                  height: "100%",
                  width: `${loadProgress}%`,
                  background: "var(--scan-400, #1DDFC8)",
                  borderRadius: 1,
                  transition: "width 0.3s ease",
                  boxShadow: "0 0 8px rgba(0,196,176,0.4)",
                }}
              />
            </div>
          </div>
        )}

        {/* Error overlay */}
        {error && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              background: "rgba(0,0,0,0.9)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              zIndex: 50,
              padding: 24,
            }}
          >
            <span style={{ fontSize: 32 }}>⚠️</span>
            <p className="font-display" style={{ fontSize: 13, color: "#FF3B3B", textAlign: "center" }}>
              DICOM Load Failed
            </p>
            <p className="font-body" style={{ fontSize: 11, color: "var(--text-55, #888)", textAlign: "center", maxWidth: 280 }}>
              {error}
            </p>
            <p className="font-mono" style={{ fontSize: 9, color: "var(--text-30, #555)", textAlign: "center" }}>
              Try a different .dcm file or check the file is valid DICOM
            </p>
          </div>
        )}

        {/* HU Readout */}
        {!isLoading && !error && huReadout && (
          <div
            className="dicom-hu-readout"
            style={{
              position: "absolute",
              bottom: 52,
              right: 12,
              background: "rgba(0,0,0,0.65)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              padding: "3px 8px",
              pointerEvents: "none",
              zIndex: 15,
            }}
          >
            <span className="font-mono" style={{ fontSize: 9, color: "var(--scan-300, #5EEDDB)", letterSpacing: "0.08em" }}>
              {huReadout}
            </span>
          </div>
        )}

        {/* Slice indicator */}
        {!isLoading && !error && currentState.seriesState.totalFrames > 1 && (
          <div
            style={{
              position: "absolute",
              bottom: 12,
              right: 12,
              background: "rgba(0,0,0,0.55)",
              backdropFilter: "blur(8px)",
              border: "1px solid rgba(255,255,255,0.06)",
              borderRadius: 4,
              padding: "3px 8px",
              pointerEvents: "none",
              zIndex: 15,
            }}
          >
            <span className="font-mono" style={{ fontSize: 9, color: "var(--text-55, #888)", letterSpacing: "0.06em" }}>
              {currentState.seriesState.currentIndex + 1} / {currentState.seriesState.totalFrames}
            </span>
          </div>
        )}
      </div>
    );
  }
);

DicomViewport.displayName = "DicomViewport";
export default DicomViewport;
