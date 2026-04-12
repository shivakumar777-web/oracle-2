/**
 * Browser helpers for Pro Labs quotas (preflight + post-success record).
 */

export type PreflightLabsResponse =
  | {
      allowed: true;
      skipped?: boolean;
      tier?: string;
      plan?: string;
      trialRemaining?: number;
    }
  | {
      allowed: false;
      reason?: string;
      message?: string;
      limit?: number;
    };

export async function preflightLabsScan(
  modalityId: string
): Promise<PreflightLabsResponse> {
  const res = await fetch("/api/labs/preflight", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modalityId }),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    return {
      allowed: false,
      reason: "http_error",
      message:
        (typeof data.error === "string" && data.error) ||
        "Could not verify Labs quota. Try again.",
    };
  }
  return data as PreflightLabsResponse;
}

export async function recordLabsScan(
  modalityId: string
): Promise<{ ok: boolean; error?: string }> {
  const res = await fetch("/api/labs/record-scan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ modalityId }),
  });
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    /* ignore */
  }
  if (res.ok) {
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("manthana:product-access-invalidate"));
    }
    return { ok: true };
  }
  const msg =
    (typeof data.message === "string" && data.message) ||
    (typeof data.error === "string" && data.error) ||
    "Could not update Labs usage.";
  return { ok: false, error: msg };
}
