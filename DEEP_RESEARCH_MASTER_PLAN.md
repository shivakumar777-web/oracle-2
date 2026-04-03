# Manthana Deep Research — Final Launch Plan v5

**Status:** Final — implementation-ready  
**Date:** 20 March 2026  
**Scope:** Deep Research section only — zero impact on Oracle, Web, Analysis  
**Goal:** Every UI control works end-to-end. Launch-ready.

---

## 1. What exists today (inventory)

### 1.1 Frontend — built and wired to UI

| Asset | File | Status |
|-------|------|--------|
| **Page** | `app/deep-research/page.tsx` | ✅ Full layout, settings drawer, originality |
| **State hook** | `hooks/useDeepResearch.ts` | ✅ Collects all fields, calls API, activity log timer |
| **API client** | `lib/api/research/client.ts` | ✅ `deepResearch()`, `checkOriginality()` with auth |
| **Types** | `lib/api/research/types.ts` | ✅ `DeepResearchRequest`, `DeepResearchResult`, `PlagiarismResult` |
| **Config** | `lib/deep-research-config.ts` (574 lines) | ✅ Domains, subdomains, intents with `promptModifier`, source filters, templates, depth, citation styles |
| **Domain selector** | `components/deep-research/DomainSelector.tsx` | ✅ 5 traditions |
| **Subdomain grid** | `components/deep-research/SubdomainGrid.tsx` | ✅ Per-tradition subdomains |
| **Intent selector** | `components/deep-research/IntentSelector.tsx` | ✅ 6 intent cards |
| **Depth controls** | `components/deep-research/DepthControls.tsx` | ✅ Depth tabs + time slider + source pills + output format + citation style |
| **Research bar** | `components/deep-research/ResearchBar.tsx` | ✅ Query input |
| **Context pill** | `components/deep-research/ResearchContextPill.tsx` | ✅ Displays selection summary |
| **Templates** | `components/deep-research/ResearchTemplates.tsx` | ✅ 6 quick-fill templates |
| **Workspace** | `ResearchWorkspace.tsx` → `WorkspaceEmptyState` / `WorkspaceThinkingState` / `WorkspaceResultState` | ✅ Three states |
| **Result view** | `WorkspaceResultState.tsx` | ✅ Sections, citations with `[n]` superscripts, domain icons, PDF/copy/originality |
| **Originality** | `OriginalityPanel.tsx` | ✅ Full plagiarism result UI |
| **Integrative badge** | `IntegrativeBadge.tsx` | ✅ Multi-tradition indicator |
| **Step indicator** | `StepIndicator.tsx` | ✅ 4-step wizard |
| **Activity log** | `lib/activity-log-simulator.ts` | ⚠️ Client-only simulation |
| **History** | `ResearchHistory.tsx` | 🔴 Returns `null` (placeholder) |

### 1.2 Backend — research-service (port 8002 / host 8201)

| Asset | Status | Gap |
|-------|--------|-----|
| `main.py` — FastAPI app, CORS, rate limit, Redis | ✅ | — |
| `config.py` — `ResearchSettings` with Qdrant, Perplexica, Redis, Groq, plagiarism | ✅ Built | Qdrant/Perplexica **not called** |
| `routers/research.py` — `POST /v1/deep-research` | ⚠️ | Only SearXNG; **ignores** intent, depth, sources, output_format, citation_style |
| `routers/plagiarism.py` — `POST /v1/plagiarism/check` | ✅ | Missing Qdrant layer |
| `routers/health.py` | ✅ | — |
| `research-db` (PostgreSQL) | ✅ In docker-compose | **Not used** in code |
| `REQUIRE_AUTH` | Config exists | Default `false` |

### 1.3 ai-router (port 8000) — pre-separation reference

