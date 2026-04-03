# Oracle Service — Post-Separation Fix Plan

**Date:** March 19, 2026  
**Severity:** HIGH — Core Oracle chat is running at ~20% of designed capability  
**Scope:** `services/oracle-service/` only — NO changes to ai-router, web-service, or frontend

---

## Executive Summary

When the monolithic ai-router was separated into microservices, the Oracle service
(`services/oracle-service/`) was created as a **stripped-down skeleton** that lost
almost every feature described in `ORACLE_CHAT_ARCHITECTURE_REPORT.md` and
implemented in `services/ai-router/main.py`.

The ai-router's `/v1/chat` endpoint is a **~250-line** multi-source, re-ranked,
citation-aware streaming pipeline. The Oracle service's `/v1/chat` endpoint is a
**~60-line** SearXNG-only, no-intelligence, no-citation stub.

**The frontend already points at port 8100 (Oracle service).** This means users
are currently getting the degraded version.

---

## Part 1: Feature-by-Feature Gap Analysis

### Legend
- ✅ = Present and working
- ⚠️ = Partially present / recently patched
- ❌ = Completely missing

### 1.1 Chat Endpoint (`POST /v1/chat`)

| # | Feature | ai-router (pre-sep) | oracle-service (post-sep) | Gap |
|---|---------|---------------------|--------------------------|-----|
| 1 | **Query Classification** | ✅ `classify_query()` → emergency/drug/trial/general | ❌ None | Critical |
| 2 | **Source Routing** | ✅ `route_sources()` → conditional Meili/Qdrant/SearXNG/PubMed/Trials | ❌ Always SearXNG only | Critical |
| 3 | **MeiliSearch RAG** | ✅ `_rag_search()` → keyword retrieval from indexed docs | ❌ Not connected | Critical |
| 4 | **Qdrant Vector Search** | ✅ `_rag_search()` → semantic similarity | ❌ Not connected | Critical |
| 5 | **PubMed Integration** | ✅ `search_pubmed()` → peer-reviewed papers | ❌ Missing | High |
| 6 | **ClinicalTrials.gov** | ✅ `fetch_clinical_trials_gov()` → active trials | ❌ Missing | High |
| 7 | **Domain Detection** | ✅ `detect_domain_in_query()` → auto-detect Ayurveda terms | ❌ Missing | Medium |
| 8 | **Integrative Query Detection** | ✅ `is_integrative_query()` → "Ayurveda vs Allopathy" | ❌ Missing | Medium |
| 9 | **Query Expansion** | ✅ `expand_query_for_domain()` + `expand_query()` | ⚠️ `expand_query_for_domain` only (just added) | Low |
| 10 | **Domain-Specific Search** | ✅ `CATEGORY_MAP[domain]` → SearXNG category | ⚠️ Just fixed | Fixed |
| 11 | **Domain System Prompts** | ✅ `get_domain_system_prompt()` → 100+ line prompts | ⚠️ Just fixed | Fixed |
| 12 | **Domain Trust Boost** | ✅ `get_domain_trust_boost()` → ayush.gov.in +10 | ⚠️ Just fixed | Fixed |
| 13 | **Domain Source Priority** | ✅ `should_prioritize_domain_sources()` → reorder | ❌ Missing | Medium |
| 14 | **Re-ranking** | ✅ `rerank_by_relevance()` → heuristic sort | ❌ Missing | High |
| 15 | **Deduplication** | ✅ `deduplicate_results()` → remove duplicate URLs | ❌ Missing | Medium |
| 16 | **Result Enrichment** | ✅ `enrich_result()` → add trust scores, peer-review flags | ❌ Missing | Medium |
| 17 | **Emergency Detection** | ✅ `is_emergency` → fast-track, disclaimers | ❌ Missing | High |
| 18 | **Emergency Fast-Track** | ✅ Skip external APIs, RAG only | ❌ Missing | High |
| 19 | **Adaptive System Prompts** | ✅ `_build_chat_system_prompt()` → intensity/persona/evidence/domain/context/citation | ❌ Only domain prompt | Critical |
| 20 | **Intensity Modes** | ✅ quick/clinical/deep → different prompt styles | ❌ Ignored | High |
| 21 | **Persona Modes** | ✅ patient/clinician/researcher/student | ❌ Ignored | High |
| 22 | **Evidence Modes** | ✅ gold/all/guidelines/trials | ❌ Ignored | High |
| 23 | **Inline Citation [S1]** | ✅ Sources block + citation instruction in prompt | ❌ Sources emitted but no citation instruction | High |
| 24 | **Context Assembly** | ✅ Re-ranked multi-source context with `[Meili]`, `[Qdrant]`, `[Web]`, `[PubMed]` labels | ❌ Raw SearXNG URLs only, title:url format | Critical |
| 25 | **Progress Events** | ✅ `{type: "progress", stage, status}` during search | ❌ No progress events | Medium |
| 26 | **Redis Caching** | ✅ SearXNG results cached via `_make_cache_key()` | ❌ No cache for search | Low |
| 27 | **Structured Logging** | ✅ `json_log()` with request_id, events | ❌ Basic `logger.info()` only | Low |
| 28 | **Auth (JWT)** | ✅ `get_protected_user` → optional JWT | ❌ No auth check | Low (REQUIRE_AUTH=false) |

