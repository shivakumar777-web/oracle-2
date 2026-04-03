# Manthana Deep Research — End-to-End Technical Report

*Generated from codebase analysis. Paths are relative to repository root unless noted.*

---

## 1. FRONTEND FLOW

### 1.1 Pages & layout

| Artifact | Role |
|----------|------|
| `frontend-manthana/manthana/src/app/deep-research/page.tsx` | Main Deep Research page: wires `useDeepResearch`, composes left wizard + right workspace, settings modal, originality flow, keyboard shortcut (Ctrl/Cmd+Enter → `runResearch`). |
| `frontend-manthana/manthana/src/app/deep-research/layout.tsx` | Next.js layout: `metadata` (title, description, Open Graph) for SEO/social previews. |

### 1.2 Components under `components/deep-research/`

| Component | Role |
|-----------|------|
| `StepIndicator.tsx` | Visual steps: **Domain → Intent → Depth → Research** (`STEPS` array). `activeStep` from hook (`1`–`4`). |
| `DomainSelector.tsx` | Renders `RESEARCH_DOMAINS` from config as selectable cards; **multi-select** via `onToggleDomain`; optional **All five** / **Clear** via `onSelectAll` / `onClearSelection`; expands **SubdomainGrid** per selected domain (`onToggleSubdomain`). |
| `SubdomainGrid.tsx` | Pills per domain subdomain; max **3** selected per domain (`current.length < 3` in hook). |
| `IntentSelector.tsx` | Renders `RESEARCH_INTENTS` (`deep-research-config.ts`); sets `researchIntent` id. |
| `DepthControls.tsx` | Depth tabs: `focused` \| `comprehensive` \| `exhaustive` (`DEPTH_CONFIG`); slider **15–600 s** → `depthSeconds` + auto-maps slider to depth level; shows **Universal Search** badge: unique source count from `RESEARCH_DOMAINS[].defaultSources` (via `DOMAIN_UNIVERSAL_SOURCES`); output format + citation style selectors. |
| `ResearchContextPill.tsx` | Summarizes selected domains, subdomain labels, intent, depth for display. |
| `ResearchBar.tsx` | Query input + submit + settings affordance. |
| `ResearchWorkspace.tsx` | Switches: **empty** (`WorkspaceEmptyState`) → **thinking** (`WorkspaceThinkingState`) → **result** (`WorkspaceResultState`) based on `state.result` / `state.isResearching`. |
| `WorkspaceEmptyState.tsx` | Empty workspace + traditions map + positioning copy. |
| `WorkspaceThinkingState.tsx` | Shows `activityLog` entries (from SSE `log` events) + query. |
| `WorkspaceResultState.tsx` | Renders sections (markdown/DOMPurify), citations, follow-ups, stats, integrative badge, export/copy, optional **Save** (`onSaveToServer`), **Check originality** → `checkOriginality` → `OriginalityPanel`. |
| `IntegrativeBadge.tsx` | Shown when `domains.length >= 2` (labels joined). |
| `ResearchTemplates.tsx` | Loads `RESEARCH_TEMPLATES` via `onLoad` → `loadTemplate` in hook. |
| `ResearchHistory.tsx` | Restores prior sessions from localStorage list (`restoreResearchSession`). |
| `SavedThreadsPanel.tsx` | Lists server threads (`GET` research threads API); restore via `restoreFromServerThread`. |
| `OriginalityPanel.tsx` | UI for plagiarism check states; **does not** call API itself — parent passes state/result. |

### 1.3 State hook: `useDeepResearch` (`hooks/useDeepResearch.ts`)

**`DeepResearchState` fields:**

| Field | Purpose |
|-------|---------|
| `selectedDomains: string[]` | Domain ids (`allopathy`, `ayurveda`, etc.). |
| `selectedSubdomains: Record<string, string[]>` | Per-domain subdomain ids (max 3 per domain enforced in `toggleSubdomain`). |
| `researchIntent: string \| null` | Intent id from `RESEARCH_INTENTS` or `null` until chosen. |
| `depth: DepthLevel` | `focused` \| `comprehensive` \| `exhaustive`. |
| `depthSeconds: number` | Target wall-clock cap (slider); default `60`. |
| `sourceFilters: string[]` | **Universal Search** pill ids; updated by `toggleDomain`, `selectAllDomains`, `clearDomainSelection`, `loadTemplate`, `restore*` via `getUniversalSources` / `getDefaultSources`. |
| `outputFormat` | `structured` \| `summary` \| `bullets`. |
| `citationStyle` | `vancouver` \| `apa` \| `mla` \| `icmr` \| `harvard`. |
| `query: string` | Research question text. |
| `isResearching`, `activityLog`, `result`, `error` | Run lifecycle. |
| `activeStep: 1 \| 2 \| 3 \| 4` | Wizard progression; step 4 = results. |

