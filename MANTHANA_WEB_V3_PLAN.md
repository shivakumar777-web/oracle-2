# MANTHANA WEB v3 — Complete Fix & Upgrade Plan

> **Goal:** Make every filter tab return real, paginated results for any query.
> Beat Google in medical search UX by exploiting our vertical focus, dedicated APIs,
> and trust-scored result pipeline. Minimal AI (knowledge panel only). Everything else
> is pure search with the best available sources.

---

## Table of Contents

1. [Architecture Diagnosis](#1-architecture-diagnosis)
2. [Architecture Shift: Per-Tab Backend Pipelines](#2-architecture-shift-per-tab-backend-pipelines)
3. [Phase 1 — Fix `enrich_result` & Type Preservation](#3-phase-1--fix-enrich_result--type-preservation)
4. [Phase 2 — Dedicated Backend Endpoints per Tab](#4-phase-2--dedicated-backend-endpoints-per-tab)
5. [Phase 3 — SearXNG Category Routing](#5-phase-3--searxng-category-routing)
6. [Phase 4 — Frontend: Per-Tab Fetching & Pagination](#6-phase-4--frontend-per-tab-fetching--pagination)
7. [Phase 5 — Research Papers Pipeline (PubMed + Semantic Scholar)](#7-phase-5--research-papers-pipeline-pubmed--semantic-scholar)
8. [Phase 6 — Clinical Guidelines Pipeline (NICE, WHO, CDC)](#8-phase-6--clinical-guidelines-pipeline-nice-who-cdc)
9. [Phase 7 — Images Pipeline (SearXNG images + Google Images)](#9-phase-7--images-pipeline-searxng-images--google-images)
10. [Phase 8 — Videos Pipeline (YouTube Data API + SearXNG)](#10-phase-8--videos-pipeline-youtube-data-api--searxng)
11. [Phase 9 — PDFs Pipeline (PubMed Central + Open Access)](#11-phase-9--pdfs-pipeline-pubmed-central--open-access)
12. [Phase 10 — Trials Pipeline Enhancement](#12-phase-10--trials-pipeline-enhancement)
13. [Phase 11 — Articles/All Blended Results](#13-phase-11--articlesall-blended-results)
14. [Phase 12 — Knowledge Panel v2 (Smart AI, Minimal)](#14-phase-12--knowledge-panel-v2-smart-ai-minimal)
15. [Phase 13 — UX: Google-Beating Features](#15-phase-13--ux-google-beating-features)
16. [Phase 14 — Caching Strategy](#16-phase-14--caching-strategy)
17. [Phase 15 — Performance & Resilience](#17-phase-15--performance--resilience)
18. [Implementation Priority & Timeline](#18-implementation-priority--timeline)
19. [File Manifest](#19-file-manifest)

---

## 1. Architecture Diagnosis

### Current Architecture (v2) — Why It Fails

```
User clicks tab → Frontend filters searchData.results client-side → Empty for most tabs
```

**Fatal flaw:** One backend call returns ~20 results. The frontend then filters that
fixed set locally. If zero results match "guideline" or "isPeerReviewed", the tab
shows nothing. There is no way to paginate within a tab because the backend doesn't
know which tab the user is on.

### Specific Bugs

| Issue | Location | Root Cause |
|-------|----------|------------|
| `enrich_result` overwrites `type` | `search.py:119-127` | Always re-derives type from heuristics; ignores `result.get("type")` from upstream clients |
| Research Papers always empty | `search.py:66-81` | `isPeerReviewed` only true for 14 hardcoded domains; 99% of results come from general web |
| Guidelines always empty | `search.py:126-127` | Only detected if content contains "guideline" literally; upstream `type: "guideline"` overwritten |
| Images/Videos empty | `search.py:421-438` | Depends on SearXNG returning them in the `general` category response — SearXNG often doesn't |
| PDFs always empty | `search.py:120-121` | Only detected if URL contains "pdf" — most PDFs don't have that in their link text |
| No per-tab pagination | `page.tsx:168-193` | Single `runSearch()` call; page number applies to blended results only |
| Trials only page 1 | `search.py:356` | `fetch_clinical_trials` called only when `page == 1` |
| SearXNG category mismatch | `search.py:337` | Always uses the domain-category (e.g., "medical") regardless of which filter tab is active |

---

## 2. Architecture Shift: Per-Tab Backend Pipelines

### New Architecture (v3)

```
User clicks "Research Papers" tab
  → Frontend calls GET /v1/search/papers?q=...&page=1
    → Backend: PubMed API + Semantic Scholar + SearXNG(category=science) + CrossRef
    → Returns 20 results, page 1 of N
    → Own pagination, own caching, own enrichment

User clicks "Images" tab
  → Frontend calls GET /v1/search/images?q=...&page=1
    → Backend: SearXNG(category=images) dedicated call
    → Returns 30 images, page 1 of N
    → Own pagination
```

**Key principle:** Each tab has its own backend endpoint that queries the right
sources for that content type, with its own pagination. The "All" tab aggregates
a sample from each pipeline.

### New Endpoint Map

| Tab | Endpoint | Primary Sources | Pagination |
|-----|----------|----------------|------------|
| All | `GET /v1/search` | SearXNG general + top 3 from each specialized source | Yes (20/page) |
| Research Papers | `GET /v1/search/papers` | PubMed E-Utilities + Semantic Scholar + Google Scholar via SearXNG | Yes (20/page) |
| Clinical Guidelines | `GET /v1/search/guidelines` | SearXNG `site:who.int OR site:nice.org.uk OR ...` + MeiliSearch guidelines index | Yes (20/page) |
| Trials | `GET /v1/search/trials` | ClinicalTrials.gov API + CTRI (India) + SearXNG `site:clinicaltrials.gov` | Yes (20/page) |
| Images | `GET /v1/search/images` | SearXNG `category=images` (dedicated) | Yes (30/page) |
| Videos | `GET /v1/search/videos` | SearXNG `category=videos` (dedicated, forces YouTube/Vimeo) | Yes (20/page) |
| PDFs | `GET /v1/search/pdfs` | SearXNG `filetype:pdf` + PubMed Central OA + Europe PMC | Yes (20/page) |
| Articles | `GET /v1/search/articles` | SearXNG general (non-academic web) | Yes (20/page) |

---

## 3. Phase 1 — Fix `enrich_result` & Type Preservation

**Priority:** CRITICAL — fixes the immediate bug without architectural changes.

### 3.1 Preserve Upstream `type`

```python
# services/web-service/routers/search.py — enrich_result()

def enrich_result(result: Dict[str, Any], category: str = "medical") -> Dict[str, Any]:
    url = result.get("url", "")
    trust_score = get_trust_score(url)
    is_peer = is_peer_reviewed(url)

    # PRESERVE upstream type if already set by a dedicated client
    # (ClinicalTrials.gov sets "trial", guidelines client sets "guideline")
    existing_type = result.get("type", "")
    if existing_type in ("trial", "guideline", "pdf", "video"):
        result_type = existing_type
    else:
        # Heuristic detection for SearXNG/MeiliSearch results
        title = (result.get("title") or "").lower()
        content = (result.get("content", "") or result.get("snippet", "")).lower()
        url_lower = url.lower()
        source = (result.get("source") or "").lower()

        result_type = "article"
        if ".pdf" in url_lower or url_lower.endswith(".pdf") or "filetype=pdf" in url_lower:
            result_type = "pdf"
        elif any(d in url_lower for d in ["youtube.com", "vimeo.com", "dailymotion.com"]):
            result_type = "video"
        elif "clinicaltrials.gov" in url_lower or "ctri.nic.in" in url_lower:
            result_type = "trial"
        elif any(x in title for x in ["clinical trial", "nct0", "nct1", "nct2", "nct3", "nct4", "nct5"]):
            result_type = "trial"
        elif source in ("clinicaltrials.gov",):
            result_type = "trial"
        elif any(d in url_lower for d in ["who.int/publications", "nice.org.uk/guidance", "guidelines.gov"]):
            result_type = "guideline"
        elif any(x in content for x in ["guideline", "protocol", "clinical recommendation"]):
            result_type = "guideline"

    # Broader isPeerReviewed: also check SearXNG engine field
    engine = (result.get("engine") or "").lower()
    if not is_peer:
        is_peer = engine in ("pubmed", "semantic scholar", "google scholar")
        if not is_peer:
            is_peer = any(d in url.lower() for d in [
                "pubmed", "ncbi.nlm", "doi.org", "europepmc.org",
                "cochrane", "nejm.org", "thelancet", "jamanetwork",
                "bmj.com", "nature.com", "sciencedirect", "springer",
                "wiley.com", "academic.oup", "plos.org", "frontiersin.org",
                "mdpi.com", "hindawi.com", "biomedcentral.com"
            ])

    return {
        "title": result.get("title", ""),
        "url": url,
        "snippet": result.get("content", result.get("snippet", ""))[:300],
        "source": result.get("source", "Web"),
        "domain": result.get("source", ""),
        "engine": result.get("engine", "SearXNG"),
        "publishedDate": result.get("publishedDate"),
        "trustScore": trust_score,
        "isPeerReviewed": is_peer,
        "isOfficial": trust_score >= 80,
        "isOpenAccess": True,
        "thumbnail": result.get("img_src"),
        "type": result_type,
    }
```

### 3.2 Expand PEER_REVIEWED_DOMAINS

```python
PEER_REVIEWED_DOMAINS = {
    # Existing
    "pubmed.ncbi.nlm.nih.gov", "ncbi.nlm.nih.gov", "who.int", "cdc.gov",
    "nejm.org", "thelancet.com", "jamanetwork.com", "bmj.com",
    "nature.com", "sciencedirect.com", "springer.com", "wiley.com",
    "academic.oup.com", "cochrane.org",
    # New additions
    "europepmc.org", "plos.org", "journals.plos.org",
    "frontiersin.org", "mdpi.com", "hindawi.com", "biomedcentral.com",
    "doi.org", "pmc.ncbi.nlm.nih.gov",
    "annals.org", "cell.com", "aafp.org",
    "ahajournals.org", "diabetesjournals.org",
    "ema.europa.eu", "fda.gov",
    # Ayurveda peer-reviewed
    "ijapr.in", "ayurvedjournal.com", "jaims.in",
    "ancientscienceoflife.org", "ijrap.net",
    # Indian medical
    "ijmr.org.in", "japi.org", "indianjmedsci.org",
}
```

### Files Modified
- `services/web-service/routers/search.py`

---

## 4. Phase 2 — Dedicated Backend Endpoints per Tab

### 4.1 New Endpoint: `/v1/search/papers`

```python
# services/web-service/routers/papers.py (NEW FILE)

@router.get("/search/papers")
async def search_papers(
    request: Request,
    q: str = Query(...),
    page: int = Query(default=1, ge=1),
    lang: str = Query(default="en"),
    sort: str = Query(default="relevance", description="relevance|date|citations"),
    settings: WebSettings = Depends(get_web_settings),
):
    """Search peer-reviewed research papers across PubMed, Semantic Scholar, Google Scholar."""
    # Fan out to 3 sources in parallel:
    # 1. PubMed E-Utilities (page=page, retmax=10)
    # 2. Semantic Scholar Academic Graph API (offset=(page-1)*10, limit=10)
    # 3. SearXNG with category=science (pageno=page)
    # Merge, deduplicate by DOI/URL, sort by trust score or date
    # Return { results: [...], total, page, totalPages, hasNextPage }
```

### 4.2 New Endpoint: `/v1/search/guidelines`

```python
# services/web-service/routers/guidelines_search.py (NEW FILE)

@router.get("/search/guidelines")
async def search_guidelines(
    request: Request,
    q: str = Query(...),
    page: int = Query(default=1, ge=1),
    org: str = Query(default=None, description="Filter: who|nice|cdc|aha|all"),
    settings: WebSettings = Depends(get_web_settings),
):
    """Search clinical guidelines from WHO, NICE, CDC, AHA, ICMR, etc."""
    # Fan out:
    # 1. SearXNG with query: "{q} site:who.int/publications OR site:nice.org.uk/guidance OR ..."
    # 2. MeiliSearch guidelines index (if populated)
    # 3. SearXNG with query: "{q} clinical guideline recommendation"
    # Merge, deduplicate, enrich with type="guideline"
```

### 4.3 New Endpoint: `/v1/search/trials` (Enhanced)

```python
# services/web-service/routers/trials.py (NEW FILE)

@router.get("/search/trials")
async def search_trials(
    request: Request,
    q: str = Query(...),
    page: int = Query(default=1, ge=1),
    status: str = Query(default=None, description="RECRUITING|COMPLETED|ALL"),
    phase: str = Query(default=None, description="PHASE1|PHASE2|PHASE3|PHASE4"),
    settings: WebSettings = Depends(get_web_settings),
):
    """Search clinical trials with pagination and status/phase filters."""
    # ClinicalTrials.gov API with pageToken for pagination
    # CTRI (India) for Indian trials
    # Return standardized trial cards with phase, status, enrollment, locations
```

### 4.4 New Endpoint: `/v1/search/pdfs`

```python
# services/web-service/routers/pdfs.py (NEW FILE)

@router.get("/search/pdfs")
async def search_pdfs(
    request: Request,
    q: str = Query(...),
    page: int = Query(default=1, ge=1),
    settings: WebSettings = Depends(get_web_settings),
):
    """Search for PDF documents — research papers, guidelines, drug labels."""
    # Fan out:
    # 1. SearXNG with query: "{q} filetype:pdf" (category=general)
    # 2. PubMed Central OA subset (returns PDFs)
    # 3. Europe PMC full-text PDFs
    # All results forced to type="pdf"
```

### 4.5 Enhanced: `/v1/search/images`

Already exists. Enhancements:
- Add `page` support (currently ignored by SearXNG)
- Add medical image filtering (anatomy, pathology, radiology)
- Return `totalEstimate` for pagination UI

### 4.6 Enhanced: `/v1/search/videos`

Already exists. Enhancements:
- Switch from SearXNG `category=science` to `category=videos`
- Add YouTube Data API v3 as secondary source (search medical channels)
- Support pagination via `pageToken` (YouTube) or `pageno` (SearXNG)

### Files Created
- `services/web-service/routers/papers.py`
- `services/web-service/routers/guidelines_search.py`
- `services/web-service/routers/trials.py`
- `services/web-service/routers/pdfs.py`

### Files Modified
- `services/web-service/routers/search.py` (images & videos enhanced)
- `services/web-service/main.py` (register new routers)

---

## 5. Phase 3 — SearXNG Category Routing

### Current Problem

```python
# search.py line 337 — always sends the domain category ("medical", "ayurveda", etc.)
searxng_task = fetch_searxng(q, category, "json", page, ...)
```

SearXNG categories like `images` and `videos` are never used from the main search
endpoint. When the frontend requests images, it needs to hit the dedicated
`/search/images` endpoint which uses `category=images`.

### Fix

The `/v1/search` (All tab) endpoint should fan out to SearXNG with multiple
categories in parallel:

```python
# For the "All" tab, fetch general + images + videos in parallel
general_task = fetch_searxng(q, category, "json", page, ...)
images_task  = fetch_searxng(q, "images", "json", 1, ...)  # just page 1 preview
videos_task  = fetch_searxng(q + " medical", "videos", "json", 1, ...)  # just page 1 preview
```

This ensures the "All" tab always has preview images and videos, while dedicated
tabs get their own paginated requests.

### SearXNG Settings Enhancement

```yaml
# configs/searxng/settings.yml — add video engines
engines:
  # Existing engines...

  # Add YouTube explicitly for video search
  - name: youtube
    engine: youtube_noapi
    disabled: false
    weight: 2
    categories: videos

  # Add Piped as YouTube alternative
  - name: piped
    engine: piped
    disabled: false
    categories: videos

  # Ensure Google Images is enabled
  - name: google images
    engine: google_images
    disabled: false
    categories: images

  - name: bing images
    engine: bing_images
    disabled: false
    categories: images
```

### Files Modified
- `configs/searxng/settings.yml`
- `services/web-service/routers/search.py`

---

## 6. Phase 4 — Frontend: Per-Tab Fetching & Pagination

### Core Change: Each Tab Fetches Its Own Data

Replace client-side filtering with per-tab API calls. Each tab maintains its own
state: results, page number, loading status.

### 6.1 New API Client Functions

```typescript
// lib/api/web/client.ts — add per-tab search functions

export async function searchPapers(
  query: string,
  options?: { page?: number; sort?: string }
): Promise<SearchResponse> { ... }

export async function searchGuidelines(
  query: string,
  options?: { page?: number; org?: string }
): Promise<SearchResponse> { ... }

export async function searchTrials(
  query: string,
  options?: { page?: number; status?: string; phase?: string }
): Promise<TrialsResponse> { ... }

export async function searchPdfs(
  query: string,
  options?: { page?: number }
): Promise<SearchResponse> { ... }

// searchImages and searchVideos already exist — add pagination
```

### 6.2 Search Page State Redesign

```typescript
// Current (v2): One searchData, filter client-side
const [searchData, setSearchData] = useState<SearchResponse | null>(null);
const filteredResults = searchData?.results.filter(tabConfig.filter);

// New (v3): Per-tab state with lazy loading
interface TabState {
  data: SearchResponse | null;
  page: number;
  isLoading: boolean;
  hasLoaded: boolean;
}

const [tabStates, setTabStates] = useState<Record<string, TabState>>({});
```

### 6.3 Tab Click Behavior

```
1. User types query, presses Enter
   → Fetch "all" tab data (GET /v1/search?q=...)
   → Also fetch preview counts for other tabs:
     Backend returns: { paperCount: N, guidelineCount: N, trialCount: N, ... }

2. User clicks "Research Papers" tab
   → If not loaded yet: fetch GET /v1/search/papers?q=...&page=1
   → Show loading skeleton while fetching
   → Display results with own pagination

3. User clicks "Next Page" on Research Papers tab
   → Fetch GET /v1/search/papers?q=...&page=2
   → Only this tab's data changes
```

### 6.4 FILTER_TABS Redesign

```typescript
const FILTER_TABS = [
  {
    id: "all",
    label: "All",
    fetchFn: searchMedical,          // existing function
    showPagination: true,
  },
  {
    id: "papers",
    label: "Research Papers",
    fetchFn: searchPapers,           // new
    icon: "📄",
    showPagination: true,
  },
  {
    id: "guidelines",
    label: "Clinical Guidelines",
    fetchFn: searchGuidelines,       // new
    icon: "📋",
    showPagination: true,
  },
  {
    id: "trials",
    label: "Trials",
    fetchFn: searchTrials,           // new, enhanced
    icon: "🧪",
    showPagination: true,
  },
  {
    id: "images",
    label: "Images",
    fetchFn: searchImages,           // existing, enhanced
    showPagination: true,
  },
  {
    id: "videos",
    label: "Videos",
    fetchFn: searchVideos,           // existing, enhanced
    showPagination: true,
  },
  {
    id: "pdfs",
    label: "PDFs",
    fetchFn: searchPdfs,             // new
    icon: "📑",
    showPagination: true,
  },
  {
    id: "articles",
    label: "Articles",
    fetchFn: searchArticles,         // reuses searchMedical with result_type=article
    showPagination: true,
  },
];
```

### 6.5 Pagination per Tab

Each tab gets its own Previous/Next controls. Page state is scoped to the tab.
URL becomes: `/search?q=diabetes&tab=papers&page=3`

### Files Modified
- `frontend-manthana/manthana/src/app/search/page.tsx` (major rewrite)
- `frontend-manthana/manthana/src/lib/api/web/client.ts` (new functions)
- `frontend-manthana/manthana/src/lib/api/web/types.ts` (new response types)
- `frontend-manthana/manthana/src/lib/api/web/index.ts` (re-exports)
- `frontend-manthana/manthana/src/lib/api/index.ts` (re-exports)

---

## 7. Phase 5 — Research Papers Pipeline (PubMed + Semantic Scholar)

### 7.1 PubMed E-Utilities Client

Free, no API key required. Rate limit: 3 req/sec (or 10/sec with API key).

```python
# services/web-service/clients/pubmed.py (NEW FILE)

ESEARCH_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
ESUMMARY_URL = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"

async def search_pubmed(query: str, page: int = 1, per_page: int = 10) -> dict:
    """
    1. ESearch: get PMIDs for query (retstart = (page-1)*per_page)
    2. ESummary: get title, authors, journal, date, DOI for each PMID
    3. Return standardized results with:
       - url: https://pubmed.ncbi.nlm.nih.gov/{pmid}/
       - type: "article"
       - isPeerReviewed: True
       - source: "PubMed"
       - journal, authors, doi (extra fields)
    """
```

### 7.2 Semantic Scholar Client

Free API, 100 req/sec for unauthenticated.

```python
# services/web-service/clients/semantic_scholar.py (NEW FILE)

SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1/paper/search"

async def search_semantic_scholar(query: str, page: int = 1, per_page: int = 10) -> dict:
    """
    Search Semantic Scholar Academic Graph API.
    Returns papers with:
      - title, abstract, authors, year, citationCount, url
      - openAccessPdf (direct PDF link when available)
      - type: "article", isPeerReviewed: True
    Pagination via offset parameter.
    """
```

### 7.3 Papers Router Merging Strategy

```
PubMed (10)  +  Semantic Scholar (10)  +  SearXNG science (10)
            ↓
    Deduplicate by DOI or URL
            ↓
    Sort by: relevance (default) | date | citations
            ↓
    Return top 20, with total estimate for pagination
```

### Files Created
- `services/web-service/clients/pubmed.py`
- `services/web-service/clients/semantic_scholar.py`
- `services/web-service/routers/papers.py`

---

## 8. Phase 6 — Clinical Guidelines Pipeline (NICE, WHO, CDC)

### 8.1 Guideline Sources

| Source | Method | URL Pattern |
|--------|--------|-------------|
| WHO | SearXNG site-search | `site:who.int/publications {query}` |
| NICE (UK) | SearXNG site-search | `site:nice.org.uk/guidance {query}` |
| CDC | SearXNG site-search | `site:cdc.gov/guidelines {query}` |
| AHA | SearXNG site-search | `site:heart.org/guidelines {query}` |
| ADA | SearXNG site-search | `site:diabetes.org/guidelines {query}` |
| ICMR (India) | SearXNG site-search | `site:icmr.gov.in {query}` |
| AYUSH | SearXNG site-search | `site:ayush.gov.in {query} guideline` |
| MeiliSearch | Direct API | Local guidelines index (if populated) |

### 8.2 Guidelines Search Strategy

```python
# services/web-service/routers/guidelines_search.py

GUIDELINE_SITES = [
    "who.int", "nice.org.uk", "cdc.gov", "heart.org",
    "diabetes.org", "icmr.gov.in", "sign.ac.uk",
    "guidelinecentral.com", "guidelines.gov",
]

async def search_guidelines(q, page, settings):
    # Strategy 1: Compound SearXNG query with site: operators
    site_query = f"{q} ({' OR '.join(f'site:{s}' for s in GUIDELINE_SITES)})"

    # Strategy 2: SearXNG with "clinical guideline" appended
    guideline_query = f"{q} clinical guideline recommendation protocol"

    # Strategy 3: MeiliSearch guidelines index
    # Fan out all three, merge, deduplicate
    # Force all results to type="guideline"
```

### Files Created
- `services/web-service/routers/guidelines_search.py`

### Files Modified
- `services/web-service/clients/guidelines.py` (improve MeiliSearch client)

---

## 9. Phase 7 — Images Pipeline (SearXNG images + Google Images)

### 9.1 Current Problem

The `/search/images` endpoint uses `category=images` on SearXNG but the SearXNG
config doesn't have Google Images or Bing Images enabled.

### 9.2 Fix

1. Enable `google_images` and `bing_images` engines in SearXNG config
2. Append "medical" to the query for better medical image results
3. Add SafeSearch=0 (already set) for educational medical images
4. Parse `img_src` correctly — SearXNG returns different fields per engine

### 9.3 Enhanced Image Response

```typescript
interface ImageResult {
  url: string;         // full-size image URL
  title: string;
  source: string;      // website name
  sourceUrl: string;   // webpage URL (not image URL)
  thumbnail: string;   // thumbnail URL
  width?: number;
  height?: number;
  engine: string;      // which search engine found it
}
```

### 9.4 Pagination

SearXNG images support `pageno` parameter. Pass through from frontend.

### Files Modified
- `configs/searxng/settings.yml` (enable image engines)
- `services/web-service/routers/search.py` (`search_images` endpoint)
- `frontend-manthana/manthana/src/lib/api/web/types.ts`

---

## 10. Phase 8 — Videos Pipeline (YouTube Data API + SearXNG)

### 10.1 Current Problem

The `/search/videos` endpoint uses `category=science` which rarely returns videos.
SearXNG has no video engines enabled.

### 10.2 Fix

**Option A (No API Key):** Use SearXNG `youtube_noapi` + `piped` engines:

```yaml
# configs/searxng/settings.yml
engines:
  - name: youtube
    engine: youtube_noapi
    disabled: false
    weight: 3
    categories: videos

  - name: piped
    engine: piped
    disabled: false
    weight: 2
    categories: videos

  - name: invidious
    engine: invidious
    disabled: false
    weight: 1
    categories: videos
```

Then the backend calls SearXNG with `category=videos`.

**Option B (With API Key):** YouTube Data API v3 as supplementary source:

```python
# services/web-service/clients/youtube.py (NEW FILE, OPTIONAL)

YOUTUBE_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"

async def search_youtube(query: str, page_token: str = None, api_key: str = None):
    """
    Search YouTube for medical videos.
    Filters for channels: medical lectures, patient education, CME.
    """
```

### 10.3 Video Card Enhancement

```typescript
interface VideoResult {
  url: string;
  title: string;
  thumbnail: string;
  source: string;        // "YouTube", "Vimeo", etc.
  publishedDate: string;
  duration?: string;     // "12:34"
  channel?: string;      // channel name
  views?: number;
}
```

### Files Modified
- `configs/searxng/settings.yml`
- `services/web-service/routers/search.py` (`search_videos`)

### Files Created (Optional)
- `services/web-service/clients/youtube.py`

---

## 11. Phase 9 — PDFs Pipeline (PubMed Central + Open Access)

### 11.1 PDF Search Strategy

```python
# services/web-service/routers/pdfs.py

async def search_pdfs(q, page, settings):
    # Source 1: SearXNG with filetype:pdf
    searxng_task = fetch_searxng(f"{q} filetype:pdf", "general", "json", page, ...)

    # Source 2: PubMed Central Open Access (free PDFs)
    pmc_task = fetch_pmc_pdfs(q, page=page, limit=10)

    # Source 3: Europe PMC full-text search
    epmc_task = fetch_europe_pmc(q, page=page, limit=10)

    # All results get type="pdf", and a pdfUrl field when available
```

### 11.2 PubMed Central Client

```python
# services/web-service/clients/pmc.py (NEW FILE)

PMC_SEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
PMC_FETCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi"

async def fetch_pmc_pdfs(query: str, page: int = 1, limit: int = 10):
    """
    Search PubMed Central for open-access full-text articles.
    Returns PDF URLs: https://www.ncbi.nlm.nih.gov/pmc/articles/PMC{id}/pdf/
    """
```

### 11.3 Europe PMC Client

```python
# services/web-service/clients/europe_pmc.py (NEW FILE)

EPMC_SEARCH = "https://www.ebi.ac.uk/europepmc/webservices/rest/search"

async def fetch_europe_pmc(query: str, page: int = 1, limit: int = 10):
    """
    Europe PMC REST API.
    Filter: HAS_PDF:Y for results with available PDFs.
    """
```

### Files Created
- `services/web-service/clients/pmc.py`
- `services/web-service/clients/europe_pmc.py`
- `services/web-service/routers/pdfs.py`

---

## 12. Phase 10 — Trials Pipeline Enhancement

### 12.1 Current State

ClinicalTrials.gov is already integrated but only on page 1 and limited to 5 results.

### 12.2 Enhancements

```python
# services/web-service/routers/trials.py

async def search_trials(q, page, status, phase, settings):
    per_page = 20

    # ClinicalTrials.gov v2 API with pagination
    ct_task = fetch_clinical_trials_paginated(
        q,
        page=page,
        per_page=per_page,
        status=status,   # RECRUITING, COMPLETED, etc.
        phase=phase,      # PHASE1, PHASE2, etc.
    )

    # CTRI (India) for Indian clinical trials
    ctri_task = fetch_ctri(q, page=page) if settings.WEB_ENABLE_CTRI else None

    # Merge and return with trial-specific fields
```

### 12.3 Trial Card Data

```typescript
interface TrialResult {
  nctId: string;
  title: string;
  url: string;
  phase: string;           // "Phase 1", "Phase 2/3", etc.
  status: string;          // "RECRUITING", "COMPLETED"
  enrollment: number;
  conditions: string[];
  interventions: string[];
  sponsor: string;
  startDate: string;
  completionDate: string;
  locations: { facility: string; city: string; state: string; country: string }[];
}
```

### Files Modified
- `services/web-service/clients/clinical_trials.py` (add pagination, filters)

### Files Created
- `services/web-service/routers/trials.py`

---

## 13. Phase 11 — Articles/All Blended Results

### 13.1 "All" Tab — Blended Results with Preview Strips

The All tab should show a blended view like Google:

```
[Top 3 articles]
[Image strip — 6 thumbnails → "See all images"]
[Next 3 articles]
[Video strip — 3 thumbnails → "See all videos"]
[Next 4 articles]
[Trial card — 2 trials → "See all trials"]
[Remaining articles]
[Pagination]
```

### 13.2 Backend: Return Tab Counts

The main `/v1/search` response should include estimated counts per tab so the
frontend can show counts in the tab bar before the user clicks each tab:

```python
# In the /v1/search response, add:
{
    "tabCounts": {
        "all": total,
        "papers": papers_estimate,      # quick count from SearXNG science results
        "guidelines": guidelines_count,  # from enriched results with type=guideline
        "trials": trials_count,          # from ClinicalTrials.gov countTotal
        "images": images_count,          # from SearXNG images
        "videos": videos_count,          # from SearXNG videos
        "pdfs": pdfs_count,              # from results with type=pdf
        "articles": articles_count,      # total - papers - guidelines - trials - pdfs
    }
}
```

### 13.3 "Articles" Tab

The Articles tab should show non-academic web results: news, health websites,
patient education content. Filter out papers, trials, and guidelines.

```python
# Articles = SearXNG general results where type == "article"
# (not peer-reviewed, not trials, not guidelines)
```

### Files Modified
- `services/web-service/routers/search.py`
- `frontend-manthana/manthana/src/app/search/page.tsx`

---

## 14. Phase 12 — Knowledge Panel v2 (Smart AI, Minimal)

### 14.1 Current Knowledge Panel

Shows: entity name, SNOMED codes, Ayurvedic properties, related guidelines/trials,
related searches. No AI synthesis.

### 14.2 v3 Enhancements (Minimal AI, Maximum Value)

**AI usage: Single Groq call, cached for 24h, only triggered once per unique entity.**

```typescript
// Knowledge Panel v2 sections:

1. Entity Header        // entity name + type badge (drug, condition, procedure)
2. Quick Summary        // 2-3 sentence AI summary (Groq, cached 24h) — ONLY AI component
3. SNOMED-CT Codes      // existing
4. ICD-10 Codes         // new — from SNOMED mapping
5. Ayurvedic Properties // existing (when domain=ayurveda)
6. Key Facts Box        // structured: causes, symptoms, treatments (from search results, NO AI)
7. Related Trials       // existing, enhanced with counts
8. Related Guidelines   // existing, enhanced with counts
9. Drug Interactions    // if entity is a drug — from existing herb-drug API
10. Related Searches    // existing
11. Source Attribution   // "Source: PubMed, WHO, ClinicalTrials.gov"
```

### 14.3 AI Summary Endpoint (Minimal, Cached)

```python
# services/web-service/routers/knowledge.py (NEW FILE)

@router.get("/knowledge/summary")
async def knowledge_summary(entity: str, domain: str = "allopathy"):
    """
    Generate a 2-3 sentence medical summary for the knowledge panel.
    Uses Groq (fast, cheap). Cached in Redis for 24 hours.
    Called ONCE per unique entity, not per search.
    """
    # Check Redis cache first
    cached = await redis.get(f"knowledge:{entity}:{domain}")
    if cached: return cached

    # Single Groq call with tight token limit
    prompt = f"In 2-3 sentences, summarize {entity} for a medical professional. Domain: {domain}."
    summary = await groq_complete(prompt, max_tokens=150)

    # Cache for 24 hours
    await redis.setex(f"knowledge:{entity}:{domain}", 86400, summary)
    return { "summary": summary, "cached": False }
```

**AI cost per query:** ~150 tokens = $0.00001 with Groq. Cached after first call.

### Files Created
- `services/web-service/routers/knowledge.py`

### Files Modified
- `frontend-manthana/manthana/src/components/search/KnowledgePanel.tsx`

---

## 15. Phase 13 — UX: Google-Beating Features

### 15.1 Features Google Doesn't Have (Medical Vertical Advantages)

| Feature | Description | Implementation |
|---------|-------------|----------------|
| **Trust Score Bar** | Visual trust indicator (0-100%) on every result | Already exists, keep |
| **Peer-Review Badge** | Green badge on peer-reviewed results | Already exists, enhance |
| **Evidence Level Tags** | "Systematic Review", "RCT", "Case Report", "Expert Opinion" | Parse from PubMed publication types |
| **Citation Copy** | One-click Vancouver/APA citation copy | Already exists in `citation-generator.ts` |
| **Drug Interaction Alert** | When query is a drug, show interaction warnings in panel | Use existing herb-drug API |
| **Trial Recruitment Badge** | "RECRUITING NEAR YOU" on actively recruiting trials | ClinicalTrials.gov status field |
| **Guideline Strength Indicator** | "Strong Recommendation" / "Conditional" for guideline results | Parse from NICE/WHO grading |
| **Cross-Domain Bridge** | "See Ayurvedic perspective" / "See Allopathic perspective" | Link to same query in different domain |
| **PDF Preview** | Inline first-page thumbnail for PDF results | Backend generates thumbnail (future) |
| **Source Diversity Meter** | Shows how many unique sources were queried | Already have `enginesUsed` |

### 15.2 Instant Search Preview (Like Google's Featured Snippet)

For the "All" tab, show a highlighted card at the top when a high-confidence answer
exists (e.g., from WHO or PubMed):

```
┌─────────────────────────────────────────────┐
│ ⭐ FEATURED RESULT                          │
│                                              │
│ Prameha Chikitsa (Ayurvedic Diabetes Mgmt)  │
│ Prameha is classified into 20 types in       │
│ Ayurveda. Treatment involves Samshodhana     │
│ (purification) and Samshamana (palliative)...│
│                                              │
│ Source: CCRAS (Government of India) — 95%    │
│ trust                                        │
└─────────────────────────────────────────────┘
```

This is the highest-trust-score result from the search, displayed prominently.
No AI needed — just surface the best search result.

### 15.3 Image Strip in All Tab

```
[img] [img] [img] [img] [img] [img]  → View all images
```

Horizontally scrollable strip of first 6 images, shown between result #3 and #4.

### 15.4 Video Strip in All Tab

```
[▶ thumbnail] [▶ thumbnail] [▶ thumbnail]  → View all videos
```

3 video thumbnails between result #6 and #7.

### 15.5 "Ask Oracle" Deep-Dive Button

Already exists as link per result. Enhance:
- Make it a floating action button visible on the search page
- Pre-populate Oracle with the search query + top 3 sources as context

### 15.6 Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `/` | Focus search box |
| `Tab` | Cycle through filter tabs |
| `j`/`k` | Navigate results up/down |
| `Enter` | Open selected result |
| `o` | Open in new tab |
| `c` | Copy citation for selected result |
| `Esc` | Back to search box |

### 15.7 Result Card Enhancement

```
┌─────────────────────────────────────────────────────┐
│ [RESEARCH]  PubMed · Semantic Scholar               │
│                                                      │
│ Ayurvedic Management of Prameha: A Systematic Review│
│                                                      │
│ This systematic review evaluates evidence for        │
│ traditional Ayurvedic interventions in prameha...    │
│                                                      │
│ 2023-05-14  ████████▒▒ 85% trust  📋 Copy Citation │
│ ✅ Peer-Reviewed  · Systematic Review · Open Access  │
│                                     Ask Oracle →     │
└─────────────────────────────────────────────────────┘
```

### Files Modified
- `frontend-manthana/manthana/src/app/search/page.tsx`
- `frontend-manthana/manthana/src/components/search/ResultCard.tsx`
- `frontend-manthana/manthana/src/components/search/ImageStrip.tsx`
- `frontend-manthana/manthana/src/components/search/VideoStrip.tsx`

### Files Created
- `frontend-manthana/manthana/src/components/search/FeaturedResult.tsx`
- `frontend-manthana/manthana/src/components/search/TrialCard.tsx`
- `frontend-manthana/manthana/src/components/search/PdfCard.tsx`
- `frontend-manthana/manthana/src/hooks/useSearchKeyboard.ts`

---

## 16. Phase 14 — Caching Strategy

### 16.1 Multi-Layer Cache

```
Layer 1: Browser (SWR/stale-while-revalidate, 60s)
Layer 2: Redis (per-tab cache, 5 min default)
Layer 3: PostgreSQL (persistent cache for popular queries, 1 hour)
```

### 16.2 Cache Keys (Per-Tab)

```
web:search:all:{hash(q+category+page+lang)} → 300s
web:search:papers:{hash(q+page+sort)} → 300s
web:search:guidelines:{hash(q+page+org)} → 600s (guidelines change rarely)
web:search:trials:{hash(q+page+status+phase)} → 600s
web:search:images:{hash(q+page)} → 300s
web:search:videos:{hash(q+page)} → 300s
web:search:pdfs:{hash(q+page)} → 300s
web:search:articles:{hash(q+page)} → 300s
web:knowledge:{entity}:{domain} → 86400s (24h for AI summary)
```

### 16.3 Frontend Caching

Use React Query or SWR pattern to avoid refetching when switching between tabs
if data was recently loaded:

```typescript
// When user switches back to "All" from "Papers",
// show cached "All" data instantly, refetch in background if stale
```

### Files Modified
- `services/web-service/cache.py`
- `frontend-manthana/manthana/src/app/search/page.tsx`

---

## 17. Phase 15 — Performance & Resilience

### 17.1 Circuit Breakers per Source

```python
pubmed_circuit = CircuitBreaker(failure_threshold=5, recovery_timeout=30)
semantic_scholar_circuit = CircuitBreaker(failure_threshold=5, recovery_timeout=30)
clinical_trials_circuit = CircuitBreaker(failure_threshold=5, recovery_timeout=30)
searxng_circuit = CircuitBreaker(failure_threshold=5, recovery_timeout=30)  # existing
youtube_circuit = CircuitBreaker(failure_threshold=3, recovery_timeout=60)
```

### 17.2 Timeout Strategy

| Source | Timeout | Fallback |
|--------|---------|----------|
| SearXNG | 8s | Empty results, show other sources |
| PubMed | 5s | Skip, show SearXNG science results |
| Semantic Scholar | 5s | Skip, show PubMed results |
| ClinicalTrials.gov | 8s | Skip, show SearXNG trial results |
| YouTube/Videos | 5s | Skip video strip |
| MeiliSearch | 3s | Skip, use remote sources only |
| Groq (knowledge) | 3s | Skip summary, show panel without it |

### 17.3 Graceful Degradation

Every tab should show *something* even if its primary source is down:

```
Research Papers:
  Primary: PubMed → Down? → Fallback: Semantic Scholar → Down? → Fallback: SearXNG science
  Always show at least SearXNG results filtered by academic domains

Guidelines:
  Primary: SearXNG site-search → Down? → Fallback: MeiliSearch index
  Show: "Limited results — some sources unavailable" notice

Images:
  Primary: SearXNG images → Down? → Show: "Image search temporarily unavailable"
```

### Files Modified
- `services/shared/circuit_breaker.py` (add new circuit breakers)
- All new router files (add try/except with graceful fallback)

---

## 18. Implementation Priority & Timeline

### Wave 1: Critical Fixes (Days 1-2)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 1 | Fix `enrich_result` to preserve upstream `type` | `search.py` | Guidelines & trials type preserved |
| 2 | Expand `PEER_REVIEWED_DOMAINS` | `search.py` | Research Papers tab populated |
| 3 | Enable `google_images`, `bing_images` in SearXNG | `settings.yml` | Images tab populated |
| 4 | Enable `youtube_noapi`, `piped` in SearXNG | `settings.yml` | Videos tab populated |
| 5 | Fix `/search/videos` to use `category=videos` | `search.py` | Videos actually return videos |
| 6 | Improve PDF detection heuristics | `search.py` | PDFs tab populated |

**After Wave 1:** All tabs show some results from existing SearXNG data. Not ideal but functional.

### Wave 2: Per-Tab Backend Endpoints (Days 3-5)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 7 | Create PubMed client | `clients/pubmed.py` | Dedicated paper source |
| 8 | Create Semantic Scholar client | `clients/semantic_scholar.py` | Second paper source |
| 9 | Create `/v1/search/papers` endpoint | `routers/papers.py` | Papers tab with real data + pagination |
| 10 | Create `/v1/search/guidelines` endpoint | `routers/guidelines_search.py` | Guidelines tab with real data |
| 11 | Create `/v1/search/trials` with pagination | `routers/trials.py` | Trials tab pagination |
| 12 | Create `/v1/search/pdfs` endpoint | `routers/pdfs.py` | PDFs tab with real data |
| 13 | Enhance `/v1/search/images` with pagination | `routers/search.py` | Images pagination |
| 14 | Enhance `/v1/search/videos` with pagination | `routers/search.py` | Videos pagination |
| 15 | Register all new routers in `main.py` | `main.py` | Endpoints available |
| 16 | Add tab counts to `/v1/search` response | `routers/search.py` | Tab counts in All view |

### Wave 3: Frontend Per-Tab Fetching (Days 6-8)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 17 | Add `searchPapers`, `searchGuidelines`, etc. to API client | `web/client.ts` | Frontend can call new endpoints |
| 18 | Rewrite search page with per-tab state | `search/page.tsx` | Each tab fetches independently |
| 19 | Add per-tab pagination | `search/page.tsx` | User can paginate each tab |
| 20 | Add image strip in All tab | `ImageStrip.tsx` | Images preview in All |
| 21 | Add video strip in All tab | `VideoStrip.tsx` | Videos preview in All |
| 22 | Enhanced trial card component | `TrialCard.tsx` | Rich trial display |
| 23 | Enhanced PDF card component | `PdfCard.tsx` | Rich PDF display |

### Wave 4: UX Polish & Knowledge Panel (Days 9-11)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 24 | Featured Result card | `FeaturedResult.tsx` | Top result prominently shown |
| 25 | Evidence Level tags | `ResultCard.tsx` | "Systematic Review", "RCT" badges |
| 26 | Keyboard shortcuts | `useSearchKeyboard.ts` | Power-user navigation |
| 27 | Knowledge Panel v2 with AI summary | `KnowledgePanel.tsx`, `knowledge.py` | Smart panel |
| 28 | Cross-domain bridge links | `page.tsx` | "See Ayurvedic perspective" |
| 29 | Source diversity meter | `page.tsx` | Shows engines queried |

### Wave 5: Caching & Resilience (Days 12-13)

| # | Task | Files | Impact |
|---|------|-------|--------|
| 30 | Per-tab Redis caching | `cache.py` | Fast repeat queries |
| 31 | Circuit breakers per source | `circuit_breaker.py` | Graceful degradation |
| 32 | Frontend SWR caching | `page.tsx` | Instant tab switching |
| 33 | Fallback chains per tab | All routers | Always show something |

---

## 19. File Manifest

### New Files to Create

| File | Purpose |
|------|---------|
| `services/web-service/clients/pubmed.py` | PubMed E-Utilities API client |
| `services/web-service/clients/semantic_scholar.py` | Semantic Scholar API client |
| `services/web-service/clients/pmc.py` | PubMed Central open-access PDFs |
| `services/web-service/clients/europe_pmc.py` | Europe PMC REST API client |
| `services/web-service/clients/youtube.py` | YouTube Data API v3 (optional) |
| `services/web-service/routers/papers.py` | `/v1/search/papers` endpoint |
| `services/web-service/routers/guidelines_search.py` | `/v1/search/guidelines` endpoint |
| `services/web-service/routers/trials.py` | `/v1/search/trials` endpoint |
| `services/web-service/routers/pdfs.py` | `/v1/search/pdfs` endpoint |
| `services/web-service/routers/knowledge.py` | `/v1/knowledge/summary` (AI, cached) |
| `frontend-manthana/manthana/src/components/search/FeaturedResult.tsx` | Featured result card |
| `frontend-manthana/manthana/src/components/search/TrialCard.tsx` | Rich trial display |
| `frontend-manthana/manthana/src/components/search/PdfCard.tsx` | PDF result card |
| `frontend-manthana/manthana/src/hooks/useSearchKeyboard.ts` | Keyboard shortcuts |

### Files to Modify

| File | Changes |
|------|---------|
| `services/web-service/routers/search.py` | Fix `enrich_result`, add tab counts, expand domains |
| `services/web-service/main.py` | Register 4 new routers |
| `services/web-service/config.py` | New config fields (YouTube API key, CTRI enable, etc.) |
| `services/web-service/cache.py` | Per-tab cache key scheme |
| `services/web-service/clients/clinical_trials.py` | Add pagination & filters |
| `services/web-service/clients/guidelines.py` | Improve search strategy |
| `services/shared/circuit_breaker.py` | Add circuit breakers per source |
| `configs/searxng/settings.yml` | Enable image, video, YouTube engines |
| `frontend-manthana/manthana/src/app/search/page.tsx` | Major rewrite: per-tab fetching, pagination, strips |
| `frontend-manthana/manthana/src/lib/api/web/client.ts` | Add `searchPapers`, `searchGuidelines`, etc. |
| `frontend-manthana/manthana/src/lib/api/web/types.ts` | New response types per tab |
| `frontend-manthana/manthana/src/lib/api/web/index.ts` | Re-export new functions |
| `frontend-manthana/manthana/src/lib/api/index.ts` | Re-export new functions |
| `frontend-manthana/manthana/src/components/search/KnowledgePanel.tsx` | v2 with AI summary, ICD-10 |
| `frontend-manthana/manthana/src/components/search/ResultCard.tsx` | Evidence level tags |
| `frontend-manthana/manthana/src/components/search/ImageStrip.tsx` | Used in All tab |
| `frontend-manthana/manthana/src/components/search/VideoStrip.tsx` | Used in All tab |

### Environment Variables to Add

```env
# Optional: YouTube Data API key for video search
YOUTUBE_API_KEY=

# Optional: NCBI API key for higher PubMed rate limits (10 req/sec vs 3)
NCBI_API_KEY=

# Optional: Semantic Scholar API key (higher rate limits)
SEMANTIC_SCHOLAR_API_KEY=

# Enable CTRI (India) trial search
WEB_ENABLE_CTRI=true
```

---

## Summary

**The v2 architecture is fundamentally broken** because it fetches 20 blended results
and tries to filter them into 8 categories client-side. Most categories get zero matches.

**v3 fixes this** by giving each tab its own backend pipeline with dedicated sources:
- **Research Papers:** PubMed + Semantic Scholar + Google Scholar
- **Clinical Guidelines:** WHO + NICE + CDC site-search + MeiliSearch index
- **Trials:** ClinicalTrials.gov with full pagination + CTRI
- **Images:** SearXNG images with Google/Bing image engines
- **Videos:** SearXNG videos with YouTube/Piped engines
- **PDFs:** SearXNG filetype:pdf + PubMed Central + Europe PMC
- **Articles:** SearXNG general web results
- **All:** Blended view with preview strips from each category

Every tab paginates independently. Every tab has its own cache. Every source has
a circuit breaker. The Knowledge Panel gets one tiny AI call (2 sentences, cached 24h).

**This beats Google** because Google shows generic web results. Manthana v3 shows
trust-scored, peer-review-flagged, evidence-level-tagged medical results from
the best medical databases in the world — with cross-domain Ayurveda/Allopathy
bridging that Google cannot do.