### 1.2 M5 Endpoint (`POST /v1/chat/m5`)

| # | Feature | ai-router M5 | oracle-service M5 | Gap |
|---|---------|-------------|-------------------|-----|
| 1 | **Domain Query Expansion** | ✅ `expand_query_for_domain()` per domain | ❌ Raw message to all domains | High |
| 2 | **Per-Domain Sources** | ✅ MeiliSearch + Qdrant + PubMed (Allopathy) | ❌ `sources=[]` (empty) | Critical |
| 3 | **Domain Trust Boost** | ✅ `get_domain_trust_boost()` per source | ❌ None | Medium |
| 4 | **M5 Appendix Prompt** | ✅ "You are answering in M5 mode" | ❌ Generic "Format as CONTENT/CONCEPTS/TREATMENT" | High |
| 5 | **Async LLM** | ✅ `AsyncGroq` → true async | ❌ `run_in_executor(sync Groq)` → blocking | Medium |
| 6 | **Integrative Summary** | ✅ `build_m5_response_from_parts()` from m5_engine | ❌ Separate LLM call for summary | Low |
| 7 | **Stream Format** | ✅ Uses `stream_m5_response()` from m5_engine | ❌ Manual JSON serialization | Low |

---

## Part 2: Root Cause

The Oracle service was created by writing **new, minimal code** instead of
**extracting the existing code** from ai-router. The separation copied the
surface-level structure (FastAPI app, routes, streaming) but none of the
intelligence layer.

```
ai-router/main.py (2500+ lines)
├── imports: 12 internal modules (query_intelligence, source_router, reranker, ...)
├── _build_chat_system_prompt(): 150 lines — intensity/persona/evidence/domain/citation
├── chat(): 230 lines — classify → route → parallel fetch → re-rank → assemble → stream
├── chat_m5(): 100 lines — per-domain expand → RAG → trust boost → m5_engine
├── _rag_search(): Meili + Qdrant parallel
├── _groq_stream(): with emergency, circuit breaker, progress events
└── Uses: 11 Python modules (all in services/ai-router/)

oracle-service/routers/chat.py (300 lines)
├── imports: 2 internal modules (circuit_breaker, envelopes) + partial domain_intelligence
├── system_prompt: 1 line from domain_intelligence
├── chat(): 60 lines — SearXNG only → build messages → stream
├── _fetch_searxng(): Simple httpx GET
├── _groq_stream(): Basic circuit breaker, no progress events
└── Uses: 0 of the 11 ai-router modules
```

---

## Part 3: What MUST Be Copied vs What Can Stay Separate

### 3.1 Files to Copy INTO Oracle Service Container

These are the ai-router modules that Oracle needs. They are **pure logic, no I/O
dependencies** (except httpx for PubMed/Trials which Oracle already has).

| File | Purpose | Lines | Dependencies |
|------|---------|-------|--------------|
| `query_intelligence.py` | Query classification (emergency/drug/trial/general) | ~190 | None (pure Python) |
| `source_router.py` | Determine which sources to query | ~66 | query_intelligence |
| `reranker.py` | Heuristic re-ranking by relevance | ~62 | None (pure Python) |
| `pubmed_client.py` | PubMed E-utilities search | ~117 | httpx |
| `clinical_trials.py` | ClinicalTrials.gov API v2 | ~202 | httpx, redis (optional) |
| `domain_intelligence.py` | Domain prompts, expansion, trust boost, detection | ~783 | None (pure Python) |
| `m5_engine.py` | M5 response builder, stream formatter | ~364 | domain_intelligence |

**Total: 7 files, ~1,784 lines** — all self-contained, no coupling to ai-router app.

### 3.2 Oracle-Specific Config Additions

```python
# config.py additions needed:
ORACLE_MEILISEARCH_URL: str = "http://meilisearch:7700"
ORACLE_MEILISEARCH_KEY: str = ""
ORACLE_QDRANT_URL: str = "http://qdrant:6333"       # Already exists but unused
ORACLE_QDRANT_COLLECTION: str = "medical_documents"  # Already exists but unused
ORACLE_PUBMED_ENABLED: bool = True
ORACLE_TRIALS_ENABLED: bool = True
```