**Validation on run:** `runResearch` returns early if `!state.query.trim()` **or** `state.selectedDomains.length === 0`. No separate Zod/schema validation on the client beyond that.

**Domain / subdomain downstream:** `runResearch` builds `flatSubdomains = Object.values(state.selectedSubdomains).flat()` — **subdomains are flattened to a single string array**; **per-domain association is lost** in the API payload.

**Source pills:** `state.sourceFilters` = `getUniversalSources(selectedDomains)` whenever domains change (`toggleDomain`, `selectAllDomains`, etc.). **Not** user-editable in UI anymore (`toggleSource` is deprecated no-op in hook).

**Streaming / SSE (client):** `deepResearchStream` (`lib/api/research/client.ts`) POSTs to `${RESEARCH_BASE}/deep-research/stream`, reads `text/event-stream`, parses `data: ` JSON lines. For each event: `log` → `onEvent` → hook appends to `activityLog`; after stream completes, assembles `DeepResearchResult` from accumulated `section`, `citations`, `followup`, `done` events. **`deepResearchStream` return value** builds `domains_consulted` / `subdomains_consulted` from **request body** (`body.domains`, `body.subdomains`), not from server echo.

**Local history:** On success, writes `DeepResearchHistoryEntry` to `localStorage` key `manthana_deep_research_history` (max 50), dispatches `deep-research-history-updated`. `restoreResearchSession` loads entry back into state (result cleared, `activeStep` → 3).

**Save thread:** `saveCurrentResultToServer` → `createResearchThread` (`lib/api/research/threads.ts`) with `settings` payload including domains, subdomains, intent, depth, `depthSeconds`, sources, formats, `lang`; `result` object.

**Originality:** `page.tsx` / `WorkspaceResultState` builds text from sections, calls `checkOriginality` (`lib/api/research/client.ts`) → `POST ${RESEARCH_BASE}/plagiarism/check`. On localhost failure, **mock** result returned after delay (see `MOCK_PLAGIARISM`).

### 1.4 Supporting libs

| File | Role |
|------|------|
| `lib/deep-research-config.ts` | `RESEARCH_DOMAINS` (subdomains, colors, `defaultSources: DOMAIN_UNIVERSAL_SOURCES[...]`), `RESEARCH_INTENTS`, `RESEARCH_TEMPLATES`, `DEPTH_CONFIG`, `SOURCE_FILTERS` (catalog; not the runtime universal list). |
| `lib/universal-search-sources.ts` | `DOMAIN_UNIVERSAL_SOURCES`, `INTEGRATIVE_CROSS_DOMAIN_CORE`, `getUniversalSources`. |
| `lib/deep-research-positioning.ts` | Marketing/scope strings for hero and steps. |
| `lib/activity-log-simulator.ts` | `estimateResearchTime()` used by **page** for footer estimate; **`generateActivitySequence()` exists but is not wired** to the live research run (the thinking UI uses **real** SSE `log` lines only). |
| `lib/citation-format.ts` | Used by `WorkspaceResultState` for reference formatting (imported there). |

---

## 2. API CONTRACT

### 2.1 Endpoints (research-service)

| Method | Path | Router |
|--------|------|--------|
| POST | `/v1/deep-research` (under app `API_PREFIX`) | `services/research-service/routers/research.py` → `deep_research` |
| POST | `/v1/deep-research/stream` | same → `deep_research_stream` |

Frontend base: `RESEARCH_BASE` = `RESEARCH_ORIGIN` + `NEXT_PUBLIC_API_VERSION` (default `/v1`) — `lib/api/config.ts`.

### 2.2 Request body: `DeepResearchRequest`

