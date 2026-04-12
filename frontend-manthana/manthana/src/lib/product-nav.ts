/**
 * Slim product (default): Oracle chat + Labs + History/Settings only.
 * Set NEXT_PUBLIC_FULL_MANTHANA_NAV=1 to show Deep Research, Medtrace, Clinical tools.
 */
export function isFullManthanaNav(): boolean {
  const v = (process.env.NEXT_PUBLIC_FULL_MANTHANA_NAV || "").toLowerCase().trim();
  return v === "1" || v === "true" || v === "yes";
}
