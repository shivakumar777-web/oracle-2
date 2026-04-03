# Manthana Web Upgrade Plan — Implementation Status

**Checked:** 2026-03-19  
**Plan:** MANTHANA_WEB_UPGRADE_PLAN.md v2.0

---

## Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Foundation & Separation | ✅ Done | ~95% |
| Phase 2: Search Enhancement | ✅ Done | ~90% |
| Phase 3: Frontend Redesign | ✅ Done | ~85% |
| Phase 4: Analytics & Intelligence | ⚠️ Partial | ~70% |
| Phase 5: Specialized Medical Features | ⚠️ Partial | ~40% |
| Phase 6: Polish & Optimization | ❌ Not started | ~10% |

**Overall:** Core plan is implemented. Several optional and enhancement items remain.

---

## Phase 1: Foundation & Separation — ✅ IMPLEMENTED

| Task | Status | Notes |
|------|--------|-------|
| 1.1 Remove all AI imports | ✅ | main.py has no Groq/LLM |
| 1.2 No Groq/LLM calls | ✅ | Routers are pure search |
| 1.3 synthesis: None | ✅ | WebSearchData has synthesis=None |
| 1.4 No Perplexica | ✅ | Not used |
| 1.5 Localize search_utils | ⚠️ | Still uses `services.shared` (circuit_breaker, envelopes) |
| 1.6 Dedicated web client | ✅ | api/web/client.ts |
| 1.7 fetchSearchWithSources | ⚠️ | Kept — Oracle uses it for chat context; calls web-service only |
| 1.8 Pure web types | ✅ | web/types.ts |
| 1.9 PostgreSQL database | ✅ | database.py with asyncpg |
| 1.10 search_cache, search_history, click_analytics | ✅ | All tables in init_schema |
| 1.11 Redis + PostgreSQL cache | ✅ | cache.py two-tier |
| 1.12 Lifespan DB init | ✅ | main.py lifespan |

---

## Phase 2: Search Enhancement — ✅ IMPLEMENTED

| Task | Status | Notes |
|------|--------|-------|
| 2.1 MeiliSearch client | ✅ | clients/meilisearch.py |
| 2.2 Parallel search (SearXNG + MeiliSearch) | ✅ | asyncio.gather in search.py |
| 2.3 Merge algorithm | ✅ | merge_results(), deduplicate_results() |
| 2.4 ClinicalTrials.gov | ✅ | clients/clinical_trials.py, integrated |
| 2.5 Filter params (result_type, peer_reviewed) | ✅ | Query params in search |
| 2.6 Redis cache | ✅ | get_cached, set_cached |
| 2.7 PostgreSQL cache | ✅ | db.get_cached_search, set_cached_search |
| 2.8 Pagination (totalPages, hasNextPage, hasPrevPage) | ✅ | In response |
| date_range, site, filetype filters | ❌ | Plan mentions; not implemented |
| Circuit breaker for MeiliSearch | ⚠️ | Only SearXNG has circuit breaker |

---

## Phase 3: Frontend Redesign — ✅ IMPLEMENTED

| Task | Status | Notes |
|------|--------|-------|
| 3.1 Remove "Ask Oracle" inline | ✅ | Now Link to `/?q=...` in new tab |
| 3.2 External link to Oracle | ✅ | target="_blank", rel="noopener noreferrer" |
| 3.3 Functional filter tabs | ✅ | FILTER_TABS with filter functions |
| 3.4 Pagination UI | ✅ | Previous/Next, page X of Y |
| 3.5 recordClick on result click | ✅ | handleResultClick calls recordClick |
| 3.6 Responsive layout | ✅ | flex-col md:flex-row |
| Result counts per tab | ❌ | Not implemented |
| URL sync for filters | ❌ | activeTab not in URL |
| Images filter tab | ❌ | Plan has Images; current has All, Research, Guidelines, Trials, PDFs, Videos, Articles |

---