**Source of truth (server):** `services/shared/models.py` — class `DeepResearchRequest`.

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| `query` | `Optional[str]` | **Effective required** | Max 2000 chars; combined with `question` via `question_text` property. |
| `question` | `Optional[str]` | No | Alias for `query`. |
| `domains` | `List[str]` | No (empty allowed but frontend blocks run) | Max length 20. |
| `subdomains` | `List[str]` | No | Max 50; **flat list** on wire. |
| `intent` | `Optional[str]` | No | Default `"clinical"`. |
| `depth` | `Optional[str]` | No | Default `"comprehensive"`; drives `_DEPTH_BUDGET`. |
| `sources` | `List[str]` | No | “Pill” ids; if **empty** and `domains` non-empty, server auto-fills via `_auto_sources_for_domains`. |
| `output_format` | `Optional[str]` | No | Default `structured`; `summary`, `bullets` alter section templates. |
| `citation_style` | `Optional[str]` | No | Default `vancouver`. |
| `lang` | `Optional[str]` | No | Default `en`. |
| `deep` | `Optional[bool]` | No | Default `True` — **not read by `orchestrator.py` for retrieval/synthesis** (present for API compatibility). |
| `stream` | `Optional[bool]` | No | Default `False` — **server streaming is chosen by route**, not this flag. |
| `target_seconds` | `Optional[float]` | No | Wall-clock budget cap for **whole pipeline** (see below). |

**`question_text` property:** `(query or question).strip()[:2000]`.

### 2.3 `target_seconds` calculation / passing

- **Frontend:** `useDeepResearch.runResearch` sends `target_seconds: state.depthSeconds` (slider 15–600).
- **Backend:** `orchestrator._effective_total_timeout(budget, target_sec)` — `budget` from `_depth_config(depth)`; `base = budget["timeout"] + 120.0` (retrieval + Groq headroom); if `target_seconds > 0`, returns **`min(base, target_seconds)`**; else `base`. Used in `asyncio.wait_for` / stream deadline. **So user slider can shorten the max time but also caps below the depth-based base when smaller.**

### 2.4 Sync response (`POST /deep-research`)

- Wrapped in JSON envelope: `{ status, service, data, error, request_id }` per router.
- **`data`** matches `DeepResearchResult`-shaped dict: `query`, `domains_consulted`, `subdomains_consulted`, `intent`, `sections`, `citations`, `sources_searched`, `time_taken_seconds`, `generated_at`, `integrative_mode`, `followup_questions`, `citation_style`.

### 2.5 SSE (`POST /deep-research/stream`)

**Event types emitted (Python dicts → JSON in `data: ` lines):**

| `type` | Payload fields | Purpose |
|--------|----------------|--------|
| `log` | `text` | Status messages for UI activity log. |
| `section` | `id`, `title`, `content` | One section (repeated per section). |
| `citations` | `data` (list) | Citation objects. |
| `followup` | `questions` (list) | Follow-up questions. |
| `done` | `meta`: `sources_searched`, `time_taken_seconds`, `integrative_mode`, `request_id`, `citation_style` | Stream complete. |
| `error` | `message` | Error; client throws after read completes. |

**TypeScript mirror:** `frontend-manthana/manthana/src/lib/api/research/types.ts` — `DeepResearchStreamEvent` union.

### 2.6 Frontend TS request type

`DeepResearchRequest` in `types.ts` uses `query: string` (required in TS) and matches fields above; **`deep` and `stream` always sent** as `true` in `runResearch`.

---

## 3. BACKEND PIPELINE (`research-service`)

### 3.1 Entry points

| Function | File | Role |
|----------|------|------|
| `run_research` | `services/research-service/orchestrator.py` | Sync path: retrieve → `synthesize_research_report` → return dict. |
| `stream_research_events` | same | SSE: yields `log` → retrieve → `log` → synthesize → `section`×N → `citations` → `followup` → `done`; timeout/error branches yield `error` + `done`. |

**Router:** `services/research-service/routers/research.py` — checks `RESEARCH_ENABLE_CITATIONS`; calls orchestrator.

### 3.2 Ordered pipeline (happy path)

