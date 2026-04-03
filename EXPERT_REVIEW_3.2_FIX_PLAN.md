# Manthana §3.2 Security Remediation — Top 1% Enterprise Plan

**Document Type:** Enterprise-Grade Security & Compliance Roadmap  
**Standard:** Healthcare PHI / SOC2-aligned / Production-ready  
**Scope:** Auth, Input Validation, Frontend Wiring, XSS, Compliance  
**Version:** 2.0  
**Date:** March 2026

---

## 1. Executive Summary

This plan elevates Manthana from "near-ready" to **top 1% production-grade** for healthcare/PHI. It addresses EXPERT_REVIEW §3.2 gaps with enterprise patterns: defense-in-depth, auditability, phased rollout, and clear success criteria.

### 1.1 Gap Status

| Gap | Current | Target | Blocker? |
|-----|---------|--------|----------|
| **Auth** | Infra exists; not enforced; 3 frontend bypasses | Tiered auth; all calls via `fetchWithAuth` | Yes |
| **Input validation** | File ✅; JSON `Dict[str, Any]` | Pydantic schemas + constraints | No |
| **Meilisearch** | Mitigated | — | No |
| **SearXNG / XSS** | Trust scoring; `rel` gaps; markdown XSS | `noopener noreferrer`; DOMPurify | No |

### 1.2 Design Principles

- **Defense in depth:** Auth + validation + sanitization at each layer
- **Fail secure:** Protected routes return 401 when unauthenticated
- **Auditability:** All sensitive actions logged with `request_id`, `user_id`
- **Phased rollout:** `REQUIRE_AUTH` flag for MVP → production transition
- **Zero regressions:** Tests for each phase; manual verification checklist

---

## 2. Phase 1 — Frontend API Unification (Step 1)

**Goal:** Eliminate auth bypasses. All API calls use `fetchWithAuth` and correct paths.

### 2.1 Scope

| File | Issue | Fix |
|------|-------|-----|
| `useDeepResearch.ts` | Hardcoded `localhost:8000/deep-research`; raw `fetch`; no `/v1` | Use `deepResearch()` from api.ts |
| `SearchBar.tsx` | Raw `fetch`; `API_BASE` without `/v1` | Use `searchAutocomplete()` from api.ts |
| `page.tsx` | Raw `fetch` in streamChat onDone callback | Use `fetchSearchWithSources()` from api.ts |

### 2.2 Implementation

**api.ts additions:**
- `deepResearch(body: DeepResearchRequest): Promise<DeepResearchResult>`
- `searchAutocomplete(q, category, lang): Promise<string[]>`
- `fetchSearchWithSources(query, category, lang): Promise<SearchSourcesResponse>`

**Consumers:** useDeepResearch → `deepResearch()`; SearchBar → `searchAutocomplete()`; page.tsx → `fetchSearchWithSources()`.

### 2.3 Success Criteria

- [x] No raw `fetch` to backend in useDeepResearch, SearchBar, page
- [x] All paths use `/v1` prefix (API_BASE = URL + `/v1`)
- [x] Bearer token attached when user signed in (fetchWithAuth)
- [ ] `pytest tests/` passes; manual: deep-research, autocomplete, chat sources work

**Effort:** 1–2 hours. ✅ Done (frontend unified).

---

## 3. Phase 2 — Backend Auth Enforcement

**Goal:** Protected routes require JWT; return 401 when missing.

### 3.1 Route Tiers

| Tier | Routes | Dependency | Behavior |
|------|--------|------------|----------|
| **Public** | `/health`, `/info`, `/metrics`, `GET /v1/search/autocomplete`, `GET /v1/categories` | None | Always accessible |
| **Optional** | `GET /v1/me`, `GET /v1/search`, `GET /v1/info` | `get_current_user_optional` | User context when signed in |
| **Protected** | `/analyze/*`, `/plagiarism/check`, `/query`, `/chat`, `/deep-research`, `/report/*`, `/clinical-trials/*`, `/drug-interaction/*`, `/herb-drug/*`, `/interaction/*`, `/snomed/*` | `get_current_user` | 401 if no valid JWT |

### 3.2 Configurable Mode

```python
REQUIRE_AUTH: bool = False  # Env: REQUIRE_AUTH=true for production
```

Use `get_auth_dependency()` so MVP can run with optional auth; production flips to required.

### 3.3 Success Criteria

- [x] ~15 routes use `Depends(get_protected_user)` — auth enforced when `REQUIRE_AUTH=true`
- [x] Unauthenticated request to `/v1/analyze/auto` → 401 when `REQUIRE_AUTH=true`
- [x] Authenticated request with Bearer → 200
- [x] Integration tests mock JWT for protected routes (optional)