| Capability | Code location | Port to research-service? |
|------------|---------------|--------------------------|
| `_query_meilisearch()` | `ai-router/main.py:429` | ✅ Yes |
| `_query_qdrant()` + Ollama embeddings | `ai-router/main.py:453` | ✅ Yes |
| `_query_perplexica()` | `ai-router/main.py:474` | ✅ Yes |
| `_merge_and_deduplicate()` | `ai-router/main.py:534` | ✅ Yes |
| `_build_deep_research_prompt()` with domains/subdomains/intent/depth | `ai-router/main.py:706` | ✅ Yes (enhance) |
| `_parse_deep_research_sections()` | `ai-router/main.py:726` | ✅ Yes |
| `_build_citations()` | `ai-router/main.py:820` | ✅ Yes |
| `get_protected_user` JWT auth | `ai-router/auth.py` | ✅ Yes |

### 1.4 Shared models (already in repo)

| Model | File | Notes |
|-------|------|-------|
| `DeepResearchRequest` | `services/shared/models.py:257` | Has `query`, `question`, `domains`, `subdomains`, `intent`, `depth`, `sources`, `output_format`, `citation_style`, `lang`, `deep`, `stream` |
| `DeepResearchResult` | `services/shared/models.py:278` | Has `sections`, `citations`, `sources_searched`, `time_taken_seconds`, `integrative_mode` |
| `DeepResearchSection` | `services/shared/models.py:236` | `id`, `title`, `content`, `icon` |
| `DeepResearchCitation` | `services/shared/models.py:244` | `id`, `authors`, `title`, `journal`, `year`, `doi`, `pmid`, `url` |

**Issue:** research-service defines its **own** `DeepResearchRequest` instead of importing shared models → **drift risk**.

### 1.5 `deep-research-config.ts` — what's defined but not used

| Config data | Frontend wired? | Sent to API? | Backend uses it? |
|-------------|-----------------|--------------|------------------|
| `RESEARCH_DOMAINS[].id` | ✅ DomainSelector | ✅ `domains[]` | ⚠️ In prompt (ai-router), echoed (research-service) |
| `RESEARCH_DOMAINS[].subdomains[].id` | ✅ SubdomainGrid | ✅ `subdomains[]` | ⚠️ In prompt (ai-router), echoed (research-service) |
| `RESEARCH_DOMAINS[].defaultSources` | ✅ Auto-fills `sourceFilters` | Indirectly | ❌ |
| **`RESEARCH_INTENTS[].promptModifier`** | **❌ Not read by any component** | **❌ Not sent** | **❌ Dead text** |
| `RESEARCH_INTENTS[].id` | ✅ IntentSelector | ✅ `intent` | ⚠️ In prompt (ai-router), ignored (research-service) |
| `SOURCE_FILTERS[].id` | ✅ DepthControls pills | ✅ `sources[]` | **❌ Backend ignores** |
| `SOURCE_FILTERS[].domains` | ✅ Filters visible pills | — | — |
| `DEPTH_CONFIG` levels | ✅ DepthControls tabs | ✅ `depth` | ⚠️ In prompt (ai-router), ignored (research-service) |
| `depthSeconds` (slider) | ✅ DepthControls | **❌ Not in API payload** | **❌** |
| `OutputFormat` (report/summary/bullets) | ✅ DepthControls | ✅ `output_format` | **❌ Backend ignores** |
| `CitationStyle` (vancouver/apa/etc.) | ✅ DepthControls | ✅ `citation_style` | **❌ Backend ignores** |
| `RESEARCH_TEMPLATES` | ✅ Pre-fills state | Indirectly | — |

---

## 2. The contract: every control → backend behavior

This is the spec. After implementation, **every row must say ✅ in the last column**.

