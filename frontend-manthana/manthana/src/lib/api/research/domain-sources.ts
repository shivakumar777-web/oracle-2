/**
 * Canonical domain → source map from research-service (Gap 3).
 */

import { RESEARCH_BASE } from "../config";

export interface DomainSourcesConfig {
  domain_auto_sources: Record<string, string[]>;
  integrative_core: string[];
  source_site_fragments: Record<string, string>;
}

let _cachedSources: DomainSourcesConfig | null = null;

export async function fetchDomainSources(
  force = false,
): Promise<DomainSourcesConfig> {
  if (!force && _cachedSources) return _cachedSources;
  const res = await fetch(`${RESEARCH_BASE}/config/domain-sources`, {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`domain-sources: ${res.status}`);
  }
  _cachedSources = (await res.json()) as DomainSourcesConfig;
  return _cachedSources;
}

export function clearDomainSourcesCache(): void {
  _cachedSources = null;
}
