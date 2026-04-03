# Manthana Web Frontend → Backend → Database — Deep Dive Audit

**Date:** 2026-03-19  
**Scope:** `frontend-manthana` (Next.js) → backend services → databases  
**Focus:** Complete data flow from browser to persistence layer

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (Next.js :3001)                                  │
│  frontend-manthana/manthana/                                                     │
│  • Runs separately (npm run dev) — NOT in docker-compose                           │
│  • Auth: Better Auth + SQLite (auth.db) — users, sessions, accounts                │
│  • API calls: Direct to backend via NEXT_PUBLIC_*_URL env vars                    │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ HTTP + Bearer JWT (optional)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                    PRIMARY BACKEND: ai-router (:8000)                             │
│  • Unified gateway — frontend default target (NEXT_PUBLIC_API_URL)                │
│  • NO relational database — uses Redis, Meilisearch, Qdrant, SearXNG, Ollama     │
│  • JWT validation via Better Auth JWKS (frontend /api/auth/jwks)                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        ▼                           ▼                           ▼
┌───────────────┐         ┌─────────────────┐         ┌─────────────────────┐
│ manthana-api  │         │ oracle-service  │         │ web-service          │
│ (:8001)       │         │ (:8100)         │         │ (:8200)              │
│ Legacy search │         │ Chat, M5        │         │ Medical search       │
│ NO PostgreSQL │         │ NO PostgreSQL  │         │ NO PostgreSQL        │
│ ES, Qdrant,   │         │ Redis only      │         │ Redis, SearXNG       │
│ Meilisearch   │         │ (DB provisioned │         │ (DB provisioned     │
│               │         │  but unused)    │         │  but unused)         │
└───────────────┘         └─────────────────┘         └─────────────────────┘
        │                           │                           │
        ▼                           ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  STORAGE LAYER                                                                   │
│  • Elasticsearch (manthana-api)  • Redis (all)  • Meilisearch  • Qdrant          │
│  • PostgreSQL (oracle-db, web-db, research-db, analysis-db) — PROVISIONED       │
│    but NOT YET CONNECTED to any service (Phase 3 planned)                        │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Frontend Deep Dive

### 2.1 Location & Stack

| Item | Value |
|------|-------|
| Path | `frontend-manthana/manthana/` |
| Framework | Next.js 14.2 |
| Port | 3001 (`next dev -p 3001`) |
| Docker | **Not in docker-compose** — runs standalone |

### 2.2 Frontend Database — Auth Only

| Component | Technology | Path | Purpose |
|-----------|------------|------|---------|
| Better Auth | better-sqlite3 | `process.cwd()/auth.db` | Users, sessions, accounts, JWT signing |

**Schema:** Managed by Better Auth (user, session, account, verification tables).

**Key files:**
- `src/lib/auth.ts` — server config, `database: new Database(dbPath)`
- `src/app/api/auth/[...all]/route.ts` — catch-all for `/api/auth/*`
- `src/lib/auth-client.ts` — React client, `jwtClient()` plugin

### 2.3 API Configuration

**File:** `src/lib/api/config.ts`

| Env Var | Default | Used By |
|---------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Unified base (ai-router) |
| `NEXT_PUBLIC_ORACLE_API_URL` | (falls back to API_URL) | Oracle chat, M5 |
| `NEXT_PUBLIC_WEB_API_URL` | (falls back to API_URL) | Search |
| `NEXT_PUBLIC_RESEARCH_API_URL` | (falls back to API_URL) | Deep research, plagiarism |
| `NEXT_PUBLIC_ANALYSIS_API_URL` | (falls back to API_URL) | Image analysis |
| `NEXT_PUBLIC_CLINICAL_API_URL` | (optional) | Drug, herb-drug, ICD-10 |
| `NEXT_PUBLIC_API_VERSION` | `/v1` | Path prefix |

**Default behavior:** All section clients point to **ai-router:8000** unless section-specific URLs are set.

### 2.4 API Client Structure

```
src/lib/api/
├── config.ts          # URL configuration
├── core/
│   ├── client.ts      # fetchWithAuth, getAuthHeaders
│   ├── envelope.ts    # ApiEnvelope<T> type
│   └── errors.ts      # ApiError
├── oracle/client.ts   # streamChat, streamM5 → POST /v1/chat, /v1/chat/m5
├── web/client.ts     # searchMedical, searchAutocomplete → GET /v1/search
├── research/client.ts # deepResearch, checkOriginality → POST /v1/deep-research, /v1/plagiarism/check
├── analysis/client.ts # analyzeImage → POST /v1/analyze/auto
├── clinical/client.ts # drug, herb-drug, ICD-10, clinical trials
└── unified/client.ts  # postQuery, getCategories, getMe → /v1/query, /v1/categories
```