| UI control | Field in API body | Backend must do | Status today |
|------------|-------------------|-----------------|--------------|
| **Domain cards** | `domains: ["allopathy", "ayurveda"]` | Include in LLM prompt; expand Perplexica query with tradition keywords; filter Qdrant by domain metadata if available | ⚠️ Partial |
| **Subdomain pills** | `subdomains: ["cardiology", "kayachikitsa"]` | Include in LLM prompt; narrow Meilisearch/Qdrant metadata filter | ⚠️ Partial |
| **Intent card** | `intent: "systematic-review"` | **Inject `promptModifier`** from lookup table into LLM system prompt; change section structure for thesis/case-report | ❌ |
| **Depth tabs** | `depth: "exhaustive"` | Set **source budget**: focused=5, comprehensive=10, exhaustive=15+; set Perplexica `optimizationMode`; set timeout | ❌ |
| **Time slider** | *(not sent today)* | **Add `target_seconds` to API**; use as timeout cap | ❌ |
| **Source pills** | `sources: ["pubmed", "cochrane", "ayush-formulary"]` | **Route**: only call connectors user selected; skip unselected | ❌ |
| **Output format** | `output_format: "summary"` | `structured` = 6 sections; `summary` = 1 section; `bullets` = bulleted list | ❌ |
| **Citation style** | `citation_style: "apa"` | Instruction in LLM prompt + post-format citations | ❌ |
| **Language** | `lang: "en"` | LLM prompt language instruction | ❌ |
| **Query** | `query: "..."` | Primary search term for all sources | ✅ |
| **Originality check** | Separate `POST /v1/plagiarism/check` | Web + vector + optional Qdrant layers | ⚠️ Partial |

---

## 3. Architecture (final)

```
┌──────────────────────────────────────────────────────────────────────────┐
│  FRONTEND  (Next.js)                                                      │
│                                                                            │
│  deep-research/page.tsx                                                   │
│       │  useDeepResearch()                                                │
│       │  collects: query, domains, subdomains, intent, depth,            │
│       │            sources, output_format, citation_style, lang           │
│       ▼                                                                    │
│  api/research/client.ts                                                   │
│       │  deepResearch(body) → POST {RESEARCH_BASE}/v1/deep-research       │
│       │  deepResearchStream(body) → POST .../v1/deep-research/stream      │
│       │  checkOriginality(text) → POST .../v1/plagiarism/check            │
└───────┼────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  RESEARCH-SERVICE  (FastAPI, port 8002, container: manthana-research)    │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  AUTH MIDDLEWARE  (JWT via Better Auth JWKS)                        │  │
│  │  Rate Limit: 60/min per IP                                         │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  POST /v1/deep-research                                            │  │
│  │                                                                    │  │
│  │  1. PARSE request → domains, intent, depth, sources[], etc.        │  │
│  │                                                                    │  │
│  │  2. ROUTE sources[] → enable/disable connectors:                   │  │
│  │     ┌─────────────────────────────────────────────────────────┐    │  │
│  │     │  CONNECTOR LAYER  (parallel asyncio.gather)             │    │  │
│  │     │                                                         │    │  │
│  │     │  [pubmed]        → PubMed E-utilities (if selected)     │    │  │
│  │     │  [clinicaltrials]→ ClinicalTrials.gov API (if selected) │    │  │
│  │     │  [cochrane, who] → SearXNG site-scoped query            │    │  │
│  │     │  [ayush, ccrum…] → SearXNG site-scoped OR static DB     │    │  │
│  │     │  [always]        → Meilisearch medical_search (lexical) │    │  │
│  │     │  [always]        → Qdrant medical_documents (semantic)  │    │  │
│  │     │  [always]        → Perplexica RAG (web intelligence)    │    │  │
│  │     │  [fallback]      → SearXNG general (if <3 results)      │    │  │
│  │     └─────────────────────────────────────────────────────────┘    │  │
│  │                                                                    │  │
│  │  3. MERGE + DEDUPLICATE + RANK (by domain relevance)               │  │
│  │                                                                    │  │
│  │  4. BUILD PROMPT:                                                  │  │
│  │     • System: role + intent.promptModifier + output_format rule    │  │
│  │     • User: question + domains + subdomains + depth                │  │
│  │     • Context: top-N source snippets                               │  │
│  │     • Citations: numbered source list                              │  │
│  │     • Style: citation_style formatting instruction                 │  │
│  │     • Language: lang                                               │  │
│  │                                                                    │  │
│  │  5. CALL Groq LLM → parse JSON sections                           │  │
│  │                                                                    │  │
│  │  6. POST-PROCESS:                                                  │  │
│  │     • Format citations per citation_style                          │  │
│  │     • Apply output_format (structured / summary / bullets)         │  │
│  │     • Add follow-up questions (optional, from LLM)                 │  │
│  │     • Attach source metadata + diversity indicators                │  │
│  │                                                                    │  │
│  │  7. RETURN DeepResearchResult                                      │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  POST /v1/deep-research/stream  (SSE)                              │  │
│  │  Same pipeline; yields events:                                     │  │
│  │    {"type":"log","text":"Searching PubMed..."}                      │  │
│  │    {"type":"log","text":"Found 12 results from Qdrant"}            │  │
│  │    {"type":"section","id":"summary","content":"..."}               │  │
│  │    {"type":"citations","data":[...]}                               │  │
│  │    {"type":"followup","questions":["...",".."]}                     │  │
│  │    {"type":"done","meta":{...}}                                     │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  ┌────────────────────────────────────────────────────────────────────┐  │
│  │  POST /v1/plagiarism/check                                         │  │
│  │  Layer 1: SearXNG web (existing)                                   │  │
│  │  Layer 2: Sentence-transformers self-similarity (existing)         │  │
│  │  Layer 3: Qdrant corpus similarity (restore)                       │  │
│  └────────────────────────────────────────────────────────────────────┘  │
│                                                                            │
│  DATA (isolated):                                                         │
│  • Redis  research:* keys                                                │
│  • PostgreSQL  research-db (Phase 2: sessions, history)                  │
│                                                                            │
│  READS (shared, read-only):                                              │
│  • Meilisearch medical_search index                                      │
│  • Qdrant medical_documents collection                                   │
│  • Perplexica /api/search                                                │
│  • SearXNG /search                                                       │
│  • Ollama embedding endpoint                                             │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Implementation (file-level spec)

### 4.1 New file: `services/research-service/orchestrator.py`

The heart of the upgrade. One module, no imports from oracle/web/analysis.

```python
# orchestrator.py — Deep Research Orchestrator