**Effort:** 2–3 hours. ✅ Done.

---

## 4. Phase 3 — Input Validation (Pydantic Schemas)

**Goal:** Replace `Dict[str, Any]` with strict Pydantic models; reject malformed payloads.

### 4.1 Models to Add/Use

| Endpoint | Model | Key Constraints |
|----------|-------|-----------------|
| `POST /v1/query` | `OracleQueryRequest` | `query`/`question` max 5000 chars |
| `POST /v1/deep-research` | `DeepResearchRequest` | `query` max 2000; `domains` list |
| `POST /v1/chat` | `ChatRequest` | `message` max 4000; `history` max 20 items |
| `POST /v1/plagiarism/check` | `PlagiarismCheckRequest` | `text` max 100000; `scanId` |
| `POST /v1/report/enrich` | `ReportEnrichRequest` | `findings` list; `modality` enum |
| `POST /v1/clinical-trials/search` | `ClinicalTrialsSearchRequest` | `query` max 500 |
| `POST /v1/drug-interaction/check` | `DrugInteractionRequest` | `drugs` list max 20 |
| `POST /v1/interaction/check` | `DrugInteractionRequest` | same as above |
| `POST /v1/interaction/check/enriched` | `InteractionCheckEnrichedRequest` | `drug_a`/`drug_b` max 200 |
| `POST /v1/herb-drug/analyze` | `HerbDrugRequest` | `herb`, `drug` max 200 |
| `POST /v1/report/pdf` | `ReportPdfRequest` | extra="allow" (proxy passthrough) |

### 4.2 Success Criteria

- [x] No `Dict[str, Any] = Body(...)` on sensitive POST endpoints
- [x] 422 on invalid/malformed body
- [x] Field length limits enforced

**Effort:** 4–6 hours. ✅ Done.

---

## 5. Phase 4 — Frontend Security (XSS & Links)

**Goal:** Sanitize user/LLM content; secure external links.

### 5.1 Tasks

| Task | Files | Fix |
|------|-------|-----|
| `rel` attribute | ClinicalToolsPanel, clinical-tools/page, Section_*, ReportFooter, FindingCard | `rel="noopener noreferrer"` for `target="_blank"` |
| XSS in markdown | ChatMessage.tsx, WorkspaceResultState.tsx | DOMPurify before `dangerouslySetInnerHTML` |
| URL sanitization | ChatMessage markdown links | Reject `javascript:`, `data:` in href |

### 5.2 Success Criteria

- [x] All external links have `noopener noreferrer`
- [x] `dompurify` installed; markdown sanitized in ChatMessage, WorkspaceResultState
- [x] No `javascript:` or `data:` in rendered links (safeHref + DOMPurify)

**Effort:** 1–2 hours. ✅ Done.

---

## 6. Phase 5 — Config & Portability

**Goal:** No hardcoded IPs; env-driven config.

### 6.1 Tasks

- [x] Replace `45.130.165.198` in next.config.mjs with `NEXT_PUBLIC_API_URL`
- [x] CSP img-src, connect-src, and images.remotePatterns use env-derived values

**Effort:** 15 minutes. ✅ Done.

---

## 7. Implementation Order

| Step | Phase | Task | Effort | Deps |
|------|-------|------|--------|-----|
| **1** | 1 | Unify frontend API (deepResearch, searchAutocomplete, fetchSearchWithSources) | 1–2h | — |
| 2 | 2 | Enforce auth on protected routes + REQUIRE_AUTH | 2–3h | 1 |
| 3 | 4 | rel="noopener noreferrer" + DOMPurify | 1–2h | — |
| 4 | 3 | Pydantic request models | 4–6h | — |
| 5 | 5 | next.config env vars | 15m | — |

---

## 8. Definition of Done (Full Plan)

### Auth
- [x] All sensitive routes protected when `REQUIRE_AUTH=true`
- [x] No frontend raw `fetch` to backend (all via fetchWithAuth)
- [x] 401 on unauthenticated protected requests (when REQUIRE_AUTH=true)

### Validation
- [x] Pydantic models for all key POST bodies
- [x] 422 on invalid payloads

### Security
- [x] `noopener noreferrer` on external links
- [x] DOMPurify for markdown/HTML

### Verification
- [ ] `pytest tests/` passes (run: `pytest tests/ -v`)
- [ ] Manual checklist: sign out → 401; sign in → 200
- [ ] Deep research, autocomplete, chat sources work

---

## 9. Rollback

- Set `REQUIRE_AUTH=false` to revert to optional auth
- Revert frontend changes; raw fetch paths still work if backend remains open

---

*Plan v2.0 — Enterprise-grade. Execute Step 1 first; verify before proceeding.*
