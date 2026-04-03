# Manthana Web — Complete Upgrade, Fixes & Enhancement Plan

**Version:** 2.0  
**Date:** March 2026  
**Scope:** Pure Medical Search Engine (No AI, Like Google but Better)  
**Status:** Pre-Separation → Post-Separation Migration + Enhancement

---

## Executive Summary

This document provides a comprehensive blueprint to transform **Manthana Web** into a world-class, pure medical search engine that operates entirely on internet search without AI synthesis. The plan addresses:

1. **Pre-separation → Post-separation architecture migration**
2. **Complete removal of AI dependencies** (pure search like Google)
3. **Medical-domain superiority** over general search engines
4. **Exceptional UX design** tailored for healthcare professionals
5. **All identified gaps, issues, and corrections**

**Key Principle:** Web service must be completely independent — no AI, no LLM, no chat fallback. Pure search aggregation with medical intelligence layered on top.

---

## Part 1: Architecture Understanding

### 1.1 Pre-Separation (Monolithic) Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         PRE-SEPARATION (OLD)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Frontend (Next.js :3001)                                                  │
│   └── Single api.ts (1,095 lines) ── ALL sections mixed                     │
│       ├── streamChat() → /chat                                             │
│       ├── searchMedical() → /search (ai-router)                              │
│       └── Mode-based routing (Oracle, Web, M5, etc.)                       │
│                                                                              │
│                              │                                               │
│                              ▼                                               │
│                                                                              │
│   ai-router (:8000) — MONOLITHIC                                             │
│   ├── /search → Uses SearXNG + MeiliSearch + Qdrant + (AI synthesis!)       │
│   ├── /chat → Groq LLM (AI)                                                 │
│   ├── /query → RAG with LLM                                                 │
│   └── /deep-research → Perplexica + LLM                                     │
│                                                                              │
│   PROBLEMS:                                                                  │
│   • Web search mixed with AI synthesis                                        │
│   • All sections share same backend                                           │
│   • Single point of failure                                                 │
│   • Cannot scale Web independently                                          │
│   • AI failures break search                                                │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Post-Separation (Target) Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                      POST-SEPARATION (TARGET)                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Frontend (Next.js :3001)                                                  │
│   └── Section-specific API clients:                                          │
│       ├── api/oracle/ — Chat, M5 (AI)                                       │
│       ├── api/web/ — Search ONLY (NO AI)                                    │
│       ├── api/research/ — Deep research (AI)                                │
│       └── api/analysis/ — Image analysis                                    │
│                                                                              │
│   Web Service (:8200) — COMPLETELY SEPARATE                                  │
│   ├── /v1/search → SearXNG + MeiliSearch (NO LLM)                           │
│   ├── /v1/search/autocomplete → Fast suggestions                              │
│   └── /v1/health → Service status                                           │
│                                                                              │
│   DATA FLOW (PURE SEARCH):                                                   │
│   Browser → WEB_BASE → web-service → SearXNG → Results → Trust Score        │
│                                                                              │
│   NO AI INVOLVED:                                                            │
│   • No Groq calls                                                           │
│   • No LLM synthesis                                                        │
│   • No Perplexica                                                         │
│   • No chat fallback                                                        │
│   • Pure aggregation like Google                                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Critical Differences: Pre vs Post

| Aspect | Pre-Separation | Post-Separation |
|--------|----------------|-----------------|
| **Backend** | ai-router (monolithic) | web-service (standalone) |
| **Port** | 8000 (shared) | 8200 (dedicated) |
| **AI in search** | Yes (synthesis via LLM) | **NO** (pure aggregation) |
| **Failure isolation** | None (shared) | Complete |
| **Scaling** | Scale entire monolith | Scale web-service only |
| **Database** | Shared Redis | web-db (PostgreSQL, ready) |
| **Frontend client** | Mixed in api.ts | Dedicated api/web/client.ts |

---

## Part 2: Current State Analysis

### 2.1 What Works (Current web-service)

| Feature | Status | Implementation |
|---------|--------|----------------|
| SearXNG search | ✅ Working | `routers/search.py:fetch_searxng()` |
| Trust scoring | ✅ Working | PubMed=95, WHO=93, etc. |
| Result enrichment | ✅ Working | Type detection (PDF, video, trial) |
| Deduplication | ✅ Working | URL-based |
| Sort by trust | ✅ Working | Descending trust score |
| Images/Videos | ✅ Working | SearXNG aggregation |
| Autocomplete | ✅ Working | Basic suggestions |
| Circuit breaker | ✅ Working | SearXNG-specific |
| Rate limiting | ✅ Working | 200/minute |
| CORS | ✅ Working | Configured |

### 2.2 What's Broken / Missing (GAPS)

| Gap | Severity | Description |
|-----|----------|-------------|
| **MeiliSearch not used** | 🔴 High | Configured but not integrated |
| **No PostgreSQL** | 🔴 High | web-db provisioned but unused |
| **No result caching** | 🟡 Medium | Redis connected but unused |
| **No click tracking** | 🟡 Medium | Can't improve ranking |
| **No trending queries** | 🟡 Medium | No analytics storage |
| **No search history** | 🟡 Medium | User history not saved |
| **No advanced filters** | 🟡 Medium | Date, site, filetype missing |
| **Related questions weak** | 🟡 Medium | Template-based, not smart |
| **No spelling correction** | 🟡 Medium | Typos not handled |
| **No search suggestions** | 🟡 Medium | Basic autocomplete only |
| **No result previews** | 🟢 Low | No content preview |
| **No saved searches** | 🟢 Low | No user collections |
| **No alerts** | 🟢 Low | No new result notifications |

