# Manthana Section Separation — Comprehensive Fix Plan

**Document Version:** 1.0  
**Date:** March 2026  
**Status:** Draft for Review  
**Priority:** Critical for Production Stability

---

## Executive Summary

This document provides a complete architectural fix plan to decouple Manthana's four primary sections (Oracle, Web, Deep Research, Analysis/Clinical Tools) at both frontend and backend layers. The goal is to achieve **true micro-frontend/micro-backend separation** where each section can be developed, deployed, and scaled independently.

**Current State:** All sections share a single API gateway, common database connections, and a monolithic frontend API client.

**Target State:** Each section has isolated backend services, dedicated API clients, independent configuration, and clean interfaces.

---

## Table of Contents

1. [Problem Analysis Summary](#1-problem-analysis-summary)
2. [Target Architecture](#2-target-architecture)
3. [Phase 1: Configuration & API Client Separation](#3-phase-1-configuration--api-client-separation)
4. [Phase 2: Backend Service Extraction](#4-phase-2-backend-service-extraction)
5. [Phase 3: Database & Data Layer Isolation](#5-phase-3-database--data-layer-isolation)
6. [Phase 4: Cross-Cutting Concerns](#6-phase-4-cross-cutting-concerns)
7. [Phase 5: Frontend State Refactoring](#7-phase-5-frontend-state-refactoring)
8. [Implementation Roadmap](#8-implementation-roadmap)
9. [Risk Mitigation](#9-risk-mitigation)
10. [Testing Strategy](#10-testing-strategy)

---

## 1. Problem Analysis Summary

### 1.1 Frontend Coupling Points

| Coupling Point | Files Affected | Impact Level | Risk Description |
|----------------|---------------|--------------|------------------|
| Single `api.ts` module | All API calls | **Critical** | 1,095 lines serving all sections; single point of failure |
| Mode-based routing in `page.tsx` | `page.tsx` | **Critical** | Mode state controls flow to 5 different backend endpoints |
| Shared `ApiEnvelope<T>` | `api.ts:31-41` | **Critical** | Universal response envelope; format change breaks all sections |
| Cross-section type imports | `api.ts:192-197` | **High** | Clinical tools types imported in shared API module |
| Oracle → Search fallback | `api.ts:436-440`, `page.tsx:376-380` | **High** | Chat failure cascades to search dependency |
| Radiology → Search dependency | `api.ts:590-620`, `radiology/page.tsx:142` | **High** | Discussion uses `/search?force_ai=true` instead of `/chat` |
| Hard-coded 5-domain logic | `M5Message.tsx`, `DomainPills.tsx`, `useDeepResearch.ts` | **Medium** | Domain-specific logic scattered across components |

### 1.2 Backend Coupling Points

| Coupling Point | Files Affected | Impact Level | Risk Description |
|----------------|---------------|--------------|------------------|
| Shared `Settings` singleton | `services/shared/config.py` | **Critical** | All endpoints share one configuration cache |
| Groq API dependency | `main.py:547-668` | **Critical** | Single LLM provider for all AI endpoints; no fallback |
| MeiliSearch dependency | `main.py:429-451` | **Critical** | Used by 5 endpoints; failure cascades across all RAG features |
| Qdrant dependency | `main.py:453-472` | **Critical** | Vector search shared by chat, research, and M5 |
| Redis global state | `main.py:850-881` | **High** | Shared cache across search and chat; single point of failure |
| Global circuit breaker | `main.py:218-274` | **High** | One service's failures can trip circuit for others |
| Shared rate limiter | `main.py:278` | **Medium** | Global rate limiting affects all decorated endpoints |
| `BaseResponse` envelope | `services/shared/models.py:75-119` | **High** | Universal response format; changes require all-endpoint updates |

### 1.3 Cross-Dependency Matrix

```
                    Oracle    Web    Deep Research    Analysis
                    ───────────────────────────────────────────
Oracle (/chat)        ●       uses      uses            ─
Web (/search)         used by  ●        ─               used by
Deep Research         ─       ─         ●               ─
Analysis (/analyze)   ─       ─         ─                ●

Legend: ● = primary | used by = other sections depend on this
```

---

## 2. Target Architecture

### 2.1 High-Level Design

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND LAYER                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │   Oracle     │  │     Web      │  │Deep Research │  │ Analysis │ │
│  │   Section    │  │   Section    │  │   Section    │  │ Section  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                  │                  │               │     │
│    ┌────▼────┐        ┌────▼────┐        ┌────▼────┐      ┌────▼────┐│
│    │api-oracle│       │api-web  │        │api-deep │      │api-     ││
│    │  .ts   │        │  .ts    │        │ .ts    │      │analysis ││
│    └────┬───┘        └────┬───┘        └────┬───┘      └────┬────┘│
│         │                  │                  │               │     │
└─────────┼──────────────────┼──────────────────┼───────────────┼─────┘
          │                  │                  │               │
          ▼                  ▼                  ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY LAYER                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐│
│  │Oracle Router │  │  Web Router  │  │ Deep Router  │  │ Analysis ││
│  │  (/chat/*)   │  │ (/search/*)  │  │ (/research)  │  │ Router   ││
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘│
└─────────┼──────────────────┼──────────────────┼───────────────┼──────┘
          │                  │                  │               │
          ▼                  ▼                  ▼               ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        SERVICE LAYER (Decoupled)                      │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────┐ │
│  │Oracle Service│  │  Web Service │  │ Deep Service │  │ Analysis │ │
│  │   (chat)     │  │   (search)   │  │  (research)  │  │ Service  │ │
│  │              │  │              │  │              │  │ (image)  │ │
│  │ - Groq LLM   │  │ - SearXNG    │  │ - Perplexica │  │ - Models │ │
│  │ - PubMed     │  │ - MeiliSearch│  │ - Deep LLM   │  │ - Heatmap│ │
│  │ - ClinicalTrials│ - TrustScore│  │              │  │          │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └────┬─────┘ │
│         │                  │                  │               │     │
│         │            ┌─────┴─────┐            │               │     │
│         │            │           │            │               │     │
│         │            ▼           ▼            │               │     │
│         │      ┌─────────┐  ┌─────────┐      │               │     │
│         └─────►│ Shared  │  │ Shared  │◄─────┘               │     │
│                │ Meili   │  │ Qdrant  │◄─────────────────────┘     │
│                │Search   │  │ Vector  │                            │
│                └─────────┘  └─────────┘                            │
│                     │            │                                   │
│                     └────────────┘                                   │
│                          │                                          │
│                          ▼                                          │
│                   ┌─────────────┐                                   │
│                   │ Event Bus   │                                   │
│                   │ (Async)     │                                   │
│                   └─────────────┘                                   │
└─────────────────────────────────────────────────────────────────────┘
```

### 2.2 Key Principles

1. **Interface Segregation:** Each section exposes only the endpoints it needs
2. **Dependency Inversion:** Services depend on abstractions, not concrete implementations
3. **Database per Service:** Each service owns its data; shared data via events
4. **Circuit Breaker per Service:** Failures isolated to the originating service
5. **Configuration per Service:** Environment variables scoped to each service

---

## 3. Phase 1: Configuration & API Client Separation

### 3.1 Frontend: Split api.ts into Section-Specific Modules

**Current State:**
```
frontend-manthana/manthana/src/lib/api.ts (1,095 lines)
```

**Target State:**
```
frontend-manthana/manthana/src/lib/api/
├── core/
│   ├── client.ts          # Shared fetch utilities, auth headers
│   ├── envelope.ts        # ApiEnvelope interface (versioned)
│   └── errors.ts          # ApiError class
├── oracle/
│   ├── client.ts          # Oracle-specific API client
│   ├── types.ts           # Oracle request/response types
│   └── hooks.ts           # Oracle-specific React hooks
├── web/
│   ├── client.ts          # Web search API client
│   ├── types.ts           # Search result types
│   └── hooks.ts           # Search-specific hooks
├── research/
│   ├── client.ts          # Deep research API client
│   ├── types.ts           # Research response types
│   └── hooks.ts           # Research-specific hooks
├── analysis/
│   ├── client.ts          # Image analysis API client
│   ├── types.ts           # Analysis response types
│   └── hooks.ts           # Analysis hooks
└── clinical/
    ├── client.ts          # Clinical tools API client
    └── types.ts           # Drug interaction types
```

**Implementation Steps:**

1. **Create Core Module** (`api/core/`)
   - Extract `fetchWithAuth`, `getAuthHeaders`, `ApiError`
   - Create versioned envelope interface
   - Add request/response interceptors per section

2. **Create Oracle Client** (`api/oracle/client.ts`)
   ```typescript
   const ORACLE_API_URL = process.env.NEXT_PUBLIC_ORACLE_API_URL || API_ORIGIN;
   
   export async function streamChat(
     message: string,
     history: ChatMessage[],
     config: OracleConfig,
     handlers: StreamHandlers,
     signal?: AbortSignal
   ): Promise<void> {
     // Oracle-specific implementation
     // No fallback to search
   }
   
   export async function streamM5(...): Promise<void> {
     // M5-specific implementation
   }
   ```

3. **Create Web Client** (`api/web/client.ts`)
   ```typescript
   const WEB_API_URL = process.env.NEXT_PUBLIC_WEB_API_URL || API_ORIGIN;
   
   export async function searchMedical(
     query: string,
     options: SearchOptions
   ): Promise<SearchResponse> {
     // Web-specific implementation
   }
   
   export async function fetchSearchWithSources(...): Promise<...> {
     // Used only by Web section
   }
   ```

4. **Create Analysis Client** (`api/analysis/client.ts`)
   ```typescript
   const ANALYSIS_API_URL = process.env.NEXT_PUBLIC_ANALYSIS_API_URL || API_ORIGIN;
   
   export async function analyzeImage(
     file: File,
     options: AnalysisOptions
   ): Promise<AnalysisResponse> {
     // Analysis-specific implementation
   }
   
   export async function postDiscussion(
     prompt: string,
     context: AnalysisContext,
     history: ChatMessage[]
   ): Promise<ChatResponse> {
     // NEW: Dedicated discussion endpoint (not search)
   }
   ```

5. **Update Imports**
   - Replace all `import { ... } from '@/lib/api'` with section-specific imports
   - Add ESLint rule to prevent cross-section imports

### 3.2 Backend: Per-Section Configuration

**Current State:**
```python
# services/shared/config.py
class Settings(BaseSettings):
    # All services share these
    MEILISEARCH_URL: str
    QDRANT_URL: str
    GROQ_API_KEY: str
    SEARXNG_URL: str
```

**Target State:**
```python
# services/shared/config/

# Base settings
class BaseSettings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    REQUEST_ID_HEADER: str = "X-Request-ID"

# Oracle service settings
class OracleSettings(BaseSettings):
    ORACLE_GROQ_API_KEY: str
    ORACLE_GROQ_MODEL: str = "llama-3.3-70b-versatile"
    ORACLE_FALLBACK_ENABLED: bool = True
    ORACLE_FALLBACK_MODEL: str = "ollama"
    ORACLE_REDIS_URL: Optional[str] = None
    ORACLE_RATE_LIMIT: str = "100/minute"
    
    # Oracle-specific feature flags
    ORACLE_ENABLE_M5: bool = True
    ORACLE_ENABLE_TRIALS: bool = True
    ORACLE_ENABLE_PUBMED: bool = True

# Web search settings
class WebSettings(BaseSettings):
    WEB_SEARXNG_URL: str
    WEB_SEARXNG_TIMEOUT: float = 8.0
    WEB_MEILISEARCH_URL: Optional[str] = None
    WEB_MEILISEARCH_KEY: Optional[str] = None
    WEB_REDIS_URL: Optional[str] = None
    WEB_CACHE_TTL: int = 300
    WEB_RATE_LIMIT: str = "200/minute"
    
    # Web-specific feature flags
    WEB_ENABLE_IMAGES: bool = True
    WEB_ENABLE_VIDEOS: bool = True
    WEB_ENABLE_LOCAL_INDEX: bool = True

# Deep research settings
class ResearchSettings(BaseSettings):
    RESEARCH_GROQ_API_KEY: str
    RESEARCH_GROQ_MODEL: str = "llama-3.3-70b-versatile"
    RESEARCH_PERPLEXICA_URL: Optional[str] = None
    RESEARCH_QDRANT_URL: Optional[str] = None
    RESEARCH_REDIS_URL: Optional[str] = None
    RESEARCH_RATE_LIMIT: str = "60/minute"
    
    # Research-specific feature flags
    RESEARCH_ENABLE_PLAGIARISM: bool = True
    RESEARCH_ENABLE_ORIGINALITY: bool = True
    RESEARCH_MAX_CITATIONS: int = 25

# Analysis settings
class AnalysisSettings(BaseSettings):
    ANALYSIS_RADIOSERVICE_URL: str = "http://radiology:8101"
    ANALYSIS_ECGSERVICE_URL: str = "http://ecg:8103"
    ANALYSIS_EYESERVICE_URL: str = "http://eye:8104"
    ANALYSIS_CANCERSERVICE_URL: str = "http://cancer:8105"
    ANALYSIS_BRAINSERVICE_URL: str = "http://brain:8107"
    ANALYSIS_TIMEOUT: float = 30.0
    ANALYSIS_RATE_LIMIT: str = "100/minute"
    
    # Analysis-specific feature flags
    ANALYSIS_ENABLE_HEATMAP: bool = True
    ANALYSIS_ENABLE_ENRICHMENT: bool = True
```

**Environment Configuration:**
```bash
# .env per service

# Oracle Service
ORACLE_API_URL=http://oracle:8000
ORACLE_GROQ_API_KEY=gsk_...
ORACLE_REDIS_URL=redis://oracle-redis:6379

# Web Service  
WEB_API_URL=http://web:8001
WEB_SEARXNG_URL=http://searxng:8080
WEB_MEILISEARCH_URL=http://meilisearch:7700
WEB_REDIS_URL=redis://web-redis:6379

# Deep Research Service
RESEARCH_API_URL=http://research:8002
RESEARCH_GROQ_API_KEY=gsk_...
RESEARCH_PERPLEXICA_URL=http://perplexica:3000
RESEARCH_REDIS_URL=redis://research-redis:6379

# Analysis Service
ANALYSIS_API_URL=http://analysis:8003
ANALYSIS_RADIOSERVICE_URL=http://radiology:8101
```

---

## 4. Phase 2: Backend Service Extraction

### 4.1 Service Separation Strategy

Create separate FastAPI applications for each section:

```
services/
├── oracle-service/          # NEW: Oracle chat & M5
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       ├── chat.py
│       ├── m5.py
│       └── health.py
│
├── web-service/             # NEW: Web search
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       ├── search.py
│       ├── autocomplete.py
│       └── health.py
│
├── research-service/        # NEW: Deep research
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       ├── research.py
│       ├── plagiarism.py
│       └── health.py
│
├── analysis-service/        # NEW: Image analysis gateway
│   ├── main.py
│   ├── config.py
│   ├── requirements.txt
│   ├── Dockerfile
│   └── routers/
│       ├── analyze.py
│       ├── discussion.py    # NEW: Dedicated discussion endpoint
│       ├── heatmap.py
│       └── health.py
│
└── ai-router/               # DEPRECATED: Gradually migrate
    └── ... (existing)
```

### 4.2 Oracle Service (`services/oracle-service/`)

**Responsibilities:**
- Chat streaming (`/chat`)
- M5 five-domain mode (`/chat/m5`)
- Query intelligence (classification, routing)
- Domain intelligence
- PubMed integration
- ClinicalTrials.gov integration

**Dependencies:**
- Groq LLM (primary)
- Ollama (fallback)
- MeiliSearch (optional, for context)
- Qdrant (optional, for vector search)
- Redis (caching)

**Key Design:**
```python
# services/oracle-service/main.py
from fastapi import FastAPI
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Oracle-specific resources
    app.state.groq_client = GroqClient(api_key=settings.ORACLE_GROQ_API_KEY)
    app.state.ollama_client = OllamaClient(url=settings.ORACLE_FALLBACK_URL)
    app.state.redis = await init_redis(settings.ORACLE_REDIS_URL)
    yield
    # Cleanup
    await app.state.redis.close()

app = FastAPI(
    title="Manthana Oracle Service",
    lifespan=lifespan
)

# NO search fallback - Oracle handles chat failures internally
# NO dependency on Web service endpoints
```

### 4.3 Web Service (`services/web-service/`)

**Responsibilities:**
- Medical web search (`/search`)
- Autocomplete (`/search/autocomplete`)
- Result enrichment and trust scoring
- Image/video search aggregation
- Related questions generation

**Dependencies:**
- SearXNG (primary search)
- MeiliSearch (local index)
- Redis (caching)

**Key Design:**
```python
# services/web-service/main.py

# NO chat endpoint
# NO LLM dependencies (pure search aggregation)
# NO fallback to other services

@app.get("/search")
async def search(
    q: str,
    category: str = "medical",
    page: int = 1
) -> SearchResponse:
    """Pure search aggregation - no LLM synthesis."""
    results = await aggregate_search_results(q, category, page)
    return SearchResponse(
        results=results,
        relatedQuestions=generate_related_questions(q, results),
        synthesis=None  # Explicitly no AI synthesis
    )
```

### 4.4 Deep Research Service (`services/research-service/`)

**Responsibilities:**
- Structured deep research (`/research`)
- Plagiarism checking (`/plagiarism/check`)
- Originality analysis
- Citation generation

**Dependencies:**
- Groq LLM (dedicated key)
- Perplexica (optional)
- Qdrant (for document similarity)
- Redis (session caching)

**Key Design:**
```python
# services/research-service/main.py

# Isolated from chat/search services
# Own LLM configuration
# Own vector store for plagiarism detection
```

### 4.5 Analysis Service (`services/analysis-service/`)

**Responsibilities:**
- Image analysis routing (`/analyze/auto`)
- Dedicated discussion endpoint (`/analyze/discussion`)
- Heatmap generation
- Report enrichment
- PDF report generation

**Dependencies:**
- Downstream clinical services (radiology, ecg, eye, cancer, brain)
- NO search dependency
- NO chat dependency

**Key Addition: Discussion Endpoint:**
```python
# services/analysis-service/routers/discussion.py

@router.post("/analyze/discussion")
async def analyze_discussion(
    request: DiscussionRequest,
    settings: AnalysisSettings = Depends(get_settings)
) -> ChatResponse:
    """
    Dedicated discussion endpoint for radiology analysis.
    Uses LLM to contextualize findings without depending on Web search.
    """
    # Build prompt from analysis context
    prompt = build_discussion_prompt(
        modality=request.modality,
        findings=request.findings,
        user_question=request.question
    )
    
    # Use lightweight LLM (not full chat service)
    response = await llm_client.complete(prompt)
    
    return ChatResponse(
        response=response,
        sources=[],  # Sources come from original analysis, not search
        model="analysis-discussion-v1"
    )
```

---

## 5. Phase 3: Database & Data Layer Isolation

### 5.1 Database Per Service

**Current State:** Shared schemas, mixed data

**Target State:**
```
Database Layer:
├── oracle-db/          # Chat history, M5 sessions
│   ├── conversations/
│   ├── m5_sessions/
│   └── query_patterns/
│
├── web-db/             # Search cache, click tracking
│   ├── search_cache/
│   ├── result_clicks/
│   └── trending_queries/
│
├── research-db/        # Research projects, plagiarism scans
│   ├── research_sessions/
│   ├── plagiarism_checks/
│   └── citation_graphs/
│
└── analysis-db/        # Image analysis, reports
    ├── analysis_jobs/
    ├── report_templates/
    └── discussion_threads/
```

### 5.2 Redis Isolation

**Current:** Single Redis instance with mixed keys

**Target:** Service-scoped Redis or key prefixes

```python
# Oracle service
redis_key = f"oracle:cache:{query_hash}"

# Web service
redis_key = f"web:cache:{query_hash}"

# Research service
redis_key = f"research:session:{session_id}"
```

### 5.3 Shared Data via Events

For data that must be shared between services:

```python
# services/shared/events/

class EventBus:
    """Async event bus for cross-service communication."""
    
    async def publish(self, event: DomainEvent):
        """Publish event to message queue (Redis Pub/Sub, RabbitMQ, etc.)"""
        
    async def subscribe(self, event_type: str, handler: Callable):
        """Subscribe to events of specific type."""

# Example: User activity events
@dataclass
class UserSearchEvent(DomainEvent):
    user_id: str
    query: str
    domain: str
    timestamp: datetime

@dataclass
class AnalysisCompletedEvent(DomainEvent):
    user_id: str
    analysis_id: str
    modality: str
    findings: List[Finding]
```

---

## 6. Phase 4: Cross-Cutting Concerns

### 6.1 Circuit Breaker Per Service

**Current:** Global circuit breaker

**Target:** Service-specific circuit breakers

```python
# services/oracle-service/circuit.py
from circuitbreaker import circuit

@circuit(failure_threshold=5, recovery_timeout=30)
async def call_groq_oracle(prompt: str) -> str:
    """Oracle-specific circuit breaker."""
    
# services/web-service/circuit.py  
@circuit(failure_threshold=10, recovery_timeout=60)
async def call_searxng(query: str) -> dict:
    """Web-specific circuit breaker."""
```

### 6.2 Rate Limiting Per Service

**Current:** Global rate limiter

**Target:** Service-specific limits

```python
# Oracle service: stricter (LLM costs)
@v1.post("/chat")
@limiter.limit("50/minute")
async def chat(...):

# Web service: more permissive (search is cheaper)
@v1.get("/search")
@limiter.limit("200/minute")
async def search(...):
```

### 6.3 Health Checks Per Service

```python
# Each service exposes its own /health

# Oracle health
@app.get("/health")
async def health():
    return {
        "service": "oracle",
        "status": "healthy",
        "dependencies": {
            "groq": await check_groq(),
            "pubmed": await check_pubmed(),
            "redis": await check_redis()
        }
    }

# Web health
@app.get("/health")
async def health():
    return {
        "service": "web",
        "status": "healthy", 
        "dependencies": {
            "searxng": await check_searxng(),
            "meilisearch": await check_meilisearch()
        }
    }
```

### 6.4 Response Envelope Versioning

**Current:** Single `BaseResponse` for all

**Target:** Versioned envelopes per service

```python
# services/shared/models.py

class OracleResponse(BaseResponse):
    """Oracle-specific response envelope."""
    version: str = "1.0"
    service: str = "oracle"
    
class WebResponse(BaseResponse):
    """Web-specific response envelope."""
    version: str = "1.0"
    service = "web"
    elapsed_ms: int
    engines_used: List[str]
    
class ResearchResponse(BaseResponse):
    """Research-specific response envelope."""
    version: str = "1.0"
    service = "research"
    sections_count: int
    citations_count: int
```

---

## 7. Phase 5: Frontend State Refactoring

### 7.1 Oracle Page State Isolation

**Current:** Single `page.tsx` handles all modes

**Target:** Split into dedicated pages

```
frontend-manthana/manthana/src/app/
├── oracle/
│   ├── page.tsx           # Oracle chat only (mode=auto)
│   ├── layout.tsx         # Oracle-specific layout
│   └── hooks/
│       └── useOracleChat.ts
│
├── m5/
│   └── page.tsx           # M5 mode only
│
├── search/
│   ├── page.tsx           # Web search (standalone)
│   └── layout.tsx
│
├── deep-research/
│   ├── page.tsx           # Already separate
│   └── layout.tsx
│
└── radiology/
    ├── page.tsx           # Analysis (standalone)
    └── layout.tsx
```

### 7.2 Remove Mode Switching from Oracle

**Current:** `mode` state controls behavior

**Target:** Each mode has its own route

```typescript
// Remove from Oracle page:
// - mode state
// - search results state  
// - handleModeChange function
// - mode-based conditional logic

// Oracle page only handles:
// - streamChat
// - streamM5 (or move to /m5)
```

### 7.3 Analysis Discussion Fix

**Current:** Uses `postChat` which calls `/search?force_ai=true`

**Target:** Dedicated analysis discussion endpoint

```typescript
// api/analysis/client.ts

export async function postAnalysisDiscussion(
  question: string,
  analysisContext: {
    modality: string;
    findings: Finding[];
    report: string;
  },
  history: ChatMessage[]
): Promise<DiscussionResponse> {
  const res = await fetchWithAuth(
    `${ANALYSIS_API_URL}/analyze/discussion`,
    {
      method: 'POST',
      body: JSON.stringify({
        question,
        context: analysisContext,
        history
      })
    }
  );
  return res.json();
}
```

---

## 8. Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
- [ ] Create new directory structure for split API clients
- [ ] Extract core utilities to `api/core/`
- [ ] Create section-specific API modules (stubs only)
- [ ] Set up environment variable templates
- [ ] Write migration guide for developers

### Phase 2: Backend Extraction (Week 3-5)
- [ ] Create `oracle-service` FastAPI app
- [ ] Create `web-service` FastAPI app
- [ ] Create `research-service` FastAPI app
- [ ] Create `analysis-service` FastAPI app
- [ ] Implement health checks per service
- [ ] Set up Docker Compose for multi-service dev
- [ ] Configure service-specific Redis instances

### Phase 3: Frontend Migration (Week 4-6)
- [ ] Migrate Oracle page to use `api/oracle/`
- [ ] Migrate Web search to use `api/web/`
- [ ] Migrate Deep Research to use `api/research/`
- [ ] Migrate Analysis to use `api/analysis/`
- [ ] Create `/m5` dedicated page
- [ ] Remove mode-switching from Oracle page
- [ ] Implement analysis discussion endpoint
- [ ] Add ESLint rules to prevent cross-section imports

### Phase 4: Testing & Validation (Week 6-7)
- [ ] Write integration tests per service
- [ ] Test service isolation (fail one, verify others work)
- [ ] Performance testing per service
- [ ] Frontend E2E tests per section
- [ ] Load testing with isolated services

### Phase 5: Production Migration (Week 8)
- [ ] Blue-green deployment setup
- [ ] Database migration (if needed)
- [ ] Redis key migration
- [ ] Traffic routing configuration
- [ ] Rollback procedures
- [ ] Monitoring setup per service

### Phase 6: Cleanup (Week 9)
- [ ] Remove old `api.ts` monolith
- [ ] Deprecate legacy ai-router endpoints
- [ ] Update documentation
- [ ] Archive migration scripts
- [ ] Team training on new architecture

---

## 9. Risk Mitigation

### High-Risk Changes & Mitigation

| Risk | Impact | Mitigation |
|------|--------|------------|
| API client split breaks existing calls | **Critical** | Gradual migration; keep old `api.ts` during transition; comprehensive tests |
| Service extraction introduces latency | **High** | HTTP/2 between services; connection pooling; Redis caching; async where possible |
| Database split causes data loss | **Critical** | Backup before migration; dual-write during transition; verification scripts |
| Circuit breaker change affects availability | **High** | Per-service tuning; gradual rollout; monitoring alerts; runbooks |
| Frontend state refactoring breaks UX | **Medium** | Feature flags; A/B testing; gradual rollout; rollback capability |

### Rollback Strategy

1. **Database:** Maintain dual-write during transition; rollback = stop writes to new DB
2. **Services:** Keep ai-router running; nginx route toggle can instantly revert
3. **Frontend:** Feature flags; `NEXT_PUBLIC_USE_NEW_API` env var controls which client to use

### Monitoring During Migration

- Error rates per service (should not increase)
- Latency per service (track p50, p95, p99)
- Cross-service call counts (should decrease over time)
- Circuit breaker state per service
- Redis hit rates per service

---

## 10. Testing Strategy

### Unit Tests

```python
# Per service unit tests
services/oracle-service/tests/
├── test_chat.py
├── test_m5.py
└── test_circuit_breaker.py

services/web-service/tests/
├── test_search.py
├── test_enrichment.py
└── test_cache.py
```

### Integration Tests

```python
# Test service boundaries
def test_oracle_does_not_depend_on_web():
    """Verify Oracle service works when Web service is down."""
    with web_service_stopped():
        response = oracle_client.chat("Hello")
        assert response.status == "success"

def test_analysis_does_not_depend_on_search():
    """Verify Analysis discussion works without search."""
    with search_service_stopped():
        response = analysis_client.discuss("What does this mean?", context)
        assert response.status == "success"
```

### Contract Tests

```python
# Verify API contracts between frontend and backend
@pytest.mark.contract
def test_oracle_api_contract():
    """Verify Oracle API responses match frontend expectations."""
    spec = load_contract('oracle-api-v1.yaml')
    response = call_oracle_chat()
    validate_response(response, spec)
```

### Load Tests

```bash
# Per service load testing
k6 run oracle-load-test.js    # 50 RPS chat load
k6 run web-load-test.js         # 200 RPS search load
k6 run research-load-test.js    # 10 RPS deep research load
```

---

## Appendix A: Migration Checklist

### Pre-Migration
- [ ] All tests passing in current monolith
- [ ] Database backups created
- [ ] Monitoring dashboards ready
- [ ] Rollback procedures documented
- [ ] Team trained on new architecture

### During Migration
- [ ] Phase 1 complete: API client structure ready
- [ ] Phase 2 complete: Backend services deployed
- [ ] Phase 3 complete: Frontend migrated
- [ ] Phase 4 complete: Tests passing
- [ ] Smoke tests pass in staging
- [ ] Load tests pass at target RPS

### Post-Migration
- [ ] Error rates normal
- [ ] Latency within SLA
- [ ] No cross-service dependencies in code
- [ ] Documentation updated
- [ ] Team comfortable with new architecture
- [ ] Old code archived (not deleted)

---

## Appendix B: Service Configuration Templates

### Docker Compose (Development)

```yaml
# docker-compose.separated.yml
version: '3.8'

services:
  # Oracle Service
  oracle:
    build: ./services/oracle-service
    ports:
      - "8000:8000"
    environment:
      - ORACLE_GROQ_API_KEY=${ORACLE_GROQ_API_KEY}
      - ORACLE_REDIS_URL=redis://oracle-redis:6379
    depends_on:
      - oracle-redis
      
  oracle-redis:
    image: redis:7-alpine
    
  # Web Service
  web:
    build: ./services/web-service
    ports:
      - "8001:8000"
    environment:
      - WEB_SEARXNG_URL=http://searxng:8080
      - WEB_REDIS_URL=redis://web-redis:6379
    depends_on:
      - web-redis
      - searxng
      
  web-redis:
    image: redis:7-alpine
    
  # Research Service
  research:
    build: ./services/research-service
    ports:
      - "8002:8000"
    environment:
      - RESEARCH_GROQ_API_KEY=${RESEARCH_GROQ_API_KEY}
      - RESEARCH_PERPLEXICA_URL=http://perplexica:3000
    depends_on:
      - perplexica
      
  # Analysis Service
  analysis:
    build: ./services/analysis-service
    ports:
      - "8003:8000"
    environment:
      - ANALYSIS_RADIOSERVICE_URL=http://radiology:8101
      - ANALYSIS_ECGSERVICE_URL=http://ecg:8103
    depends_on:
      - radiology
      - ecg
```

### Kubernetes (Production)

```yaml
# oracle-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: oracle-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: oracle
  template:
    metadata:
      labels:
        app: oracle
    spec:
      containers:
      - name: oracle
        image: manthana/oracle-service:latest
        env:
        - name: ORACLE_GROQ_API_KEY
          valueFrom:
            secretKeyRef:
              name: oracle-secrets
              key: groq-api-key
        resources:
          requests:
            memory: "512Mi"
            cpu: "500m"
          limits:
            memory: "1Gi"
            cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: oracle-service
spec:
  selector:
    app: oracle
  ports:
  - port: 8000
    targetPort: 8000
```

---

## Appendix C: Frontend Environment Templates

```bash
# .env.local for development

# Core
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Oracle Section
NEXT_PUBLIC_ORACLE_API_URL=http://localhost:8000
NEXT_PUBLIC_ORACLE_WS_URL=ws://localhost:8000

# Web Section
NEXT_PUBLIC_WEB_API_URL=http://localhost:8001

# Deep Research Section
NEXT_PUBLIC_RESEARCH_API_URL=http://localhost:8002

# Analysis Section
NEXT_PUBLIC_ANALYSIS_API_URL=http://localhost:8003

# Feature Flags (for gradual migration)
NEXT_PUBLIC_USE_SEPARATED_APIS=true
NEXT_PUBLIC_ENABLE_M5_PAGE=true
NEXT_PUBLIC_ENABLE_ANALYSIS_DISCUSSION=true
```

---

## Conclusion

This fix plan transforms Manthana from a tightly-coupled monolith into a properly separated, micro-frontend/micro-backend architecture. Each section (Oracle, Web, Deep Research, Analysis) will have:

1. **Isolated backend service** with dedicated resources
2. **Dedicated API client** in the frontend
3. **Independent configuration** and feature flags
4. **Service-specific circuit breakers** and rate limits
5. **Clean interfaces** with no cross-service dependencies

The migration is phased to minimize risk, with comprehensive testing at each stage. Rollback procedures are defined for every phase.

**Estimated Timeline:** 8-9 weeks  
**Risk Level:** High (requires careful coordination)  
**Expected Benefits:**
- Independent scaling per section
- Technology flexibility per service
- Improved fault isolation
- Faster development cycles
- Clearer team ownership

---

**Document Owner:** Architecture Team  
**Reviewers:** Backend Lead, Frontend Lead, DevOps Lead  
**Next Review Date:** [2 weeks from creation]