1. **Parse** `DeepResearchRequest`; extract `question` = `question_text`.
2. **`_depth_config(depth)`** → `per_connector`, `total_cap`, `perplexica_mode`, `timeout`, `searxng_limit` from `_DEPTH_BUDGET` (`focused` / `comprehensive` / `exhaustive`).
3. **`_effective_total_timeout`** with `target_seconds`.
4. **`retrieve_merged_sources(question, settings, client, budget, sources_filter, domains)`**  
   - If `sources_filter` empty and `domains` non-empty → `effective_sources = _auto_sources_for_domains(domains)` (union of `DOMAIN_AUTO_SOURCES` + `INTEGRATIVE_CROSS_DOMAIN_CORE` when `len(domains) >= 2`).  
   - **Parallel tasks:**  
     - **Core (always):** Meilisearch, Qdrant, Perplexica, SearXNG general — each wrapped in circuit breakers.  
     - **Optional:** PubMed, ClinicalTrials.gov if `_should_run_optional(effective_sources, pill_id)`.  
     - **Site-scoped SearXNG:** one task **per** `(pill, fragment)` in `SOURCE_SITE_FRAGMENT` where pill is in `effective_sources`.  
   - **`asyncio.gather`**; exceptions in lists logged as `connector_exc`; **lists only** merged.  
   - **`merge_and_deduplicate(*parts)`** — dedupe key: `url` or `pmid` or `title` or `id(item)`.  
   - **Cap:** `merged[:total_cap]` (`total_cap` from depth budget).
5. **`synthesize_research_report(...)`**  
   - Build `context_text` from merged docs (title + snippet truncated `_RAG_SNIPPET_CHARS` = 800).  
   - Build numbered `sources_block` for citation index.  
   - **`build_deep_research_prompt`** → system + user prompts (domains, subdomains, intent, depth, output_format, citation_style, lang, JSON section template from `_sections_json_template` / `STRUCTURED_FORMAT_BY_INTENT`).  
   - If no Groq API key: return fallback section + `build_citations(merged, RESEARCH_MAX_CITATIONS)`.  
   - Else **Groq** `chat.completions.create`: `model = settings.RESEARCH_GROQ_MODEL`, `max_completion_tokens=4096`, `temperature=0.25`, `stream=False`.  
   - Parse with `parse_full_research_response` → sections + followups.  
   - On `CircuitBreakerError` or other errors: fallback sections (markdown list of sources or error section).  
   - **`build_citations(merged, RESEARCH_MAX_CITATIONS)`** — citations **mirror merged doc order** (first N docs), not necessarily only cited snippets.

### 3.3 Connectors (names → implementation)

| Connector label in `_normalize_doc` | Function | How invoked | Returns |
|-------------------------------------|----------|-------------|---------|
| `meilisearch` | `query_meilisearch` | POST `{RESEARCH_MEILISEARCH_URL}/indexes/medical_search/search` | Normalized docs |
| `qdrant` | `query_qdrant` | Embedding via `{RESEARCH_EMBED_URL}/api/embeddings`, then vector search on `RESEARCH_QDRANT_COLLECTION` | Normalized payloads |
| `perplexica` | `query_perplexica` | POST `{RESEARCH_PERPLEXICA_URL}/api/search` | `sources` array normalized |
| `searxng` | `fetch_searxng_general` | GET `SEARXNG_URL/search` category general | Results normalized |
| `pubmed` | `query_pubmed` | NCBI `esearch` + `esummary` | Articles with pmid URL |
| `clinicaltrials` | `query_clinical_trials` | GET `clinicaltrials.gov/api/v2/studies` | Trial cards |
| `searxng:{fragment}` | `fetch_searxng_scoped` | GET SearXNG with `query + site_fragment` | Scoped results |

**Note:** If `SEARXNG_URL` / Meilisearch / Qdrant / Perplexica URLs are unset or fail, that connector returns `[]` (graceful empty).

### 3.4 `DOMAIN_AUTO_SOURCES` / `INTEGRATIVE_CROSS_DOMAIN_CORE`

- **File:** `orchestrator.py` — dict `DOMAIN_AUTO_SOURCES` per domain id; list `INTEGRATIVE_CROSS_DOMAIN_CORE`.
- **`_auto_sources_for_domains`:** unions per-domain lists; if `len(domains) >= 2`, adds every id in `INTEGRATIVE_CROSS_DOMAIN_CORE`.
- **`SOURCE_SITE_FRAGMENT`:** maps pill id → SearXNG query fragment string.

