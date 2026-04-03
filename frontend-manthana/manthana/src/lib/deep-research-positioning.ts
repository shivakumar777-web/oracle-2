/**
 * Product positioning — Deep Research is vertical (multi-system medicine),
 * not a horizontal “answer the whole web” tool like generic AI search.
 *
 * Use these strings consistently in hero, empty state, settings, and docs.
 */
export const DEEP_RESEARCH_POSITIONING = {
  /** Primary headline — what this product is */
  headline:
    "Clinical & traditional research synthesis for multi-system medicine",

  /** Contrast with Perplexity-style general web oracles */
  notGeneralWebOracle:
    "Not a general web oracle — structured evidence across the traditions you select.",

  /** Short tagline (badges, tooltips, meta) */
  tagline: "Multi-system medicine research synthesis · not generic web search",

  /** Settings / engine panel one-liner */
  enginePurpose:
    "Structured synthesis across clinical and traditional sources — not open-ended web Q&A.",

  /** Step 1 — domain picker: any subset, not only “all five” */
  domainSelectionHint:
    "Select any combination you need — one tradition, several, or all five. Click again to deselect. When 2+ are selected, integrative retrieval adds a shared cross-domain source layer.",

  /** How this differs from Oracle M5 on the home page (use after a Link to /?mode=m5) */
  m5VersusDeepResearchShort:
    "runs a five-system chat comparison. Deep Research here builds one cited report using only the traditions you select.",
} as const;