### 2.5 Auth Flow (Frontend → Backend)

1. User signs in via `authClient.signIn.email()` → Better Auth stores session in `auth.db`
2. JWT plugin issues token; frontend calls `authClient.token()` to get it
3. `getAuthHeaders()` returns `{ Authorization: "Bearer <token>" }` when session exists
4. All `fetchWithAuth()` calls attach this header
5. Backend (ai-router) validates via JWKS: `GET {BETTER_AUTH_URL}/api/auth/jwks`
6. Routes use `get_protected_user` (required) or `get_current_user_optional` (optional)

**Critical:** `BETTER_AUTH_URL` must match frontend origin (e.g. `http://localhost:3001`) so JWT issuer/audience validate.

### 2.6 Request Flow (No Next.js Proxy for Section APIs)

- **Auth:** `/api/auth/*` → Next.js API route (local) → Better Auth handler
- **Section APIs:** Direct `fetch(ORACLE_BASE + "/chat", ...)` → `http://localhost:8000/v1/chat` (cross-origin)

The `next.config.mjs` rewrite `{ source: "/api/:path*", destination: backendUrl }` is for legacy `/api/*` usage. The section clients use full URLs and bypass it.

---

## 3. Backend Deep Dive

### 3.1 ai-router (Primary Frontend Target)

| Item | Value |
|------|-------|
| Port | 8000 |
| Database | **None** — stateless gateway |
| Storage | Redis (cache), Meilisearch, Qdrant, SearXNG, Ollama |

**Endpoints used by frontend:**

| Method | Path | Frontend Client |
|--------|------|-----------------|
| GET | /v1/health | ServiceHealth |
| GET | /v1/search | searchMedical, fetchSearchWithSources |
| GET | /v1/search/autocomplete | searchAutocomplete |
| POST | /v1/query | postQuery |
| POST | /v1/chat | streamChat |
| POST | /v1/chat/m5 | streamM5 |
| POST | /v1/deep-research | deepResearch |
| POST | /v1/analyze/auto | analyzeImage |
| POST | /v1/plagiarism/check | checkOriginality |
| POST | /v1/report/enrich | (ClinicalReport) |

**Missing/404 on ai-router (see FRONTEND_BACKEND_COMPATIBILITY_AUDIT.md):**
- GET /categories, GET /icd10/suggest, POST /report/pdf
- POST /analyze/xray/heatmap, POST /interaction/check/enriched, GET /snomed/lookup
- POST /herb-drug/analyze, POST /clinical-trials/search, POST /drug-interaction/check

### 3.2 manthana-api (Legacy)

| Item | Value |
|------|-------|
| Port | 8001 |
| Database | **None** — uses Elasticsearch, Qdrant, Meilisearch |
| Role | Legacy search; `/categories`, `/icd10/suggest`, `/report/pdf` exist here |

Frontend targets ai-router (8000) by default, so these endpoints return 404 unless frontend uses `NEXT_PUBLIC_CLINICAL_API_URL=http://localhost:8001` or ai-router proxies to manthana-api.

### 3.3 oracle-service

| Item | Value |
|------|-------|
| Port | 8100 (host), 8000 (container) |
| Database | `DATABASE_URL` in docker-compose → `oracle-db` PostgreSQL |
| Actual usage | **Redis only** — PostgreSQL not connected in code |

Used when `NEXT_PUBLIC_ORACLE_API_URL=http://localhost:8100`. Otherwise frontend uses ai-router for chat.

### 3.4 web-service

| Item | Value |
|------|-------|
| Port | 8200 (host), 8001 (container) |
| Database | `DATABASE_URL` → `web-db` PostgreSQL |
| Actual usage | **Redis, SearXNG** — PostgreSQL not connected |

### 3.5 research-service, analysis-service

Same pattern: PostgreSQL volumes exist (`research-db-data`, `analysis-db-data`), but services do not import or use `psycopg`, `asyncpg`, or `sqlalchemy`. **Phase 3 databases are provisioned but unused.**

---

## 4. Database Inventory

### 4.1 Databases in Use

| Database | Location | Used By | Purpose |
|----------|----------|---------|---------|
| **auth.db** (SQLite) | Frontend `process.cwd()` | Better Auth | Users, sessions, accounts |
| **Redis** | redis:6379 | ai-router, oracle, web, research, manthana-api | Cache, rate limit, sessions |
| **Elasticsearch** | elasticsearch:9200 | manthana-api | Search index |
| **Meilisearch** | meilisearch:7700 | ai-router, oracle, indexer | Vector/search |
| **Qdrant** | qdrant:6333 | ai-router, manthana-api, indexer | Vector embeddings |
| **SearXNG** | searxng:8080 | ai-router, web-service | Web search |