**Frontend parity:** `universal-search-sources.ts` mirrors the same domain lists and integrative list for `getUniversalSources`.

### 3.5 Prompting & schema

- **Intent modifiers:** `INTENT_MODIFIERS` dict keys: `clinical`, `thesis`, `systematic-review`, `drug-herb-research`, `case-report`, `comparative` — unknown intent falls back to `clinical` modifier via `.get(..., INTENT_MODIFIERS["clinical"])` in practice for modifier string (see `build_deep_research_prompt`: uses `INTENT_MODIFIERS.get(intent_key, INTENT_MODIFIERS["clinical"])`).
- **Section JSON templates:** `_sections_json_template(intent, output_format)` — switches PRISMA/thesis/case structured templates.
- **LLM:** Groq SDK; default model from env **`RESEARCH_GROQ_MODEL`** (default `llama-3.3-70b-versatile` in `config.py`).

### 3.6 Streaming vs sync

| Aspect | Sync (`run_research`) | Stream (`stream_research_events`) |
|--------|------------------------|-----------------------------------|
| Retrieval / synthesis | Same functions | Same |
| Progress | N/A | Yields `log` before/after retrieval; logs if PubMed/ClinicalTrials included |
| Output delivery | Single JSON | Multiple SSE events; **no token streaming of LLM** — full synthesis completes then sections emitted |
| Timeout | `asyncio.wait_for` on whole `_pipeline` | Deadline checks `_check_deadline()` between steps; same overall timeout concept |
| `sources_searched` | `len(merged)` | `len(merged)` in `done.meta` |

### 3.7 Error handling

- Missing query: sync returns error section; stream yields `error` + `done` with zeros.
- Timeout: sync timeout dict with `timeout` section; stream yields `error` + `done`.
- Uncaught stream exception: `error` + `done`.
- Groq circuit open / failure: degraded sections + citations from merged only.
- **Rate limit / auth:** Router uses `get_protected_user`; `RESEARCH_ENABLE_CITATIONS` false → 503.

---

## 4. SHARED CONFIG & MODELS

### 4.1 Pydantic models (`services/shared/models.py`)

- **`DeepResearchSection`:** `id`, `title`, `content`.
- **`DeepResearchCitation`:** `id`, `authors`, `title`, `journal`, `year`, `doi`, `pmid`, `url`.
- **`DeepResearchResult`:** `query`, `domains_consulted`, `subdomains_consulted`, `intent`, `sections`, `citations`, `sources_searched`, `time_taken_seconds`, `generated_at`, `integrative_mode`, `followup_questions`, `citation_style`.

### 4.2 `universal-search-sources.ts`

- **`DOMAIN_UNIVERSAL_SOURCES`:** `Record<string, string[]>` keys = five domain ids.
- **`INTEGRATIVE_CROSS_DOMAIN_CORE`:** string array when ≥2 domains.
- **`getUniversalSources(domains)`:** consumed by **`useDeepResearch`** (sourceFilters) and **`deep-research-config.ts`** (`defaultSources` per domain).

**Backend consumption:** Not imported in Python — **manual sync** with `DOMAIN_AUTO_SOURCES` / `INTEGRATIVE_CROSS_DOMAIN_CORE` in `orchestrator.py`.

### 4.3 Domain & subdomain maps

- **Domains:** `RESEARCH_DOMAINS` in `deep-research-config.ts` — full subdomain catalog per tradition.
- **Fragments:** `SOURCE_SITE_FRAGMENT` only on backend; frontend does not duplicate fragment strings.

### 4.4 Enums / constants

- **`DepthLevel`:** `focused` \| `comprehensive` \| `exhaustive` — `_DEPTH_BUDGET` keys must match.
- **`OutputFormat` / `CitationStyle`:** TypeScript unions; backend uses lowercase strings.

---

## 5. WHAT IS MISSING OR PARTIALLY WIRED