# CONNECTORS (ported from ai-router, scoped to research-service)
async def query_meilisearch(query, settings, client, rid) -> list
async def query_qdrant(query, settings, client, rid) -> list
async def query_perplexica(query, settings) -> list
async def query_searxng(query, searxng_url, site_scope=None) -> list
async def query_pubmed(query, max_results=5) -> list          # NEW
async def query_clinicaltrials(query, max_results=5) -> list   # NEW

# ROUTING
def select_connectors(sources: list[str], depth: str) -> list[Callable]:
    """Map source IDs from frontend to connector functions.
    Always includes: meilisearch, qdrant, perplexica.
    Conditionally includes: pubmed, clinicaltrials, site-scoped searxng.
    depth controls max_results per connector."""

# MERGE
def merge_and_deduplicate(*result_lists) -> list  # from ai-router

# PROMPT
INTENT_MODIFIERS = {
    "clinical": "Focus on clinical evidence...",
    "thesis": "Structure as thesis-ready literature review...",
    "systematic-review": "Follow PRISMA guidelines...",
    "drug-herb-research": "Include pharmacology...",
    "case-report": "Follow CARE guidelines...",
    "comparative": "Analyse through all selected traditions..."
}
# ^ Copy from deep-research-config.ts promptModifier values

OUTPUT_FORMAT_INSTRUCTIONS = {
    "structured": "Return 6 sections: summary, findings, clinical, traditional, integrative, gaps.",
    "summary": "Return a single section: a concise research summary in 3-5 paragraphs.",
    "bullets": "Return a single section: key findings as a bulleted list with citations."
}

CITATION_STYLE_INSTRUCTIONS = {
    "vancouver": "Format citations as: Author(s). Title. Journal. Year;Vol(Issue):Pages.",
    "apa": "Format citations as: Author, A. A. (Year). Title. Journal, Vol(Issue), Pages.",
    "harvard": "Format citations as: Author (Year) Title. Journal, Vol(Issue), pp.Pages.",
    "mla": "Format citations as: Author. \"Title.\" Journal Vol.Issue (Year): Pages.",
    "icmr": "Format citations per ICMR guidelines."
}

def build_prompt(query, domains, subdomains, intent, depth,
                 context_text, sources_block,
                 output_format, citation_style, lang) -> str:
    """Build the full LLM prompt using ALL user selections."""

# PARSE
def parse_sections(raw_answer: str) -> list  # from ai-router
def build_citations(docs, limit, style) -> list  # from ai-router + style formatting

