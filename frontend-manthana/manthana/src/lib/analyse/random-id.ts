/**
 * Session / entity ids for client state. Safe during Next.js SSR when
 * `globalThis.crypto.randomUUID` is missing (e.g. older Node runtimes).
 */
export function randomId(): string {
  try {
    const c = globalThis.crypto;
    if (c && typeof c.randomUUID === "function") {
      return c.randomUUID();
    }
  } catch {
    /* ignore */
  }
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 11)}`;
}
