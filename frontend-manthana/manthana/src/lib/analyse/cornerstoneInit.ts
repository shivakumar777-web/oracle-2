/**
 * Cornerstone3D Singleton Initializer
 * Call once before any DICOM rendering. Safe to call multiple times.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initCornerstone(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    // Dynamic imports — Cornerstone3D uses browser APIs (WebGL, canvas)
    // so it MUST be loaded client-side only
    const [
      { init: csInit, getRenderingEngine, RenderingEngine },
      { init: csToolsInit },
      csLoader,
      dicomParser,
    ] = await Promise.all([
      import("@cornerstonejs/core"),
      import("@cornerstonejs/tools"),
      import("@cornerstonejs/dicom-image-loader"),
      import("dicom-parser"),
    ]);

    // Wire dicom-image-loader to cornerstone core + dicom-parser
    const loader = csLoader as any;
    if (loader.external) {
      loader.external.cornerstone = await import("@cornerstonejs/core");
      loader.external.dicomParser = dicomParser;
    }

    // Configure image loader for performance
    if (loader.configure) {
      loader.configure({
        useWebWorkers: true,
        decodeConfig: {
          convertFloatPixelDataToInt: false,
          use16BitDataType: true,
        },
      });
    }

    // Initialize max concurrent requests
    if (loader.webWorkerManager) {
      const config = {
        maxWebWorkers: Math.max(1, Math.floor(navigator.hardwareConcurrency / 2)),
        startWebWorkersOnDemand: true,
        taskConfiguration: {
          decodeTask: {
            initializeCodecsOnStartup: false,
          },
        },
      };
      loader.webWorkerManager.initialize(config);
    }

    await csInit();
    await csToolsInit();

    initialized = true;
    initPromise = null;
  })();

  return initPromise;
}

export function isCornerstoneInitialized(): boolean {
  return initialized;
}

/**
 * Generate a unique rendering engine ID per viewer instance
 */
export function makeRenderingEngineId(): string {
  return `manthana-cs-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Generate imageIds for a File array using wadouri: scheme
 * Cornerstone3D loads from an object URL via wadouri: prefix
 */
export function fileToImageId(file: File): string {
  const objectUrl = URL.createObjectURL(file);
  return `wadouri:${objectUrl}`;
}

/**
 * Sort DICOM files by InstanceNumber tag for correct slice order.
 * Falls back to filename order if parsing fails.
 */
export async function sortDicomFiles(files: File[]): Promise<File[]> {
  try {
    const dicomParser = await import("dicom-parser");
    const withNumbers: { file: File; instanceNum: number }[] = await Promise.all(
      files.map(async (file) => {
        try {
          const buffer = await file.arrayBuffer();
          const byteArray = new Uint8Array(buffer.slice(0, 4096)); // Read header only
          const dataSet = dicomParser.parseDicom(byteArray, { untilTag: "x00200013" });
          const instanceNum = parseInt(dataSet.string("x00200013") || "0", 10);
          return { file, instanceNum };
        } catch {
          return { file, instanceNum: 0 };
        }
      })
    );
    return withNumbers
      .sort((a, b) => a.instanceNum - b.instanceNum)
      .map((x) => x.file);
  } catch {
    // Parser not available, return as-is
    return files;
  }
}
