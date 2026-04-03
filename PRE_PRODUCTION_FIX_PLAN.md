# Pre-Production Fix Plan — Expert Investigation & Minimal-Fix Max-Impact Strategy

**Date:** 2026-03-17  
**Scope:** EXPERT_REVIEW.md sections 1.2 (Weaknesses), 2.2 (Code Quality), 3.2 (Security Gaps)  
**Methodology:** Deep codebase investigation → Verdict (TRUE / FALSE / PARTIAL) → Minimal-fix max-impact correction plan

---

## Executive Summary

| Concern | Verdict | Severity | Fix Effort |
|--------|---------|----------|------------|
| Dual API surface | **PARTIAL** — Proxies added, but two brains remain | Medium | Medium |
| Legacy orchestrator | **TRUE** — Two parallel search/orchestration paths | Medium | High |
| No API versioning | **TRUE** | Low (pre-launch) | Low |
| Tight coupling | **TRUE** | Medium | Medium |
| File size / duplication | **TRUE** — ICD-10, RadLex, RADS duplicated | Medium | Medium |
| Mixed response patterns | **TRUE** — /plagiarism, /autocomplete, /icd10 raw | Low | Low |
| `Any` overuse | **TRUE** | Low | Low |
| Backup files | **TRUE** — 5 files, not in .gitignore | Trivial | Trivial |
| Input validation | **TRUE** — No content validation, no JSON schema | **High** | Medium |
| Meilisearch default key | **TRUE** — `masterKey` hardcoded in 4 places | **High** | Low |
| SearXNG trust | **PARTIAL** — Trust scoring exists, risk remains | Medium | Low |

---

## 1. Section 1.2 Weaknesses — Deep Investigation

### 1.1 Dual API Surface

**Verdict: PARTIAL — Mitigated but not resolved**

**Evidence:**
- ai-router (8000) has added proxy routes: `/categories`, `/icd10/suggest`, `/report/pdf` (main.py:1458–1526)
- `/categories`: Serves static `CATEGORIES` list directly (no proxy) — ✅ works
- `/icd10/suggest`: Proxies to `api.py:8001` — ✅ works when api is up
- `/report/pdf`: Proxies to `api.py:8001` — ✅ works when api is up
- Frontend targets 8000 (FRONTEND_BACKEND_COMPATIBILITY_AUDIT.md)

**Remaining issues:**
- api.py (8001) still runs as separate service with full ICD10_DB, REPORT_ICD10_RADLEX, orchestrator
- If api.py is down, `/icd10/suggest` and `/report/pdf` return 502
- Two codebases maintain overlapping logic (categories, ICD-10, report enrichment)

**Fix plan (minimal, max impact):**
1. **Phase A (pre-launch):** Add fallback ICD-10 logic in ai-router when proxy fails — use ai-router’s `_ICD10_RADLEX_MAP` + a minimal ICD10 subset (10–20 common codes) so core flows work if api.py is unavailable.
2. **Phase B (post-launch):** Consolidate: move ICD10_DB, REPORT_ICD10_RADLEX, report PDF generation into a shared module; make ai-router the single source; deprecate api.py search endpoints (keep only as optional legacy).

---

### 1.2 Legacy Orchestrator

**Verdict: TRUE — Two parallel brains**

**Evidence:**
- `orchestrator.py`: 814 lines; used by `api.py` only
- ai-router: Uses `search_utils.py`, `fetch_searxng`, `search_own_index_async` — separate implementation
- api.py search: `manthana_search()` → orchestrator → ES, SearXNG, crawl, Groq synthesis
- ai-router search: `fetch_searxng`, `search_own_index_async`, `deduplicate_results`, `sort_by_trust` — no Groq synthesis in same way

**Fix plan (minimal, max impact):**
1. **Pre-launch:** No refactor. Document clearly: “api.py = legacy search with AI synthesis; ai-router = primary search for frontend.” Ensure frontend uses ai-router `/search` only.
2. **Post-launch:** Extract shared search primitives (SearXNG fetch, trust sort, dedup) into `services/shared/search.py`; have both api.py and ai-router import from there. Defer full orchestrator merge.