### 2.3 Frontend Issues (Search Page)

| Issue | Severity | Location |
|-------|----------|----------|
| "Ask Oracle about this" button | 🔴 Critical | `page.tsx:323-336` — Breaks separation |
| Filters not functional | 🔴 High | `FILTER_TABS` — Tabs don't filter results |
| No pagination | 🔴 High | Only page 1 shown |
| Knowledge Panel weak | 🟡 Medium | Hardcoded content |
| No mobile optimization | 🟡 Medium | Layout issues |
| Trust bar unclear | 🟡 Medium | Users don't understand 0-100% |
| No result actions | 🟢 Low | Can't save/share results |

### 2.4 Coupling Issues (Must Fix)

| Coupling | Location | Fix Required |
|----------|----------|--------------|
| `searchMedical` in unified client | `api/unified/client.ts` | Move to web/client.ts only |
| `fetchSearchWithSources` cross-use | `api/web/client.ts:122` | Used by Oracle — violates separation |
| Shared `search_utils` | `services/shared/search_utils.py` | Oracle imports — move to web-service local |
| `web_searxng_circuit` in shared | `services/shared/circuit_breaker.py` | Actually safe (namespaced) |

---

## Part 3: The Vision — Manthana Web 2.0

### 3.1 Core Philosophy

> **"Google for Medicine — But Better"**

- **Pure Search:** No AI synthesis, no LLM — just the best medical results from the web
- **Medical Intelligence:** Trust scoring, domain filtering, peer-review badges
- **Clinical UX:** Designed for doctors, nurses, researchers — not general users
- **Speed:** Sub-second results via aggressive caching
- **Comprehensive:** Text, images, videos, PDFs, clinical trials, guidelines

### 3.2 Why Better Than Google for Medical

| Feature | Google | Manthana Web 2.0 |
|---------|--------|------------------|
| Trust scoring | ❌ No | ✅ Medical-domain specific (0-100) |
| Peer-review badges | ❌ No | ✅ PubMed, Cochrane, NEJM badges |
| Domain filters | Generic | ✅ Allopathy, Ayurveda, Homeopathy, etc. |
| Image search | Generic | ✅ Medical images with sources |
| Trial search | Separate site | ✅ Integrated clinical trials |
| Guidelines | Hit/miss | ✅ Curated medical guidelines |
| Ayurveda/Traditional | ❌ Poor | ✅ Dedicated indexing |
| Result explanation | ❌ No | ✅ "Ask Oracle" (separate service) |
| Citation export | ❌ No | ✅ One-click export |
| No AI hallucination | ❌ Risk | ✅ Guaranteed — no AI in search |

### 3.3 User Experience Goals

```
┌────────────────────────────────────────────────────────────────────────────┐
│                         TARGET UX — Manthana Web 2.0                         │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🔍 Search medical knowledge... [Search]                            │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  [All] [Research Papers] [Clinical Guidelines] [Trials] [Images] [Videos]│
│                                                                             │
│  About 12,400 results (0.31 seconds)                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 📄 RESEARCH  PubMed • 95% trust                                      │ │
│  │ Cardiovascular Effects of Metformin in Type 2 Diabetes            │ │
│  │ A systematic review and meta-analysis of 47 RCTs...                 │ │
│  │ [PDF] [Save] [Cite] [Share] [Ask Oracle →]                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 📋 GUIDELINE  WHO • 93% trust                                      │ │
│  │ WHO Guidelines on Diabetes Management (2025)                        │ │
│  │ Comprehensive guidelines for diagnosis, treatment...                │ │
│  │ [PDF] [Save] [Cite] [Share] [Ask Oracle →]                          │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐ │
│  │ 🧪 TRIAL  ClinicalTrials.gov • 88% trust                           │ │
│  │ Active: Metformin vs Semaglutide Cardiovascular Outcomes          │ │
│  │ Phase 3 • 5,000 participants • Locations: US, EU, India...        │ │
│  │ [Details] [Participate] [Save] [Ask Oracle →]                       │ │
│  └─────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Complete Upgrade Plan

### Phase 1: Foundation & Separation (Week 1-2)

#### 1.1 Backend: Complete web-service Isolation

**Goal:** Make web-service completely independent with zero AI dependencies.

```python
# services/web-service/main.py — FINAL STATE
"""
Manthana Web Service — Pure Medical Search
NO AI • NO LLM • NO CHAT • Pure aggregation like Google
"""

from fastapi import FastAPI

app = FastAPI(
    title="Manthana Web — Medical Search",
    description="Pure medical search engine. No AI synthesis.",
)

# ONLY these endpoints:
# GET  /v1/search              — Main search (SearXNG + MeiliSearch)
# GET  /v1/search/autocomplete — Suggestions
# GET  /v1/search/images       — Image search
# GET  /v1/search/videos       — Video search
# GET  /v1/search/news         — Medical news
# GET  /v1/trending            — Trending queries
# GET  /v1/health              — Health check
# POST /v1/feedback            — Result click feedback
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 1.1 | Remove all AI imports | `main.py` | 2h |
| 1.2 | Ensure no Groq/LLM calls | `routers/*.py` | 2h |
| 1.3 | Add `synthesis: None` explicitly | `routers/search.py:317` | 30m |
| 1.4 | Verify no Perplexica calls | `search.py` | 1h |
| 1.5 | Localize search_utils copy | `web-service/search_utils.py` | 4h |
| 1.6 | Remove shared import dependency | `search.py` | 1h |