# ORCHESTRATE (main entry point)
async def run_research(body: DeepResearchRequest, settings, rid) -> dict:
    """
    1. select_connectors(body.sources, body.depth)
    2. asyncio.gather(*connectors)
    3. merge_and_deduplicate
    4. build_prompt (with intent modifier, output format, citation style)
    5. call Groq
    6. parse + format
    7. return DeepResearchResult dict
    """
```

### 4.2 Changes to `services/research-service/routers/research.py`

```python
# REPLACE the current handler body with:

from orchestrator import run_research
from services.shared.models import DeepResearchRequest  # use shared model

@router.post("/deep-research")
@limiter.limit("60/minute")
async def deep_research(request, body: DeepResearchRequest, settings, user):
    rid = request.state.request_id
    result = await run_research(body, settings, rid)
    return JSONResponse(content={"status":"success","service":"research","data":result,"request_id":rid})
```

### 4.3 Changes to `services/research-service/config.py`

Add missing env vars (some configs exist but aren't read by router):

```python
# Ensure these are active (most already defined):
RESEARCH_MEILISEARCH_URL: str = "http://meilisearch:7700"
RESEARCH_MEILISEARCH_KEY: str = ""
RESEARCH_QDRANT_URL: str = "http://qdrant:6333"
RESEARCH_QDRANT_COLLECTION: str = "medical_documents"
RESEARCH_EMBED_URL: str = "http://ollama:11434"   # NEW
RESEARCH_PERPLEXICA_URL: str = "http://perplexica:3000"  # make non-optional
RESEARCH_NCBI_API_KEY: str = ""  # NEW — optional for PubMed
REQUIRE_AUTH: bool = True  # CHANGE default to True
```

### 4.4 Frontend changes

| File | Change |
|------|--------|
| `useDeepResearch.ts` | Add `target_seconds: state.depthSeconds` to API body; add `deepResearchStream()` path when `stream: true` |
| `api/research/client.ts` | Add `deepResearchStream()` using `EventSource` / `fetch` + `ReadableStream` |
| `api/research/types.ts` | Add `target_seconds?: number` to `DeepResearchRequest`; add `followup_questions?: string[]` to `DeepResearchResult` |
| `WorkspaceThinkingState.tsx` | When streaming: subscribe to SSE log events; when not: keep current timer |
| `ResearchHistory.tsx` | Replace `return null` with `localStorage`-based history (reads `manthana_sessions` with `mode === "deep-research"`) |

### 4.5 Docker-compose additions

```yaml
research-service:
  environment:
    # ADD these (some may exist):
    - RESEARCH_MEILISEARCH_URL=http://meilisearch:7700
    - RESEARCH_MEILISEARCH_KEY=${MEILI_MASTER_KEY}
    - RESEARCH_QDRANT_URL=http://qdrant:6333
    - RESEARCH_EMBED_URL=http://ollama:11434
    - RESEARCH_PERPLEXICA_URL=http://perplexica:3000
    - REQUIRE_AUTH=true
  depends_on:
    # ADD (read-only shared infra):
    meilisearch:
      condition: service_healthy
    qdrant:
      condition: service_healthy
    ollama:
      condition: service_healthy