---

### 1.3 No API Versioning

**Verdict: TRUE**

**Evidence:**
- All routes: `/search`, `/query`, `/analyze/auto`, `/plagiarism/check` — no `/v1/` prefix
- ai-router metadata has `version="2.0.0"` but routes are unversioned

**Fix plan (minimal, max impact):**
1. **Pre-launch:** Add `/v1/` prefix to all ai-router routes in one pass. Use FastAPI `APIRouter(prefix="/v1")` and mount at `/v1`. Keep `/` root for health/info only.
2. **Effort:** ~30 min. Single router change + update frontend `NEXT_PUBLIC_API_URL` to include `/v1` or add path in api.ts.

---

### 1.4 Tight Coupling

**Verdict: TRUE**

**Evidence:**
- `from plagiarism_service import check_originality` — top-level module; ai-router adds `PROJECT_ROOT` to `sys.path`
- `from search_utils import ...` — relative to ai-router directory
- Orchestrator, api.py, ai-router each have own env vars and client management

**Fix plan (minimal, max impact):**
1. **Pre-launch:** Move `plagiarism_service.py` to `services/shared/plagiarism.py` (or `services/ai-router/plagiarism_service.py`). Update imports. Ensures ai-router can run without PROJECT_ROOT hacks.
2. **Post-launch:** Introduce `services/shared/search.py` for shared search logic; reduce duplication between orchestrator and search_utils.

---

## 2. Section 2.2 Code Quality — Deep Investigation

### 2.1 File Size

**Verdict: TRUE**

**Evidence:**
- `ai-router/main.py`: 1952 lines
- `api.py`: 819 lines
- `orchestrator.py`: 814 lines

**Fix plan (minimal, max impact):**
1. **Pre-launch:** No refactor. File size is a maintainability concern, not a launch blocker.
2. **Post-launch:** Split ai-router into routers: `routers/search.py`, `routers/clinical.py`, `routers/reports.py`, `routers/plagiarism.py`. Extract helpers to `services/ai-router/helpers/`.

---

### 2.2 Duplication (ICD-10, RadLex, RADS)

**Verdict: TRUE — Significant DRY violation**

**Evidence:**
- **api.py:** `ICD10_DB` (40+ terms), `REPORT_ICD10_RADLEX` (6 terms), `_report_infer_rads()`
- **ai-router:** `_ICD10_RADLEX_MAP` (2 terms only: pleural effusion, cardiomegaly), `_infer_rads_system()` — identical logic to `_report_infer_rads`
- **Frontend:** `icd10-map.ts`, `rads-engine.ts` — third copy of RADS logic

**Fix plan (minimal, max impact):**
1. **Pre-launch:** Create `services/shared/medical_ontology.py`:
   - `ICD10_DB`, `REPORT_ICD10_RADLEX` (merge api.py + ai-router, take superset)
   - `infer_rads_system(modality: str)`
   - `lookup_icd_radlex(label: str)`
2. Replace usages in api.py and ai-router with imports from shared. **Effort:** 2–3 hours. **Impact:** Single source of truth; no divergence.

---

### 2.3 Mixed Response Patterns

**Verdict: TRUE**

**Evidence:**
- `/plagiarism/check`: Returns raw `result` from `check_originality` — no `format_response` envelope
- `/search/autocomplete`: Returns `{"suggestions": []}` — no envelope
- `/icd10/suggest` proxy: Returns raw `{"query": q, "suggestions": matches}` from api.py

**Fix plan (minimal, max impact):**
1. **Pre-launch:** Wrap `/plagiarism/check` in `format_response("success", "ai-router", result, None, rid)` so frontend gets consistent envelope. Frontend may need to read `data` instead of root — verify `PlagiarismResult` handling.
2. **Autocomplete:** Either wrap in envelope (`data: { suggestions: [] }`) or document as intentional lightweight endpoint. Low priority.
3. **icd10 proxy:** Keep raw if frontend expects `{query, suggestions}`. Document.