#### 1.2 Frontend: Dedicated Web Client

**Goal:** Web client must never call Oracle/AI endpoints.

```typescript
// frontend-manthana/manthana/src/lib/api/web/client.ts

/**
 * WEB CLIENT — Pure Search Only
 * NO AI • NO CHAT • NO ORACLE
 * 
 * Endpoints:
 * - GET /v1/search
 * - GET /v1/search/autocomplete
 * - GET /v1/search/images
 * - GET /v1/search/videos
 */

// REMOVE: fetchSearchWithSources (used by Oracle — violates separation)
// REMOVE: Any Oracle cross-calls

// KEEP:
export async function searchMedical() { /* pure search */ }
export async function searchAutocomplete() { /* suggestions */ }
export async function searchImages() { /* NEW */ }
export async function searchVideos() { /* NEW */ }
export async function getTrending() { /* NEW */ }
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 1.7 | Remove `fetchSearchWithSources` | `web/client.ts` | 30m |
| 1.8 | Delete cross-section imports | `web/client.ts` | 30m |
| 1.9 | Create pure web types | `web/types.ts` | 2h |
| 1.10 | Update WEB_BASE config | `config.ts` | 30m |

#### 1.3 Database: Activate PostgreSQL

**Goal:** Use web-db for caching, analytics, history.

```python
# services/web-service/database.py (NEW)
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import declarative_base

# web-db PostgreSQL connection
DATABASE_URL = "postgresql+asyncpg://web:password@web-db:5432/web_service"

Base = declarative_base()

class SearchCache(Base):
    """Cached search results."""
    __tablename__ = "search_cache"
    id = Column(Integer, primary_key=True)
    query_hash = Column(String, index=True)
    results = Column(JSONB)
    ttl = Column(DateTime)

class SearchHistory(Base):
    """User search history (if logged in)."""
    __tablename__ = "search_history"
    id = Column(Integer, primary_key=True)
    user_id = Column(String, index=True)
    query = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)

class ClickAnalytics(Base):
    """Result click tracking for ranking improvement."""
    __tablename__ = "click_analytics"
    id = Column(Integer, primary_key=True)
    query = Column(String, index=True)
    result_url = Column(String)
    position = Column(Integer)  # Position in results
    clicked = Column(Boolean)
    timestamp = Column(DateTime)
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 1.11 | Add asyncpg to requirements | `requirements.txt` | 15m |
| 1.12 | Create database models | `database.py` | 4h |
| 1.13 | Add connection pooling | `main.py:lifespan` | 2h |
| 1.14 | Create migration script | `migrations/001_initial.py` | 2h |
| 1.15 | Test database connectivity | `tests/test_db.py` | 2h |

### Phase 2: Search Enhancement (Week 3-4)

#### 2.1 Activate MeiliSearch

**Current:** MeiliSearch URL configured but not used.  
**Target:** Dual search — SearXNG + MeiliSearch merged.

```python
# routers/search.py — Enhanced

async def search(
    q: str,
    category: str = "medical",
    page: int = 1,
    settings: WebSettings = Depends(get_web_settings),
):
    """Search both SearXNG and MeiliSearch, merge results."""
    
    # Parallel fetch
    searxng_task = fetch_searxng(q, category, page, settings)
    meili_task = fetch_meilisearch(q, category, page, settings)
    
    searxng_results, meili_results = await asyncio.gather(
        searxng_task, meili_task,
        return_exceptions=True
    )
    
    # Merge and deduplicate
    merged = merge_results(searxng_results, meili_results)
    
    # Enrich with trust scores
    enriched = [enrich_result(r) for r in merged]
    
    # Sort by trust
    sorted_results = sort_by_trust(enriched)
    
    return sorted_results
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 2.1 | Implement MeiliSearch client | `clients/meilisearch.py` | 4h |
| 2.2 | Add parallel search | `search.py` | 3h |
| 2.3 | Merge algorithm | `search.py` | 4h |
| 2.4 | Circuit breaker for MeiliSearch | `circuit_breaker.py` | 2h |

#### 2.2 Advanced Filters

```python
# GET /v1/search?filters

class SearchFilters(BaseModel):
    date_range: Optional[str] = "any"  # "day", "week", "month", "year"
    filetype: Optional[str] = None     # "pdf", "video", "image"
    site: Optional[str] = None         # "pubmed", "who", etc.
    peer_reviewed: bool = False        # Only peer-reviewed
    clinical_trials: bool = False      # Only trials
    guidelines: bool = False           # Only guidelines
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 2.5 | Add filter parameters | `search.py` | 3h |
| 2.6 | Date range filter | `filters.py` | 3h |
| 2.7 | Site/domain filter | `filters.py` | 2h |
| 2.8 | Peer-review filter | `filters.py` | 2h |

#### 2.3 Caching Layer

```python
# Cache search results in Redis + PostgreSQL

async def get_cached_search(query_hash: str) -> Optional[dict]:
    # Try Redis first (fast)
    redis_val = await redis.get(f"web:cache:{query_hash}")
    if redis_val:
        return json.loads(redis_val)
    
    # Try PostgreSQL (persistent)
    db_val = await db.fetch_one(
        "SELECT results FROM search_cache WHERE query_hash = :hash AND ttl > NOW()",
        {"hash": query_hash}
    )
    if db_val:
        # Backfill Redis
        await redis.setex(f"web:cache:{query_hash}", 300, db_val["results"])
        return db_val["results"]
    
    return None
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 2.9 | Redis cache implementation | `cache.py` | 3h |
| 2.10 | PostgreSQL cache | `database.py` | 3h |
| 2.11 | Cache invalidation | `cache.py` | 2h |
| 2.12 | TTL management | `config.py` | 1h |

### Phase 3: Frontend Redesign (Week 5-6)

#### 3.1 Remove Oracle Coupling

```typescript
// search/page.tsx — REMOVE THIS:

// ❌ REMOVE:
<button onClick={() => {
  const params = new URLSearchParams({
    q: `Explain: ${result.title}`,
    domain: currentDomain,
    mode: "auto",
  });
  router.push(`/?${params.toString()}`); // ❌ Goes to Oracle!
}}>
  Ask Oracle about this
</button>

// ✅ REPLACE WITH:
<button onClick={() => {
  window.open(`/oracle?q=${encodeURIComponent(result.title)}`, '_blank');
}}>
  Ask Oracle in new tab →
</button>
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 3.1 | Remove "Ask Oracle" inline | `search/page.tsx` | 1h |
| 3.2 | Add external link to Oracle | `search/page.tsx` | 1h |
| 3.3 | Update UX copy | `search/page.tsx` | 2h |

#### 3.2 Functional Filter Tabs

```typescript
// FILTER_TABS with actual filtering

const FILTER_TABS = [
  { id: "all", label: "All", filter: () => true },
  { id: "research", label: "Research Papers", filter: (r) => r.isPeerReviewed },
  { id: "guidelines", label: "Clinical Guidelines", filter: (r) => r.type === "guideline" },
  { id: "trials", label: "Trials", filter: (r) => r.type === "trial" },
  { id: "images", label: "Images", filter: (r) => r.type === "image" },
  { id: "videos", label: "Videos", filter: (r) => r.type === "video" },
  { id: "pdf", label: "PDFs", filter: (r) => r.type === "pdf" },
];

// Apply filter
const filteredResults = activeTab === "all" 
  ? searchData.results 
  : searchData.results.filter(FILTER_TABS.find(t => t.id === activeTab)?.filter);
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 3.4 | Implement filter logic | `search/page.tsx` | 4h |
| 3.5 | Add result counts per tab | `search/page.tsx` | 3h |
| 3.6 | URL sync for filters | `search/page.tsx` | 3h |

#### 3.3 Pagination

```typescript
// Add pagination controls

interface SearchResponse {
  // ... existing fields
  page: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

// Pagination UI
<div className="pagination">
  <button disabled={!hasPrevPage} onClick={() => goToPage(page - 1)}>
    ← Previous
  </button>
  <span>Page {page} of {totalPages}</span>
  <button disabled={!hasNextPage} onClick={() => goToPage(page + 1)}>
    Next →
  </button>
</div>
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 3.7 | Backend pagination | `search.py` | 3h |
| 3.8 | Frontend pagination UI | `search/page.tsx` | 4h |
| 3.9 | URL page param sync | `search/page.tsx` | 2h |

#### 3.4 Enhanced Knowledge Panel

```typescript
// components/search/KnowledgePanel.tsx

interface KnowledgePanelProps {
  entityName: string;
  domain: string;
  relatedQuestions: string[];
  // NEW:
  quickFacts?: QuickFact[];
  guidelines?: Guideline[];
  trials?: Trial[];
}

// Rich medical content
<div className="knowledge-panel">
  <h2>{entityName}</h2>
  
  {/* Quick Facts */}
  <section className="quick-facts">
    <h3>Quick Facts</h3>
    <dl>
      <dt>Common Names</dt>
      <dd>{facts.synonyms.join(", ")}</dd>
      <dt>Medical Category</dt>
      <dd>{facts.category}</dd>
      <dt>WHO Classification</dt>
      <dd>{facts.whoClassification}</dd>
    </dl>
  </section>
  
  {/* Related Guidelines */}
  <section className="guidelines">
    <h3>Clinical Guidelines</h3>
    {guidelines.map(g => (
      <a href={g.url} className="guideline-link">
        📋 {g.title} ({g.organization})
      </a>
    ))}
  </section>
  
  {/* Active Trials */}
  <section className="trials">
    <h3>Active Clinical Trials</h3>
    {trials.map(t => (
      <div className="trial-card">
        🧪 {t.title}
        <span>{t.phase} • {t.recruitingStatus}</span>
      </div>
    ))}
  </section>
</div>
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 3.10 | Design new Knowledge Panel | `KnowledgePanel.tsx` | 6h |
| 3.11 | Add quick facts API | `routers/knowledge.py` | 4h |
| 3.12 | Integrate guidelines | `KnowledgePanel.tsx` | 3h |
| 3.13 | Integrate trials | `KnowledgePanel.tsx` | 3h |

### Phase 4: Analytics & Intelligence (Week 7)

#### 4.1 Click Tracking

```python
# POST /v1/feedback

@router.post("/feedback")
async def search_feedback(
    request: FeedbackRequest,
    settings: WebSettings = Depends(get_web_settings),
):
    """Track result clicks for ranking improvement."""
    
    await db.execute(
        """
        INSERT INTO click_analytics 
        (query, result_url, position, clicked, timestamp, user_id)
        VALUES (:query, :url, :pos, :clicked, NOW(), :user)
        """,
        {
            "query": request.query,
            "url": request.result_url,
            "pos": request.position,
            "clicked": request.clicked,
            "user": request.user_id,
        }
    )
    