### 3.3 Dockerfile Changes

```dockerfile
# Current:
COPY services/shared/ /app/services/shared/
COPY services/ai-router/domain_intelligence.py /app/services/ai-router/

# Needed:
COPY services/shared/ /app/services/shared/
COPY services/ai-router/domain_intelligence.py /app/lib/
COPY services/ai-router/query_intelligence.py  /app/lib/
COPY services/ai-router/source_router.py       /app/lib/
COPY services/ai-router/reranker.py            /app/lib/
COPY services/ai-router/pubmed_client.py       /app/lib/
COPY services/ai-router/clinical_trials.py     /app/lib/
COPY services/ai-router/m5_engine.py           /app/lib/
```

### 3.4 docker-compose.yml Dependency Additions

```yaml
oracle-service:
  depends_on:
    redis:
      condition: service_healthy
    ollama:
      condition: service_healthy
    oracle-db:
      condition: service_healthy
    meilisearch:              # ADD
      condition: service_healthy
    qdrant:                   # ADD
      condition: service_healthy
  environment:
    - ORACLE_MEILISEARCH_URL=http://meilisearch:7700   # ADD
    - ORACLE_MEILISEARCH_KEY=${MEILI_MASTER_KEY}        # ADD
    - ORACLE_QDRANT_URL=http://qdrant:6333              # ADD (already exists)
```

---

## Part 4: Implementation Plan (Ordered by Priority)

### Phase A: Core Intelligence (Critical — answers quality)

**Goal:** Restore query classification, source routing, and multi-source retrieval.

| Step | Task | File(s) | Est. |
|------|------|---------|------|
| A1 | Copy 7 ai-router modules to `/app/lib/` in Dockerfile | `Dockerfile` | 10m |
| A2 | Add `sys.path` for `/app/lib` in Oracle | `routers/chat.py` | 5m |
| A3 | Import `classify_query`, `route_sources`, `rerank_by_relevance` | `routers/chat.py` | 5m |
| A4 | Add `_rag_search()` (MeiliSearch + Qdrant parallel) to chat.py | `routers/chat.py` | 30m |
| A5 | Add PubMed + ClinicalTrials parallel fetching | `routers/chat.py` | 20m |
| A6 | Add result normalization + re-ranking pipeline | `routers/chat.py` | 20m |
| A7 | Update config with Meili/Qdrant URLs | `config.py`, `docker-compose.yml` | 10m |

### Phase B: Prompt Engineering (Critical — answer style)

**Goal:** Restore the adaptive prompt system (intensity/persona/evidence/citation).

| Step | Task | File(s) | Est. |
|------|------|---------|------|
| B1 | Port `_build_chat_system_prompt()` from ai-router | `routers/chat.py` | 30m |
| B2 | Wire intensity/persona/evidence from ChatRequest body | `routers/chat.py` | 10m |
| B3 | Add citation instruction + sources block to system prompt | `routers/chat.py` | 15m |
| B4 | Add emergency detection + fast-track + disclaimer | `routers/chat.py` | 15m |

### Phase C: M5 Restoration (High — five-domain mode)

**Goal:** Restore per-domain sources, query expansion, and M5 engine.

| Step | Task | File(s) | Est. |
|------|------|---------|------|
| C1 | Import `m5_engine` functions | `routers/m5.py` | 5m |
| C2 | Add per-domain query expansion | `routers/m5.py` | 15m |
| C3 | Add per-domain RAG sources (Meili + Qdrant) | `routers/m5.py` | 20m |
| C4 | Add domain trust boost to M5 sources | `routers/m5.py` | 10m |
| C5 | Use `AsyncGroq` instead of `run_in_executor(sync)` | `routers/m5.py` | 15m |
| C6 | Use `stream_m5_response()` from m5_engine | `routers/m5.py` | 10m |

### Phase D: Polish (Medium — quality + observability)

| Step | Task | File(s) | Est. |
|------|------|---------|------|
| D1 | Add progress SSE events during source gathering | `routers/chat.py` | 15m |
| D2 | Add Redis caching for SearXNG results | `routers/chat.py` | 15m |
| D3 | Add deduplication + enrichment for web results | `routers/chat.py` | 10m |
| D4 | Add domain detection in query (auto-override) | `routers/chat.py` | 10m |
| D5 | Add integrative query detection | `routers/chat.py` | 10m |
| D6 | Structured JSON logging | throughout | 15m |

---

## Part 5: Safety Constraints