---

### 2.4 `Any` Overuse

**Verdict: TRUE — Acceptable for glue code, overused**

**Evidence:**
- 40+ `Dict[str, Any]` / `List[Dict[str, Any]]` across ai-router, api, orchestrator, shared
- Pydantic models exist for some requests; many endpoints use `Body(...)` with raw dict

**Fix plan (minimal, max impact):**
1. **Pre-launch:** No change. Typing improvements are quality-of-life, not launch blockers.
2. **Post-launch:** Introduce Pydantic models for high-traffic request/response bodies (e.g. `PlagiarismCheckRequest`, `ReportEnrichRequest`). Prioritize `/analyze/auto`, `/report/enrich`, `/plagiarism/check`.

---

### 2.5 Backup Files

**Verdict: TRUE — Trivial fix**

**Evidence:**
- 5 files: `api.py.bak.*`, `orchestrator.py.bak.*`, `services/ai-router/main.py.bak.*`
- `.gitignore` does not include `*.bak.*` or `*.bak`

**Fix plan (minimal, max impact):**
1. Add `*.bak` and `*.bak.*` to `.gitignore`
2. Run `git rm --cached` on the 5 backup files (or delete if not needed)
3. **Effort:** 2 minutes

---

## 3. Section 3.2 Security Gaps — Deep Investigation

### 3.1 Input Validation

**Verdict: TRUE — High risk for production**

**Evidence:**
- `detect_file_type(filename, content_type)` — uses extension + MIME only. No magic-byte or binary validation.
- A file named `malicious.exe` with `Content-Type: application/dicom` could be routed as DICOM
- No validation that DICOM files have valid DICOM headers (e.g. 128-byte preamble + "DICM")
- JSON bodies: `Body(...)` accepts arbitrary dict; no strict schema on all endpoints

**Fix plan (minimal, max impact):**
1. **Pre-launch (high impact):**
   - Add optional `validate_file_content(bytes, detected_type)` in `services/shared/utils.py`:
     - For DICOM: Check first 132 bytes for "DICM" at offset 128
     - For images: Use PIL `Image.open(BytesIO(data))` to verify it’s a valid image
     - For CSV: Basic structure check (headers, row count)
   - Call this in ai-router before forwarding to downstream services. Reject invalid files with 400.
2. **JSON bodies:** Add Pydantic models for `/report/enrich`, `/plagiarism/check`, `/analyze/auto` request bodies. FastAPI will validate automatically.
3. **Effort:** 4–6 hours. **Impact:** Blocks malicious/broken file uploads and malformed JSON.

---

### 3.2 Meilisearch Default Key

**Verdict: TRUE — High risk if not overridden**

**Evidence:**
- `services/shared/config.py`: `MEILISEARCH_KEY = Field(default="masterKey")`
- `services/ai-router/services/config.py`: `MEILISEARCH_KEY: str = "masterKey"`
- `search_utils.py` `search_own_index_async`: `meilisearch_key: str = "masterKey"`
- `docker-compose.yml`: `MEILISEARCH_KEY=${MEILI_MASTER_KEY}` — so production can override via .env
- **Risk:** If `MEILI_MASTER_KEY` is empty or unset in production, services may fall back to default `masterKey` (Meilisearch’s default dev key)

**Fix plan (minimal, max impact):**
1. **Pre-launch:**
   - Change default in `services/shared/config.py` to `default=""` and add validation: if `MEILISEARCH_URL` is non-localhost and `MEILISEARCH_KEY` is empty or `"masterKey"`, log a **critical** warning at startup.
   - Add to deployment checklist: “Set MEILI_MASTER_KEY to a strong random value in production.”
   - In `search_own_index_async`, if key is `"masterKey"` and URL is not localhost, refuse to connect (or log critical warning).
