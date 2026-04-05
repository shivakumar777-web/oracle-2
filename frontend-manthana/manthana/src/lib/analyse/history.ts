/* ═══ Scan History — localStorage persistence ═══ */

export type HistoryStatus = "draft" | "scan_done" | "report_generated";

export interface HistoryEntry {
  id: string;           // session id (generated once per page load)
  timestamp: number;    // ms since epoch
  modality: string;     // e.g. "xray", "mri"
  patientId: string;    // e.g. "ANONYMOUS-001"
  imageCount: number;
  findingsCount: number;
  severity: "critical" | "warning" | "info" | "clear" | null;
  impression: string;
  status: HistoryStatus;
}

const KEY = "manthana_history_v1";

function loadAll(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]") as HistoryEntry[];
  } catch {
    return [];
  }
}

function saveAll(entries: HistoryEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries));
  } catch {
    // localStorage full or unavailable — silent fail
  }
}

/** Upsert an entry (insert or replace by id). */
export function saveEntry(entry: HistoryEntry) {
  const all = loadAll();
  const idx = all.findIndex((e) => e.id === entry.id);
  if (idx >= 0) {
    all[idx] = entry;
  } else {
    all.unshift(entry);
  }
  saveAll(all);
}

/** Update fields of an existing entry by id. */
export function patchEntry(id: string, patch: Partial<HistoryEntry>) {
  const all = loadAll();
  const idx = all.findIndex((e) => e.id === id);
  if (idx >= 0) {
    all[idx] = { ...all[idx], ...patch };
    saveAll(all);
  }
}

/** Return all entries sorted newest first. */
export function getEntries(): HistoryEntry[] {
  return loadAll().sort((a, b) => b.timestamp - a.timestamp);
}

/** Delete a single entry. */
export function deleteEntry(id: string) {
  saveAll(loadAll().filter((e) => e.id !== id));
}
