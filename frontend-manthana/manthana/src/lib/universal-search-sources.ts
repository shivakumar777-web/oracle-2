/**
 * Universal Search — domain → source pill IDs.
 * Runtime values are fetched from `GET /v1/config/domain-sources` (see `fetchDomainSources`).
 * This file is the SSR / offline fallback only — do not edit manually for drift-sensitive lists;
 * update `services/shared/domain_sources.py` instead.
 * Spec: /manthana-universal-search-map.md
 */

/** Per-tradition default connectors (pills). PubMed / ClinicalTrials are API connectors on the backend. */
export const DOMAIN_UNIVERSAL_SOURCES: Record<string, string[]> = {
  allopathy: [
    "pubmed",
    "clinicaltrials",
    "cochrane",
    "who",
    "embase",
    "radiopaedia",
    "uptodate",
    "ctri-india",
    "who-iris",
    "europe-pmc",
    "who-gim",
    "indmed",
    "cdsco",
    "icmr",
    "nice",
    "nccih",
  ],
  ayurveda: [
    "ccras",
    "ayush-formulary",
    "ayush-portal",
    "pcimh",
    "pharmacopoeia-ayush",
    "shodhganga",
    "niimh",
    "tkdl",
    "imppat",
    "nmpb",
    "frlht-medplant",
    "jaim",
    "pubmed",
    "cochrane",
    "doaj",
    "indian-journals",
    "nccih",
  ],
  homeopathy: [
    "ccrh",
    "pcimh",
    "core-hom",
    "homeopathy-research",
    "pubmed",
    "cochrane",
    "doaj",
    "nccih",
  ],
  siddha: [
    "ccrs",
    "pcimh",
    "shodhganga",
    "nis-chennai",
    "tnmgrmu",
    "pubmed",
    "doaj",
    "indian-journals",
    "ayush-formulary",
    "niimh",
  ],
  unani: [
    "ccrum",
    "pcimh",
    "shodhganga",
    "nium",
    "hamdard-medicus",
    "who-emro",
    "imemr",
    "jamia-hamdard",
    "amu-unani",
    "pubmed",
    "doaj",
    "indian-journals",
  ],
};

/** Extra pills when 2+ traditions are selected (cross-domain backbone). */
export const INTEGRATIVE_CROSS_DOMAIN_CORE: string[] = [
  "europe-pmc",
  "ctri-india",
  "who-iris",
  "ayush-portal",
  "shodhganga",
  "pcimh",
  "nccih",
  "who-gim",
  "ecam",
  "pubmed",
  "doaj",
  "cochrane",
];

export function getUniversalSources(
  domains: string[],
  runtimeDomainMap?: Record<string, string[]>,
  runtimeIntegrative?: string[],
): string[] {
  const map = runtimeDomainMap ?? DOMAIN_UNIVERSAL_SOURCES;
  const core = runtimeIntegrative ?? INTEGRATIVE_CROSS_DOMAIN_CORE;
  const sources = new Set<string>();
  domains.forEach((d) => {
    (map[d] || []).forEach((s) => sources.add(s));
  });
  if (domains.length >= 2) {
    core.forEach((s) => sources.add(s));
  }
  return Array.from(sources);
}