```

---

## 5. Source connector spec

### 5.1 Always-on connectors

| Connector | Source | Implementation |
|-----------|--------|----------------|
| **Meilisearch** | Local medical corpus | Port `_query_meilisearch()` from ai-router; read-only on `medical_search` |
| **Qdrant** | Semantic vectors | Port `_query_qdrant()` + `_generate_embedding()` via Ollama |
| **Perplexica** | AI web RAG | Port `_query_perplexica()`; set `focusMode` based on depth |
| **SearXNG** | General web fallback | Existing `_fetch_search_context()`; also used for site-scoped queries |

### 5.2 User-selected connectors (only if in `sources[]`)

| Source pill ID | Connector |
|----------------|-----------|
| `pubmed` | NCBI ESearch → ESummary API. Free; 3 req/s without key, 10/s with. Returns PMID, title, authors, journal, year, DOI. |
| `clinicaltrials` | ClinicalTrials.gov API v2. `GET /studies?query.term={q}&pageSize=5`. Returns NCT ID, title, status, conditions. |
| `cochrane` | SearXNG with `site:cochranelibrary.com` |
| `who` | SearXNG with `site:who.int` |
| `ayush-formulary` | SearXNG with `site:ccras.nic.in OR site:ayush.gov.in` |
| `ccrum` | SearXNG with `site:ccrum.res.in` |
| `ccrs` | SearXNG with `site:siddhacouncil.org` |
| `homeopathy-research` | SearXNG with `site:hri-research.org` |
| `embase` | SearXNG with `site:embase.com` |
| `radiopaedia` | SearXNG with `site:radiopaedia.org` |
| `uptodate` | SearXNG with `site:uptodate.com` |
| `doaj` | SearXNG with `site:doaj.org` |
| `indian-journals` | SearXNG with `site:ijam.co.in OR site:ayujournal.org` |
| `ncbi-books` | SearXNG with `site:ncbi.nlm.nih.gov/books` |

### 5.3 Depth → budget mapping

| Depth | Max sources per connector | Perplexica mode | Total target | Timeout |
|-------|--------------------------|-----------------|--------------|---------|
| `focused` | 3 | `speed` | ~5–8 results | 15s |
| `comprehensive` | 5 | `balanced` | ~10–15 results | 35s |
| `exhaustive` | 8 | `quality` | ~15–25 results | 75s |

---

## 6. LLM prompt construction (full spec)

```
SYSTEM:
  You are Manthana Deep Research — a medical AI that synthesizes
  evidence across {domains} medical traditions.

  {INTENT_MODIFIERS[intent]}

  {OUTPUT_FORMAT_INSTRUCTIONS[output_format]}

  {CITATION_STYLE_INSTRUCTIONS[citation_style]}

  Language: {lang}

USER:
  Research question: {query}

  Selected domains: {domains}
  Subdomains: {subdomains}
  Research depth: {depth}

  === Retrieved evidence ({N} sources) ===
  {context_text}

  === Source index (cite as [1], [2], etc.) ===
  {sources_block}

  Produce valid JSON only. No commentary outside the JSON.