| Item | Detail |
|------|--------|
| **`deep` request field** | Sent as `true` from frontend; **orchestrator does not branch on it**. |
| **`stream` request field** | **Ignored** — streaming determined by URL `/deep-research/stream`. |
| **`generateActivitySequence`** | Defined in `activity-log-simulator.ts` but **not used** during run; only `estimateResearchTime` is imported by page. |
| **`toggleSource` in hook** | Deprecated **no-op**; comment says Universal Search auto-manages sources. |
| **`SOURCE_FILTERS` in config** | Rich catalog for docs/UI; **runtime pills** come from `universal-search-sources.ts` / backend `DOMAIN_AUTO_SOURCES`. Possible **stale URLs** in `SOURCE_FILTERS` (e.g. old CCRS URL) vs `SOURCE_SITE_FRAGMENT`. |
| **Subdomain grouping** | Frontend stores per-domain map; API sends **flat** `subdomains[]` — backend cannot tell which subdomain belongs to which domain. |
| **`RESEARCH_MAX_SOURCES` (12)** in `ResearchSettings` | **Not referenced** in `retrieve_merged_sources` (cap is `total_cap` from depth). **Unclear if dead config.** |
| **Threads API** | Requires DB + auth in deployment; if `RESEARCH_DATABASE_URL` unset, threads may be disabled (see `main.py` lifespan logs). |
| **Intent `promptModifier` in `RESEARCH_INTENTS`** | **Not sent to API**; server uses **`INTENT_MODIFIERS`** in Python — **must stay in sync manually** with intent ids. |

---

## 6. CURRENT LIMITATIONS

| Area | Limitation |
|------|------------|
| **Connector explosion** | Every selected pill → separate SearXNG scoped task → **N concurrent HTTP calls**; slow or fragile if SearXNG rate-limits. |
| **Dedup** | `merge_and_deduplicate` key can fall back to `id(item)` — weak uniqueness if empty fields. |
| **Citations vs text** | `build_citations` uses **first N merged docs**, not necessarily only sources cited in prose — numbering may not match LLM’s actual `[n]` usage in edge cases. |
| **Core retrieval not domain-filtered** | Meilisearch/Qdrant/Perplexica/SearXNG general run **without** domain-specific query rewriting (domain influence is mainly **prompt** + **optional** + **scoped** searches). |
| **Single LLM call** | No token streaming; large prompts may hit context limits depending on merged size (snippets truncated per doc). |
| **Groq key** | Missing/invalid key → **no** LLM synthesis; user sees raw retrieval dump in fallback. |
| **Error surface** | Stream client ignores malformed JSON lines silently (`catch {}` in read loop). |
| **Originality mock** | Localhost failures return **mock** plagiarism data — can mask real integration issues. |
| **Hardcoded index** | Meilisearch index name `medical_search` in code. |

---

## SUMMARY MAP — Data flow: Run Research → Screen

1. **User** fills query, selects domains (and optional subdomains, intent, depth, slider, formats) in `page.tsx` bound to **`useDeepResearch`** state.
2. **`toggleDomain` / `selectAllDomains` / `clearDomainSelection`** update **`sourceFilters`** via **`getUniversalSources`** (`universal-search-sources.ts`).
3. **User** clicks run / Ctrl+Enter → **`runResearch`** (`useDeepResearch.ts`) validates query + non-empty domains.
4. **`deepResearchStream`** (`lib/api/research/client.ts`) POSTs **`DeepResearchRequest`** JSON to **`${RESEARCH_BASE}/deep-research/stream`** with **`fetchWithAuth`**.
5. **research-service** `routers/research.py` → **`stream_research_events`** (`orchestrator.py`).
6. **`retrieve_merged_sources`:** resolves `effective_sources`, runs parallel connectors + scoped SearXNG, **merge_and_deduplicate**, cap by **`total_cap`**.
7. **`synthesize_research_report`:** builds prompts, **Groq** completion, **parse_full_research_response**, **build_citations**.
8. **SSE** emits **log → section×N → citations → followup → done** to client.
9. **Client** `deepResearchStream` aggregates events; **`onEvent`** updates **`activityLog`** for `log` types only.
10. **Returned object** assembled as **`DeepResearchResult`** (note: `generated_at` is **client `new Date().toISOString()`**, not server `generated_at` from sync path).
11. **Hook** sets **`state.result`**, **`activeStep: 4`**; pushes **history** to **localStorage**.
12. **`ResearchWorkspace`** switches to **`WorkspaceResultState`**, which renders **sections**, **citations**, **follow-ups**, and optional **originality** / **save** actions.

---

*End of report.*