### DO NOT modify these files:
- `services/ai-router/main.py` — Legacy monolith, still serving other sections
- `services/web-service/` — Separate search section
- `services/research-service/` — Separate deep-research section
- `services/analysis-service/` — Separate imaging/analysis section
- `frontend-manthana/` — Frontend stays as-is (already points to Oracle port 8100)
- `services/shared/` — Only additive changes allowed

### Module ownership after fix:
```
services/ai-router/              ← Source of truth for shared modules
  ├── domain_intelligence.py     ← READ-ONLY for Oracle (copy at build time)
  ├── query_intelligence.py      ← READ-ONLY for Oracle (copy at build time)
  ├── source_router.py           ← READ-ONLY for Oracle (copy at build time)
  ├── reranker.py                ← READ-ONLY for Oracle (copy at build time)
  ├── pubmed_client.py           ← READ-ONLY for Oracle (copy at build time)
  ├── clinical_trials.py         ← READ-ONLY for Oracle (copy at build time)
  └── m5_engine.py               ← READ-ONLY for Oracle (copy at build time)

services/oracle-service/         ← Oracle-owned, fully independent
  ├── config.py                  ← Oracle-specific settings
  ├── main.py                    ← Oracle FastAPI app
  ├── routers/
  │   ├── chat.py                ← REWRITE with full pipeline
  │   ├── m5.py                  ← REWRITE with m5_engine
  │   └── health.py              ← Keep as-is
  └── Dockerfile                 ← Updated COPY commands
```

### Future extraction:
When ai-router is fully deprecated, move the 7 shared modules to
`services/shared/intelligence/` so all services can import without file copying.

---

## Part 6: Verification Checklist

After implementation, verify each feature independently:

```bash
# 1. Query Classification
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"chest pain emergency","domain":"allopathy"}' | head -5
# Expect: emergency disclaimer first, RAG-only (no SearXNG delay)

# 2. MeiliSearch + Qdrant
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"metformin mechanism of action","domain":"allopathy"}' | head -10
# Expect: sources with _source: "Meili" and "Qdrant"

# 3. PubMed
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"latest alzheimer treatment trials","evidence":"gold"}' | head -10
# Expect: sources with _source: "PubMed", trustScore: 95

# 4. ClinicalTrials.gov
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"recruiting diabetes trials india","enable_trials":true}' | head -10
# Expect: sources with _source: "ClinicalTrials", NCT IDs

# 5. Domain-Specific (Ayurveda)
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"fever treatment","domain":"ayurveda"}' | head -10
# Expect: Ayurveda sources, Sanskrit terms, Charaka Samhita references

# 6. Intensity Mode
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"what is diabetes","intensity":"quick"}' | wc -c
# Expect: short response (~200-500 chars)

curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"what is diabetes","intensity":"deep"}' | wc -c
# Expect: long response (~2000-4000 chars)

# 7. Persona Mode
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"hypertension management","persona":"clinician"}' | head -20
# Expect: ICD-10 codes, guideline references, medical terminology

# 8. M5 with Sources
curl -s -X POST localhost:8100/v1/chat/m5 \
  -d '{"message":"diabetes management"}' | grep sources
# Expect: non-empty sources array for each domain

# 9. Citation Format
curl -s -X POST localhost:8100/v1/chat \
  -d '{"message":"aspirin mechanism","evidence":"gold"}' 2>&1 | grep -o '\[S[0-9]\]'
# Expect: [S1], [S2], etc. inline citations
```

---

## Part 7: What This Fix Does NOT Cover

These are out of scope for this plan and belong to other services:

| Item | Owner | Reason |
|------|-------|--------|
| `/search` endpoint | web-service (port 8200) | Separate section |
| `/deep-research` endpoint | research-service (port 8201) | Separate section |
| `/analyze/*` endpoints | analysis-service (port 8202) | Separate section |
| Drug interaction tools | clinical section (ai-router) | Not Oracle's responsibility |
| Frontend UI changes | frontend-manthana | Already works with current SSE format |
| Auth enforcement | All services | REQUIRE_AUTH=false for now |

---

## Estimated Total Effort

| Phase | Tasks | Estimated Time |
|-------|-------|---------------|
| Phase A: Core Intelligence | 7 steps | ~1.5 hours |
| Phase B: Prompt Engineering | 4 steps | ~1 hour |
| Phase C: M5 Restoration | 6 steps | ~1.5 hours |
| Phase D: Polish | 6 steps | ~1.5 hours |
| **Total** | **23 steps** | **~5.5 hours** |

---

*This plan restores the Oracle service to full parity with the ai-router's chat
implementation while maintaining complete separation from other backend sections.*