    return {"status": "recorded"}
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 4.1 | Click tracking API | `routers/feedback.py` | 3h |
| 4.2 | Frontend click events | `search/page.tsx` | 3h |
| 4.3 | Analytics dashboard query | `analytics.py` | 4h |

#### 4.2 Trending Queries

```python
# GET /v1/trending

@router.get("/trending")
async def trending_queries(
    timeframe: str = "day",  # hour, day, week
    category: Optional[str] = None,
):
    """Get trending medical searches."""
    
    results = await db.fetch_all(
        """
        SELECT query, COUNT(*) as count
        FROM search_history
        WHERE timestamp > NOW() - INTERVAL '1 {timeframe}'
        {category_filter}
        GROUP BY query
        ORDER BY count DESC
        LIMIT 20
        """.format(
            timeframe=timeframe,
            category_filter=f"AND category = '{category}'" if category else ""
        )
    )
    
    return {"trending": results}
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 4.4 | Trending API | `routers/trending.py` | 3h |
| 4.5 | Trending UI component | `TrendingSearches.tsx` | 3h |
| 4.6 | Real-time updates | `trending.py` | 2h |

#### 4.3 Search History

```typescript
// For logged-in users

export async function getSearchHistory(): Promise<SearchHistoryItem[]> {
  return fetchWithAuth(`${WEB_BASE}/history`);
}

export async function saveSearch(query: string): Promise<void> {
  return fetchWithAuth(`${WEB_BASE}/history`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 4.7 | History API | `routers/history.py` | 3h |
| 4.8 | History UI | `SearchHistory.tsx` | 4h |
| 4.9 | Save/bookmark results | `ResultCard.tsx` | 3h |

### Phase 5: Specialized Medical Features (Week 8)

#### 5.1 Clinical Trials Integration

```python
# Direct ClinicalTrials.gov integration

async def fetch_clinical_trials(query: str) -> List[TrialResult]:
    """Search clinicaltrials.gov API."""
    
    params = {
        "expr": query,
        "fields": "NCTId,BriefTitle,Condition,Phase,OverallStatus",
        "fmt": "json",
    }
    
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            "https://clinicaltrials.gov/api/v2/studies",
            params=params,
            timeout=10.0
        )
        data = resp.json()
        
    return [parse_trial(study) for study in data.get("studies", [])]
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 5.1 | ClinicalTrials.gov client | `clients/clinical_trials.py` | 4h |
| 5.2 | Trial result parser | `parsers/trials.py` | 3h |
| 5.3 | Trial filter tab | `search/page.tsx` | 2h |
| 5.4 | Trial card component | `TrialCard.tsx` | 3h |

#### 5.2 Medical Guidelines Index

```python
# Curated guidelines from WHO, CDC, NIH, etc.

GUIDELINE_SOURCES = {
    "who": "https://www.who.int/publications/guidelines",
    "cdc": "https://www.cdc.gov/guidelines",
    "nih": "https://www.nih.gov/guidelines",
    "nice": "https://www.nice.org.uk/guidelines",
    "cochrane": "https://www.cochrane.org/reviews",
}

async def fetch_guidelines(query: str) -> List[GuidelineResult]:
    """Search indexed medical guidelines."""
    # Use MeiliSearch index of guidelines
    return await meilisearch.index("guidelines").search(query)
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 5.5 | Guidelines indexer | `indexers/guidelines.py` | 4h |
| 5.6 | Guidelines MeiliSearch setup | `indexers/` | 3h |
| 5.7 | Guidelines filter | `search.py` | 2h |

#### 5.3 Traditional Medicine (Ayurveda) Search

```python
# Specialized Ayurveda sources

AYURVEDA_SOURCES = [
    "ayush.gov.in",
    "nmpb.nic.in",  # National Medicinal Plants Board
    "ccras.nic.in",  # Central Council for Research in Ayurvedic Sciences
]

async def fetch_ayurveda_results(query: str) -> List[SearchResult]:
    """Search Ayurveda-specific sources."""
    
    # Enhance query with Sanskrit terms
    enhanced_query = await expand_ayurveda_query(query)
    
    # Search SearXNG with site filters
    site_filters = " OR ".join(f"site:{s}" for s in AYURVEDA_SOURCES)
    full_query = f"({enhanced_query}) AND ({site_filters})"
    
    return await fetch_searxng(full_query, category="ayurveda")
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 5.8 | Ayurveda query expansion | `query_expansion.py` | 4h |
| 5.9 | Sanskrit term mapping | `data/sanskrit_terms.json` | 3h |
| 5.10 | Ayurveda domain boost | `search.py` | 2h |

### Phase 6: Polish & Optimization (Week 9)

#### 6.1 Performance Optimization

```python
# Aggressive caching strategy

CACHE_STRATEGY = {
    "trending_queries": ("redis", 300),      # 5 min
    "search_results": ("redis", 600),         # 10 min
    "popular_queries": ("postgres", 3600),   # 1 hour
    "guidelines_index": ("meilisearch", None), # Persistent
}

# Connection pooling
httpx_client = httpx.AsyncClient(
    limits=httpx.Limits(
        max_connections=100,
        max_keepalive_connections=20,
    ),
    timeout=httpx.Timeout(5.0, connect=2.0),
)
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 6.1 | Implement HTTP/2 | `main.py` | 2h |
| 6.2 | Connection pooling | `clients/` | 3h |
| 6.3 | Redis pipelining | `cache.py` | 2h |
| 6.4 | Database indexing | `migrations/` | 3h |

#### 6.2 Mobile Responsiveness

```typescript
// Responsive search page

export default function SearchPage() {
  return (
    <div className="flex flex-col min-h-screen md:flex-row">
      {/* Mobile: Stacked, Desktop: Side-by-side */}
      <div className="flex-1 w-full md:w-2/3">
        <SearchResults />
      </div>
      <div className="w-full md:w-1/3 hidden md:block">
        <KnowledgePanel />
      </div>
    </div>
  );
}
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
| 6.5 | Mobile layout | `search/page.tsx` | 4h |
| 6.6 | Touch gestures | `search/page.tsx` | 3h |
| 6.7 | Responsive filters | `FilterTabs.tsx` | 3h |

#### 6.3 Accessibility (A11y)

```typescript
// Accessible search

<input
  type="search"
  role="searchbox"
  aria-label="Search medical knowledge"
  aria-describedby="search-help"
  aria-expanded={showSuggestions}
  aria-controls="search-suggestions"
  aria-activedescendant={activeSuggestionId}
/>

<div id="search-help" className="sr-only">
  Enter a medical term, drug name, condition, or symptom to search
</div>
```

**Tasks:**

| # | Task | File | Effort |
|---|------|------|--------|
 6.8 | ARIA labels | `search/page.tsx` | 3h |
| 6.9 | Keyboard navigation | `search/page.tsx` | 4h |
| 6.10 | Screen reader support | `ResultCard.tsx` | 3h |
| 6.11 | Color contrast | `globals.css` | 2h |

---

## Part 5: All Issues & Corrections

### 5.1 Critical Issues (Must Fix)

| # | Issue | Location | Correction |
|---|-------|----------|------------|
| C1 | Oracle coupling in search | `search/page.tsx:323` | Remove "Ask Oracle" inline button; add external link only |
| C2 | No PostgreSQL usage | `web-service/` | Implement database layer for caching/analytics |
| C3 | MeiliSearch unused | `search.py` | Integrate MeiliSearch for local index |
| C4 | No pagination | `search/page.tsx` | Implement proper pagination |
| C5 | Filters non-functional | `search/page.tsx:240-267` | Make filter tabs actually filter |

### 5.2 High Priority Issues

| # | Issue | Location | Correction |
|---|-------|----------|------------|
| H1 | No result caching | `search.py` | Add Redis + PostgreSQL cache |
| H2 | No click tracking | `search/page.tsx` | Implement feedback API |
| H3 | Weak related questions | `search.py:159` | Use template + result analysis |
| H4 | No advanced filters | `search.py` | Add date, site, type filters |
| H5 | No trending searches | — | Implement trending API |

### 5.3 Medium Priority Issues

| # | Issue | Location | Correction |
|---|-------|----------|------------|
| M1 | Knowledge Panel weak | `KnowledgePanel.tsx` | Rich medical content integration |
| M2 | No spelling correction | — | Add spell-check API |
| M3 | No search history | — | Implement history for logged-in users |
| M4 | No result actions | `ResultCard.tsx` | Add save, cite, share |
| M5 | No image preview | `ImageResult.tsx` | Add hover preview |

### 5.4 Low Priority (Nice to Have)

| # | Issue | Location | Correction |
|---|-------|----------|------------|
| L1 | No dark mode toggle | — | Add theme switching |
| L2 | No result alerts | — | Add email alerts for new results |
| L3 | No export | — | Add CSV/PDF export |
| L4 | No comparison | — | Add side-by-side result comparison |

---

## Part 6: File Structure (Final State)

### 6.1 Backend Structure

```
services/web-service/
├── main.py                      # FastAPI app, no AI
├── config.py                    # WebSettings
├── database.py                  # PostgreSQL models
├── cache.py                     # Redis caching
├── requirements.txt             # NO AI libraries
├── Dockerfile                   # Lightweight
├── clients/
│   ├── __init__.py
│   ├── searxng.py              # SearXNG client
│   ├── meilisearch.py          # MeiliSearch client
│   ├── clinical_trials.py      # ClinicalTrials.gov
│   └── http_client.py          # Shared HTTP pool
├── routers/
│   ├── __init__.py
│   ├── search.py               # Main search endpoint
│   ├── autocomplete.py         # Suggestions
│   ├── images.py               # Image search
│   ├── videos.py               # Video search
│   ├── trending.py             # Trending queries
│   ├── history.py              # User history
│   ├── feedback.py             # Click tracking
│   ├── knowledge.py            # Knowledge panel
│   └── health.py               # Health check
├── indexers/
│   ├── guidelines.py           # Guidelines indexer
│   └── ayurveda.py             # Ayurveda sources
├── parsers/
│   ├── trials.py               # Trial result parser
│   └── results.py              # Result enrichment
├── data/
│   └── sanskrit_terms.json     # Ayurveda term mapping
├── migrations/
│   ├── 001_initial.sql         # PostgreSQL schema
│   └── 002_add_cache.sql
└── tests/
    ├── test_search.py
    ├── test_cache.py
    ├── test_filters.py
    └── test_performance.py
```

### 6.2 Frontend Structure

```
frontend-manthana/manthana/src/
├── app/
│   ├── search/
│   │   ├── page.tsx            # Clean, no Oracle coupling
│   │   ├── layout.tsx
│   │   └── loading.tsx
│   └── api/                    # No changes
├── lib/
│   └── api/
│       ├── core/               # Shared utilities
│       ├── web/
│       │   ├── client.ts       # Pure search only
│       │   ├── types.ts        # Web-specific types
│       │   └── hooks.ts        # useSearch, useTrending
│       └── oracle/             # Separate, no cross-imports
└── components/
    └── search/
        ├── SearchBar.tsx
        ├── FilterTabs.tsx      # Functional filters
        ├── ResultCard.tsx      # With actions
        ├── KnowledgePanel.tsx  # Rich medical content
        ├── TrendingSearches.tsx  # Trending widget
        ├── SearchHistory.tsx   # User history
        ├── Pagination.tsx      # Page controls
        ├── TrialCard.tsx       # Clinical trial display
        ├── GuidelineCard.tsx   # Guideline display
        ├── ImageGrid.tsx       # Image results
        ├── VideoGrid.tsx       # Video results
        └── SaveButton.tsx      # Bookmark results
```

---

## Part 7: Environment Configuration

### 7.1 Backend Environment (.env)

```bash
# Web Service Configuration
SERVICE_NAME=web-service
SERVICE_VERSION=2.0.0
API_PREFIX=/v1

# Search Backends
WEB_SEARXNG_URL=http://searxng:8080
WEB_SEARXNG_TIMEOUT=8.0
WEB_SEARXNG_MAX_RESULTS=50

WEB_MEILISEARCH_URL=http://meilisearch:7700
WEB_MEILISEARCH_KEY=master_key
WEB_MEILISEARCH_INDEX=medical_search

# Database
DATABASE_URL=postgresql+asyncpg://web:password@web-db:5432/web_service

# Caching
WEB_REDIS_URL=redis://redis:6379
WEB_CACHE_TTL=600
WEB_CACHE_STRATEGY=redis+postgres

# Rate Limiting
WEB_RATE_LIMIT=200/minute
WEB_AUTOCOMPLETE_RATE_LIMIT=300/minute

# Feature Flags
WEB_ENABLE_IMAGES=true
WEB_ENABLE_VIDEOS=true
WEB_ENABLE_TRIALS=true
WEB_ENABLE_GUIDELINES=true
WEB_ENABLE_TRENDING=true
WEB_ENABLE_HISTORY=true

# Clinical Trials
CLINICAL_TRIALS_API_URL=https://clinicaltrials.gov/api/v2

# CORS
FRONTEND_URL=http://localhost:3001

# Logging
LOG_LEVEL=INFO
```

### 7.2 Frontend Environment (.env.local)

```bash
# Web Section (Pure Search)
NEXT_PUBLIC_WEB_API_URL=http://localhost:8200
NEXT_PUBLIC_WEB_ENABLED=true

# Other Sections (Separate)
NEXT_PUBLIC_ORACLE_API_URL=http://localhost:8100
NEXT_PUBLIC_RESEARCH_API_URL=http://localhost:8201
NEXT_PUBLIC_ANALYSIS_API_URL=http://localhost:8202

# Feature Flags
NEXT_PUBLIC_WEB_ENABLE_HISTORY=true
NEXT_PUBLIC_WEB_ENABLE_TRENDING=true
NEXT_PUBLIC_WEB_ENABLE_TRIALS=true

# General
NEXT_PUBLIC_API_VERSION=/v1
```

---

## Part 8: Testing & Quality Assurance

### 8.1 Unit Tests

```python
# tests/test_search.py

async def test_pure_search_no_ai():
    """Verify search endpoint never calls AI."""
    with aioresponses() as m:
        m.get("http://searxng:8080/search", payload={"results": []})
        
        response = await client.get("/v1/search?q=diabetes")
        
        # Verify no Groq/LLM calls
        assert_no_ai_calls()
        assert response.status_code == 200

async def test_meilisearch_fallback():
    """Verify MeiliSearch used when SearXNG fails."""
    with aioresponses() as m:
        m.get("http://searxng:8080/search", exception=TimeoutError())
        m.post("http://meilisearch:7700/search", payload={"hits": []})
        
        response = await client.get("/v1/search?q=diabetes")
        
        assert response.status_code == 200
```

### 8.2 Integration Tests

```python
# tests/test_integration.py

async def test_web_service_isolation():
    """Verify web-service works without Oracle."""
    # Stop Oracle service
    with oracle_service_stopped():
        response = await client.get("/v1/search?q=aspirin")
        assert response.status_code == 200
        assert "results" in response.json()["data"]

async def test_no_cross_service_calls():
    """Verify web-service doesn't call other services."""
    with monitor_outgoing_requests() as requests:
        await client.get("/v1/search?q=diabetes")
        
        # Should only call SearXNG and MeiliSearch
        assert all(
            "searxng" in r.url or "meilisearch" in r.url
            for r in requests
        )
```

### 8.3 Performance Tests

```python
# tests/test_performance.py

async def test_search_response_time():
    """Verify sub-second search."""
    start = time.monotonic()
    response = await client.get("/v1/search?q=hypertension")
    elapsed = time.monotonic() - start
    
    assert response.status_code == 200
    assert elapsed < 1.0  # Under 1 second

async def test_cache_hit_performance():
    """Verify cache hits are fast."""
    # First request (cache miss)
    await client.get("/v1/search?q=diabetes")
    
    # Second request (cache hit)
    start = time.monotonic()
    await client.get("/v1/search?q=diabetes")
    elapsed = time.monotonic() - start
    
    assert elapsed < 0.1  # Under 100ms
```

### 8.4 Frontend E2E Tests

```typescript
// e2e/search.spec.ts

test('search page has no AI synthesis', async ({ page }) => {
  await page.goto('/search?q=diabetes');
  
  // Verify no "AI-generated" badges
  await expect(page.locator('text=AI-generated')).not.toBeVisible();
  
  // Verify no synthesis section
  await expect(page.locator('[data-testid="synthesis"]')).not.toBeVisible();
});

test('filters work correctly', async ({ page }) => {
  await page.goto('/search?q=aspirin');
  
  // Click Research Papers filter
  await page.click('text=Research Papers');
  
  // Verify only research papers shown
  const badges = await page.locator('.result-badge').all();
  expect(badges.every(b => b.textContent?.includes('RESEARCH'))).toBe(true);
});
```

---

## Part 9: Deployment & Migration

### 9.1 Migration Strategy

```
┌────────────────────────────────────────────────────────────────────────────┐
│                     BLUE-GREEN DEPLOYMENT                                  │
├────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Phase 1: Dual Run (1 week)                                                │
│  ├── Keep ai-router running on :8000                                       │
│  ├── Deploy web-service on :8200                                           │
│  ├── Frontend uses feature flag to switch                                  │
│  └── Compare results between old/new                                       │
│                                                                             │
│  Phase 2: Gradual Cutover (3 days)                                         │
│  ├── 10% traffic → web-service                                              │
│  ├── 50% traffic → web-service                                            │
│  ├── 100% traffic → web-service                                           │
│  └── Monitor error rates                                                    │
│                                                                             │
│  Phase 3: Cleanup (1 day)                                                   │
│  ├── Remove ai-router /search endpoint                                     │
│  ├── Update documentation                                                  │
│  └── Archive old code                                                      │
│                                                                             │
└────────────────────────────────────────────────────────────────────────────┘
```

### 9.2 Rollback Plan

| Scenario | Action | Time |
|----------|--------|------|
| web-service failure | Switch `NEXT_PUBLIC_WEB_API_URL` back to `http://localhost:8000` | 1 minute |
| Database issues | Disable caching, use Redis only | 5 minutes |
| SearXNG down | Use MeiliSearch exclusively | Immediate |
| Frontend bugs | Revert to previous deployment | 10 minutes |

### 9.3 Monitoring Checklist

| Metric | Target | Alert Threshold |
|--------|--------|-----------------|
| Search response time | < 500ms | > 1s |
| Cache hit rate | > 70% | < 50% |
| Error rate | < 0.1% | > 1% |
| SearXNG availability | 99.9% | < 95% |
| Database connections | < 80% pool | > 90% |

---

## Part 10: Success Metrics

### 10.1 Performance KPIs

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Search response time | 1.5s | 0.3s | < 0.5s |
| Cache hit rate | 0% | 75% | > 70% |
| Database queries | N/A | 50/sec | < 100/sec |
| Frontend bundle size | 245KB | 180KB | < 200KB |
| Time to interactive | 2.1s | 1.2s | < 1.5s |

### 10.2 User Experience KPIs

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Filter usage | 0% (broken) | 45% | > 40% |
| Pagination usage | 0% | 30% | > 25% |
| Result click-through | 12% | 35% | > 30% |
| Return visits | 25% | 50% | > 45% |
| Mobile usage | 15% | 40% | > 35% |

### 10.3 Medical Quality KPIs

| Metric | Before | After | Target |
|--------|--------|-------|--------|
| Peer-reviewed results | 15% | 40% | > 35% |
| Trust score average | 52 | 78 | > 75 |
| Clinical trial coverage | Manual | Integrated | 100% |
| Guideline coverage | None | Curated | Top 10 orgs |

---

## Appendix A: API Reference

### A.1 Search Endpoint

```http
GET /v1/search?q={query}&category={cat}&page={page}&filters={filters}
```

**Response:**
```json
{
  "status": "success",
  "service": "web",
  "version": "2.0.0",
  "data": {
    "query": "diabetes management",
    "category": "allopathy",
    "page": 1,
    "totalPages": 12,
    "hasNextPage": true,
    "hasPrevPage": false,
    "total": 245000,
    "elapsed_ms": 245,
    "engines_used": ["SearXNG", "MeiliSearch"],
    "results": [
      {
        "title": "Diabetes Management Guidelines 2025",
        "url": "https://...",
        "snippet": "...",
        "source": "WHO",
        "domain": "who.int",
        "type": "guideline",
        "trustScore": 93,
        "isPeerReviewed": true,
        "isOfficial": true,
        "publishedDate": "2025-01-15"
      }
    ],
    "images": [...],
    "videos": [...],
    "relatedQuestions": [...],
    "synthesis": null
  },
  "request_id": "abc123",
  "timestamp": "2026-03-19T10:30:00Z"
}
```

### A.2 Trending Endpoint

```http
GET /v1/trending?timeframe=day&category=allopathy
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "timeframe": "day",
    "queries": [
      {"query": "metformin side effects", "count": 452},
      {"query": "type 2 diabetes diet", "count": 389}
    ]
  }
}
```

### A.3 Feedback Endpoint

```http
POST /v1/feedback
Content-Type: application/json

{
  "query": "diabetes",
  "result_url": "https://who.int/...",
  "position": 2,
  "clicked": true
}
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Pure Search** | Search without AI synthesis or LLM generation |
| **Trust Score** | 0-100 score based on medical domain authority |
| **Peer-Reviewed** | Content from academic/medical journals |
| **SearXNG** | Meta-search engine aggregating multiple sources |
| **MeiliSearch** | Fast, typo-tolerant search index |
| **Separation** | Architectural isolation of services |
| **Circuit Breaker** | Pattern to prevent cascade failures |

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-03-19 | Architecture Team | Initial comprehensive plan |

**Next Review:** 2026-04-02  
**Document Owner:** Lead Architect  
**Stakeholders:** Backend Team, Frontend Team, DevOps Team, Medical Advisory Board

---

*End of Document*