### 4.2 Databases Provisioned but Unused

| Database | Container | Volume | Status |
|----------|-----------|--------|--------|
| oracle-db | oracle-db:5432 | oracle-db-data | Provisioned, **not connected** |
| web-db | web-db:5432 | web-db-data | Provisioned, **not connected** |
| research-db | research-db:5432 | research-db-data | Provisioned, **not connected** |
| analysis-db | analysis-db:5432 | analysis-db-data | Provisioned, **not connected** |

### 4.3 Other Storage

| Component | Storage |
|-----------|---------|
| n8n | SQLite in n8n-data volume |
| Perplexica | perplexica-data volume |
| Grafana, Prometheus, Loki | grafana-data, prometheus-data, loki-data |

---

## 5. Data Flow Summary

### 5.1 User Sign-In

```
Browser → POST /api/auth/sign-in/email (Next.js)
       → Better Auth (auth.ts) → auth.db (INSERT session, user)
       → JWT issued, stored in cookie/session
```

### 5.2 Oracle Chat (streamChat)

```
Browser → fetchWithAuth(ORACLE_BASE + "/chat") + Bearer JWT
       → ai-router:8000/v1/chat (or oracle-service:8100 if ORACLE_API_URL set)
       → ai-router: JWKS validation (optional), Groq/Ollama, Meilisearch, Qdrant, Perplexica
       → NO database write — response streamed back
```

### 5.3 Search

```
Browser → fetchWithAuth(WEB_BASE + "/search?q=...")
       → ai-router:8000/v1/search
       → SearXNG + Meilisearch + Qdrant + (optional) Perplexica
       → Redis cache (optional)
       → NO database write
```

### 5.4 Plagiarism Check

```
Browser → fetchWithAuth(RESEARCH_BASE + "/plagiarism/check")
       → ai-router:8000/v1/plagiarism/check
       → plagiarism_service (Python) — internal logic
       → services/shared/audit.py: SQLite write (findings_summary) — labels + confidence only, no PII
```

### 5.5 Image Analysis

```
Browser → fetchWithAuth(ANALYSIS_BASE + "/analyze/auto") + FormData(file)
       → ai-router:8000/v1/analyze/auto
       → Proxies to radiology:8101 (or other imaging service)
       → NO database write
```

---

## 6. Critical Findings

### 6.1 Frontend Database

- **Single DB:** `auth.db` (SQLite) for Better Auth only
- **Persistence:** User accounts, sessions — no application data
- **Location:** `process.cwd()/auth.db` — ensure writable in production

### 6.2 Backend Databases

- **ai-router:** No relational DB; uses Redis, Meilisearch, Qdrant, SearXNG
- **PostgreSQL (Phase 3):** Four instances provisioned, **zero** service connections
- **manthana-api:** Elasticsearch, Qdrant, Meilisearch — no PostgreSQL

### 6.3 Audit Logging

- `services/shared/audit.py` uses **SQLite** (`_conn`) for findings_summary
- Path from `AUDIT_DB_PATH` env or default
- Stores labels + confidence only; no PII in findings

### 6.4 Compatibility Gaps

See `FRONTEND_BACKEND_COMPATIBILITY_AUDIT.md` for:
- Missing ai-router proxy routes
- Response shape mismatches (`/analyze/auto`, SNOMED)
- Envelope `timestamp` field

---

## 7. Recommendations

1. **Phase 3 DB usage:** When oracle/web/research/analysis services need persistence, add `asyncpg` or `sqlalchemy` and connect to their respective PostgreSQL instances.
2. **Frontend auth.db:** For production, consider migrating Better Auth to PostgreSQL (supported via `@better-auth/kysely-adapter` + `pg`) for scalability and backups.
3. **Unified routing:** Ensure Traefik or reverse proxy routes `/api/*` to ai-router when frontend uses relative URLs; currently section clients use absolute URLs.
4. **CORS:** ai-router, web-service, oracle-service allow `FRONTEND_URL`, `localhost:3000`, `localhost:3001` — verify production domain.

---

## 8. File Reference

| Purpose | Path |
|---------|------|
| Frontend auth config | `frontend-manthana/manthana/src/lib/auth.ts` |
| Frontend API config | `frontend-manthana/manthana/src/lib/api/config.ts` |
| Frontend core fetch | `frontend-manthana/manthana/src/lib/api/core/client.ts` |
| ai-router main | `services/ai-router/main.py` |
| ai-router auth | `services/ai-router/auth.py` |
| Backend shared utils | `services/shared/utils.py` |
| Audit log | `services/shared/audit.py` |
| Docker compose | `docker-compose.yml` |
| Compatibility audit | `FRONTEND_BACKEND_COMPATIBILITY_AUDIT.md` |