```

**Section structure varies by `output_format`:**
- `structured` → 6 sections (summary, findings, clinical, traditional, integrative, gaps)
- `summary` → 1 section (summary)
- `bullets` → 1 section (bulleted list)

**Section structure varies by `intent`:**
- `thesis` → sections become: abstract, introduction, literature review, discussion, conclusion
- `case-report` → sections become: introduction, patient info, findings, assessment, intervention, follow-up, discussion
- `systematic-review` → sections become: background, methods (PRISMA), results, quality assessment, synthesis, gaps

---

## 7. Streaming spec (SSE)

**Endpoint:** `POST /v1/deep-research/stream`  
**Content-Type:** `text/event-stream`

```
data: {"type":"log","text":"Searching Meilisearch medical index..."}
data: {"type":"log","text":"Retrieved 5 results from medical_search"}
data: {"type":"log","text":"Searching Qdrant semantic vectors..."}
data: {"type":"log","text":"Retrieved 4 results from Qdrant"}
data: {"type":"log","text":"Querying Perplexica RAG..."}
data: {"type":"log","text":"Retrieved 6 web sources via Perplexica"}
data: {"type":"log","text":"Searching PubMed for 'diabetes type 2 treatment'..."}
data: {"type":"log","text":"Found 5 PubMed articles"}
data: {"type":"log","text":"Merging 20 sources, deduplicating..."}
data: {"type":"log","text":"15 unique sources after dedup"}
data: {"type":"log","text":"Synthesizing with Groq LLM..."}
data: {"type":"section","id":"summary","title":"Research Summary","content":"..."}
data: {"type":"section","id":"findings","title":"Key Findings","content":"..."}
...
data: {"type":"citations","data":[{"id":1,"authors":"...","title":"..."},...]}
data: {"type":"followup","questions":["What are the side effects of...","How does Ayurvedic..."]}
data: {"type":"done","meta":{"sources_searched":15,"time_taken_seconds":22,"integrative_mode":true}}
```

**Frontend consumption:** Replace `activity-log-simulator.ts` timers with real SSE events in `WorkspaceThinkingState`.

---

## 8. Phases

### Phase 1: Backend parity + every control works (Week 1–2)

**Implementation status (repo):** Delivered in `services/research-service/orchestrator.py` — parallel Meilisearch + Qdrant + Perplexica + SearXNG + optional PubMed, ClinicalTrials.gov, and site-scoped SearXNG; depth budgets; intent / output_format / citation_style / lang in LLM prompts; shared `DeepResearchRequest`; JWT optional via `REQUIRE_AUTH`; Qdrant corpus layer in plagiarism; `docker-compose` env wiring for RAG URLs (soft deps — no compose hard-dependency on Perplexica profile).

| Task | Description |
|------|-------------|
| 1.1 | Create `orchestrator.py` with ported RAG helpers |
| 1.2 | Implement `select_connectors()` source routing |
| 1.3 | Implement depth → budget mapping |
| 1.4 | Inject `promptModifier` by intent lookup |
| 1.5 | Inject `output_format` instruction |
| 1.6 | Inject `citation_style` instruction |
| 1.7 | Enable auth (`REQUIRE_AUTH=true`) |
| 1.8 | Import shared `DeepResearchRequest` model |
| 1.9 | Wire Meilisearch, Qdrant, Perplexica, SearXNG in docker-compose |
| 1.10 | Add Qdrant layer to plagiarism |

**Exit:** Every UI control produces measurably different output.

### Phase 2: Streaming + medical APIs + history (Week 3–4)

| Task | Description |
|------|-------------|
| 2.1 | `POST /v1/deep-research/stream` SSE endpoint |
| 2.2 | Frontend: `deepResearchStream()` + real activity log |
| 2.3 | PubMed connector (NCBI E-utilities) |
| 2.4 | ClinicalTrials.gov connector |
| 2.5 | Follow-up questions (LLM generates 3 from context) |
| 2.6 | `ResearchHistory.tsx` — localStorage implementation |
| 2.7 | Add `target_seconds` to API body |

**Exit:** Streaming works; PubMed/trials appear in results when selected.

### Phase 3: Polish + persistence (Week 5–6)

| Task | Description |
|------|-------------|
| 3.1 | research-db schema migration + session persistence |
| 3.2 | `/v1/research/thread` CRUD endpoints |
| 3.3 | Intent-specific section structures (thesis, case-report, PRISMA) |
| 3.4 | Citation export (copy as Vancouver/APA/etc.) |
| 3.5 | Evidence confidence badges on sources |
| 3.6 | Mobile responsive polish |

**Status: ✅ PHASE 3 COMPLETE.** 3.1–3.2 implemented (Postgres + `/v1/research/threads` CRUD). **3.3** — `STRUCTURED_FORMAT_BY_INTENT` + `_structured_output_instruction()`: **thesis** (Abstract→Conclusion), **systematic-review** (PRISMA-style), **case-report** (CARE-style). **3.4** — `citation_style` on stream `done` + `Refs` button. **3.5** — heuristic source badges. **3.6** — mobile polish. **Save** (`☁`) + **`SavedThreadsPanel`** with list/open/delete. Contract tests: `tests/test_research_prompts.py`.

---

## 8.1 Production Readiness Features (NEW)

| Feature | Implementation | Status |
|---------|----------------|--------|
| **Circuit Breakers** | Per-connector resilience: `research_meilisearch_circuit`, `research_qdrant_circuit`, `research_perplexica_circuit`, `research_searxng_circuit`, `research_pubmed_circuit`, `research_clinicaltrials_circuit`, `research_groq_circuit`. Graceful degradation when services fail. | ✅ |
| **Groq Fallback** | When circuit opens: returns formatted sources without synthesis. No user-facing errors. | ✅ |
| **DB Migrations** | Alembic configured: `alembic.ini`, `alembic/env.py`, migration `0001_initial_research_threads.py`. Production-safe schema evolution. | ✅ |
| **CI/CD Contract Tests** | `.github/workflows/research-contract-tests.yml`: isolation verification, circuit breaker tests, frontend type checks. | ✅ |
| **ESLint Isolation** | `no-restricted-imports` rule enforces no cross-section imports (research can't import oracle/web/analysis). | ✅ |
| **Universal Search** | Auto-source selection by domain: user selects tradition → system intelligently searches all relevant databases. Removed manual source pills. | ✅ |

---

## 9. Isolation guarantees

| Rule | Enforcement |
|------|-------------|
| No HTTP calls to oracle/web/analysis services | ✅ CI: `grep -r "from services.oracle"` fails build |
| Meilisearch + Qdrant: **read-only** | No write operations in orchestrator |
| Redis: **`research:*` prefix only** | Key builder utility |
| PostgreSQL: **`research-db` only** | Connection string in env |
| Groq: **`RESEARCH_GROQ_API_KEY`** | Separate config field |
| Frontend: **no cross-section imports** | ✅ ESLint `no-restricted-imports` fails build |
| **Production verification** | ✅ `scripts/verify-production-ready.sh` |

---

## 10. Testing

| Test | Validates |
|------|-----------|
| **Contract:** Change `intent` → output sections change | Intent wiring |
| **Contract:** Change `sources: ["pubmed"]` → PubMed URLs in citations | Source routing |
| **Contract:** Change `depth: "focused"` vs `"exhaustive"` → different source count | Budget mapping |
| **Contract:** Change `output_format: "bullets"` → single bulleted section | Format wiring |
| **Contract:** Change `citation_style: "apa"` → APA-formatted citations | Style wiring |
| **Isolation:** Stop oracle-service → deep-research still 200 | No cross-dependency |
| **Auth:** No token → 401 | Security |
| **Load:** 60 RPS, p95 < 45s | Performance |

---

## 11. Config reference

```bash
# Frontend
NEXT_PUBLIC_RESEARCH_API_URL=http://localhost:8201