2. **Effort:** 1 hour. **Impact:** Prevents accidental exposure of Meilisearch with default key.

---

### 3.3 SearXNG External Search

**Verdict: PARTIAL — Trust scoring helps, risk remains**

**Evidence:**
- `search_utils.py`: `sort_by_trust()`, `TRUST_SCORES` (80+ domains), `_GENERIC_HEALTH_DOMAINS` penalty
- Results are ranked by credibility; low-trust domains demoted
- SearXNG aggregates external engines; no guarantee of safe/sanitized content (XSS, malicious URLs)

**Fix plan (minimal, max impact):**
1. **Pre-launch:**
   - Ensure all result URLs and snippets are escaped when rendered in frontend (React default escaping helps).
   - Add `rel="noopener noreferrer"` and `target="_blank"` for external links.
   - Document: “SearXNG results are from external sources; trust scoring is heuristic. Users should verify sources.”
2. **Optional:** Add a config flag `SEARXNG_RESULTS_MAX_TRUST` — filter out results below a trust threshold before returning. Default: no filter (current behavior).

---

## 4. Minimal-Fix Max-Impact Priority Matrix

| Priority | Item | Effort | Impact | Pre-launch? |
|----------|------|--------|--------|-------------|
| P0 | Meilisearch key validation + deployment checklist | 1h | High (security) | ✅ Yes |
| P0 | Add `*.bak` to .gitignore, remove backup files | 5m | Low (hygiene) | ✅ Yes |
| P1 | File content validation (DICOM, image magic bytes) | 4h | High (security) | ✅ Yes |
| P1 | JSON schema validation (Pydantic for key endpoints) | 2h | Medium (robustness) | ✅ Yes |
| P2 | Extract ICD-10/RadLex/RADS to `medical_ontology.py` | 3h | High (DRY, consistency) | ✅ Yes |
| P2 | API versioning (`/v1/` prefix) | 30m | Medium (future-proofing) | ✅ Yes |
| P3 | Move plagiarism_service to shared, fix coupling | 1h | Medium (maintainability) | Optional |
| P3 | Wrap /plagiarism/check in format_response | 30m | Low (consistency) | Optional |
| P4 | Orchestrator consolidation, file refactor | 2–3 days | High (long-term) | ❌ Post-launch |
| P4 | Typing improvements (reduce Any) | 1–2 days | Low | ❌ Post-launch |

---

## 5. Implementation Order (Pre-Launch Sprint)

**Week 1 — Security & Hygiene (Must-Do)**
1. Meilisearch key: Add startup validation, update deployment docs
2. Backup files: .gitignore + remove from repo
3. File content validation: DICOM magic check, image validation
4. Pydantic models for `/report/enrich`, `/plagiarism/check` request bodies

**Week 2 — Consolidation & Consistency**
5. Create `services/shared/medical_ontology.py`; migrate ICD-10, RadLex, RADS
6. Add `/v1/` API versioning
7. (Optional) Move plagiarism_service to shared; wrap plagiarism response in envelope

**Post-Launch**
8. Refactor ai-router into routers
9. Extract shared search primitives; reduce orchestrator/ai-router duplication
10. Typing improvements

---

## 6. Verification Checklist Before Production

- [x] `MEILI_MASTER_KEY` set to strong value in production .env *(startup validation + DEPLOYMENT_CHECKLIST.md added)*
- [x] No `*.bak` files in repo; .gitignore updated
- [x] File uploads reject invalid DICOM (no "DICM" header) with 400
- [x] Key JSON endpoints have Pydantic validation
- [x] ICD-10/RadLex/RADS in single shared module
- [x] API routes under `/v1/` (or versioning strategy documented)
- [x] Frontend compatibility verified (envelope, field names, /v1 base)

---

*This plan prioritizes security and data integrity (P0–P1) over code elegance. The “minimal fix, max impact” strategy ensures production readiness without large refactors.*