## Phase 4: Analytics & Intelligence — ⚠️ PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| 4.1 Click tracking API | ✅ | POST /v1/feedback |
| 4.2 Frontend recordClick | ✅ | On result link click |
| 4.3 record_search on search | ✅ | db.record_search() in search router |
| 4.4 Trending API | ✅ | GET /v1/trending |
| 4.5 getTrending() client | ✅ | In web/client.ts |
| 4.6 TrendingSearches UI | ❌ | No component on search page |
| 4.7 History API (GET /history) | ❌ | No routers/history.py |
| 4.8 SearchHistory UI | ❌ | No SearchHistory component |
| 4.9 Save/bookmark results | ❌ | Not implemented |

---

## Phase 5: Specialized Medical Features — ⚠️ PARTIAL

| Task | Status | Notes |
|------|--------|-------|
| 5.1 ClinicalTrials.gov | ✅ | Integrated in search |
| 5.2 Trial filter tab | ✅ | "Trials" in FILTER_TABS |
| 5.3 Guidelines indexer | ❌ | No indexers/guidelines.py |
| 5.4 Guidelines MeiliSearch | ❌ | Not set up |
| 5.5 Ayurveda query expansion | ❌ | No query_expansion.py |
| 5.6 Sanskrit term mapping | ❌ | No data/sanskrit_terms.json |
| 5.7 Ayurveda domain | ⚠️ | KnowledgePanel has AYURVEDA_MAP; no backend expansion |

---

## Phase 6: Polish & Optimization — ❌ NOT IMPLEMENTED

| Task | Status | Notes |
|------|--------|-------|
| 6.1 HTTP/2 | ❌ | Not configured |
| 6.2 Connection pooling | ❌ | httpx per-request |
| 6.3 Redis pipelining | ❌ | Not used |
| 6.4 Database indexing | ⚠️ | Basic indexes in init_schema |
| 6.5 Mobile layout | ⚠️ | Basic responsive |
| 6.6 Touch gestures | ❌ | Not implemented |
| 6.7 ARIA labels | ⚠️ | aria-label on search input only |
| 6.8 Keyboard navigation | ❌ | Not implemented |
| 6.9 Screen reader support | ❌ | Not implemented |

---

## Critical Issues (Plan Part 5.1) — Status

| # | Issue | Status |
|---|--------|--------|
| C1 | Oracle coupling in search | ✅ Fixed — "Ask Oracle" opens new tab |
| C2 | No PostgreSQL usage | ✅ Fixed — database.py, record_search, record_click |
| C3 | MeiliSearch unused | ✅ Fixed — integrated |
| C4 | No pagination | ✅ Fixed — backend + frontend |
| C5 | Filters non-functional | ✅ Fixed — FILTER_TABS filter logic |

---

## High Priority Issues (Plan Part 5.2) — Status

| # | Issue | Status |
|---|--------|--------|
| H1 | No result caching | ✅ Fixed — Redis + PostgreSQL |
| H2 | No click tracking | ✅ Fixed — /feedback, recordClick |
| H3 | Weak related questions | ⚠️ Template-based (as in plan) |
| H4 | No advanced filters | ⚠️ result_type, peer_reviewed only |
| H5 | No trending searches | ✅ Fixed — /trending, getTrending |

---

## Not Implemented (Optional / Lower Priority)

1. **Separate endpoints:** GET /v1/search/images, GET /v1/search/videos (images/videos come in main search)
2. **searchImages(), searchVideos()** — Frontend helpers
3. **Images filter tab** — Can filter by type "image" if backend returns them
4. **History API** — GET /v1/history for logged-in users
5. **TrendingSearches component** — Widget on search page
6. **Guidelines indexer** — MeiliSearch guidelines index
7. **Ayurveda query expansion** — Sanskrit term mapping
8. **search_utils localization** — Still uses shared circuit_breaker, envelopes
9. **Result counts per tab** — e.g. "Research (12)"
10. **URL sync for filters** — ?tab=research in URL
11. **Enhanced Knowledge Panel** — Quick facts, guidelines, trials from API
12. **Phase 6** — Performance, accessibility polish

---

## Conclusion

The **core plan is implemented**:

- Web service is isolated (no AI)
- PostgreSQL + Redis caching
- MeiliSearch + ClinicalTrials.gov integration
- Functional filters and pagination
- Click tracking and trending
- "Ask Oracle" opens in new tab

Remaining items are mostly **optional enhancements** (Phase 5–6): guidelines indexer, Ayurveda expansion, history API/UI, trending widget, accessibility, and performance tuning.