# Backend
RESEARCH_GROQ_API_KEY=gsk_...
RESEARCH_GROQ_MODEL=llama-3.3-70b-versatile
RESEARCH_MEILISEARCH_URL=http://meilisearch:7700
RESEARCH_MEILISEARCH_KEY=${MEILI_MASTER_KEY}
RESEARCH_QDRANT_URL=http://qdrant:6333
RESEARCH_QDRANT_COLLECTION=medical_documents
RESEARCH_EMBED_URL=http://ollama:11434
RESEARCH_PERPLEXICA_URL=http://perplexica:3000
SEARXNG_URL=http://searxng:8080
RESEARCH_NCBI_API_KEY=             # optional
RESEARCH_REDIS_URL=redis://redis:6379
RESEARCH_REDIS_PREFIX=research
RESEARCH_DATABASE_URL=postgresql://research:***@research-db:5432/research_service
REQUIRE_AUTH=true
BETTER_AUTH_URL=${BETTER_AUTH_URL}
FRONTEND_URL=${FRONTEND_URL}
RESEARCH_ENABLE_STREAMING=true
RESEARCH_ENABLE_PUBMED=true
RESEARCH_ENABLE_CLINICALTRIALS=true
RESEARCH_MAX_SOURCES=15
RESEARCH_MAX_CITATIONS=25
```

---

## 12. Rollback

| Scenario | Action |
|----------|--------|
| Research-service broken | Set `NEXT_PUBLIC_RESEARCH_API_URL` to ai-router (8000); ai-router `/v1/deep-research` still works |
| Single connector failing | Circuit breaker per connector; result set smaller but not empty |
| Groq down | Return raw sources without synthesis (graceful degradation) |

---

## 13. Success = launch-ready when

1. User selects **Ayurveda + Allopathy** → output compares both traditions
2. User selects **Thesis intent** → output has literature review structure
3. User selects **only PubMed + Cochrane** → citations come from those sources
4. User selects **Exhaustive depth** → more sources, longer, richer output
5. User selects **APA citation style** → citations formatted as APA
6. User selects **Bullets output** → single bulleted section, not 6 sections
7. **Streaming** shows real search steps, not fake timers
8. **Originality check** runs 3 layers and returns score
9. **No other section breaks** when research-service is updated or restarted

---

*This is the final plan. Every toggle, every pill, every card in the UI will drive real backend behavior. The research-service stays isolated. The launch is ready when section 13 passes.*
