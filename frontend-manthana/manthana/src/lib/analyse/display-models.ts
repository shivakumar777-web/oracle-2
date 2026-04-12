/**
 * User-facing labels for Labs `models_used` (OpenRouter slugs + internal tags).
 * SSOT for cloud models is repo `config/cloud_inference.yaml` (primary: Kimi K2.5).
 */

export const LABS_CLOUD_AI_PRIMARY = "Manthana Cloud AI (Kimi K2.5)";
export const LABS_CLOUD_AI_FALLBACK = "Manthana Cloud AI (fallback)";

/** Map API `models_used` entries to stable product labels; dedupe with {@link uniqueFormattedLabsModels}. */
export function formatLabsModelForDisplay(raw: string): string {
  const s = (raw || "").trim();
  if (!s) return s;
  const lower = s.toLowerCase();

  if (lower.includes("kimi")) return LABS_CLOUD_AI_PRIMARY;
  if (lower.includes("openrouter/free")) return LABS_CLOUD_AI_FALLBACK;

  if (
    lower.startsWith("openai/gpt-4") ||
    lower.startsWith("openai/gpt-3") ||
    lower.includes("gpt-4o")
  ) {
    return LABS_CLOUD_AI_FALLBACK;
  }
  if (lower.includes("llama-3") || lower.includes("meta-llama")) {
    return LABS_CLOUD_AI_FALLBACK;
  }
  if (lower.includes("claude") || lower.includes("anthropic/")) {
    return LABS_CLOUD_AI_FALLBACK;
  }
  if (
    lower.includes("qwen/") ||
    lower.includes("nemotron") ||
    lower.includes("stepfun/") ||
    lower.includes("arcee-ai/")
  ) {
    return LABS_CLOUD_AI_FALLBACK;
  }

  if (lower.startsWith("openrouter-")) {
    return LABS_CLOUD_AI_PRIMARY;
  }

  return s;
}

export function uniqueFormattedLabsModels(rawList: string[] | undefined): string[] {
  if (!rawList?.length) return [];
  return Array.from(new Set(rawList.map(formatLabsModelForDisplay).filter(Boolean)));
}
