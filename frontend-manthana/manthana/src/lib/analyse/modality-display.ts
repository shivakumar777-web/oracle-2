/**
 * Shared labels for the active modality (picker + on-screen summary).
 */
import { AI_ORCHESTRATION_ENABLED, MODALITIES } from "@/lib/analyse/constants";
import { ORCHESTRATION_MODALITIES } from "@/lib/analyse/modalityRegistry";

export function resolveModalityMeta(modalityId: string) {
  const direct = MODALITIES.find((m) => m.id === modalityId);
  if (direct) return direct;
  if (modalityId === "ct") {
    return MODALITIES.find((m) => m.id === "ct_abdomen");
  }
  return undefined;
}

/** M-1 … M-95 index for orchestration modalities; auto is distinct. */
export function orchestrationSerial(modalityId: string): number | "auto" | null {
  if (modalityId === "auto") return "auto";
  const i = ORCHESTRATION_MODALITIES.findIndex((m) => m.id === modalityId);
  return i >= 0 ? i + 1 : null;
}

/** One line for bottom-sheet peek / subtitles (short). */
export function formatModalityPeek(modalityId: string): string {
  const meta = resolveModalityMeta(modalityId);
  if (!meta) return modalityId.replace(/_/g, " ");
  if (modalityId === "auto") return "Auto-Detect";
  const serial = orchestrationSerial(modalityId);
  if (serial !== null && serial !== "auto" && AI_ORCHESTRATION_ENABLED) {
    return `M-${serial} · ${meta.label}`;
  }
  return meta.label;
}
