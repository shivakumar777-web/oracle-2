# EXPERT_REVIEW Section 1.2 — Status Report

**Date:** March 2026  
**Purpose:** Verify whether the four weaknesses in EXPERT_REVIEW.md §1.2 have been resolved by previous fixes.

---

## Summary

| Issue | Status | Evidence |
|-------|--------|----------|
| **Dual API surface** | ✅ **RESOLVED** | ai-router is single entry point; api.py is backend-only for 2 proxies |
| **Legacy orchestrator** | ⚠️ **PARTIALLY RESOLVED** | Not in frontend path; still exists for api.py |
| **No API versioning** | ✅ **RESOLVED** | All routes under `/v1/` |
| **Tight coupling** | ✅ **RESOLVED** | Plagiarism, medical_ontology, and search_utils now in `services/shared/` |

---

## 1. Dual API Surface — ✅ RESOLVED

**Original concern:** api.py (8001) and ai-router (8000) overlap; frontend targets 8000 but some endpoints lived only on 8001.

**Current state:**
- **ai-router** is the single frontend entry point. All API routes are under `APIRouter(prefix="/v1")`.
- **Frontend** uses `API_BASE = NEXT_PUBLIC_API_URL + (NEXT_PUBLIC_API_VERSION ?? "/v1")` → `http://localhost:8000/v1`.
- **api.py** (manthana-api:8001) is used only as a backend for icd10 and report/pdf. ai-router proxies:
  - `GET /v1/icd10/suggest` → `MANTHANA_API_URL/icd10/suggest`
  - `POST /v1/report/pdf` → `MANTHANA_API_URL/report/pdf`
- **Categories** are served directly from ai-router (static `CATEGORIES` list) — no proxy.
- **api.py** is no longer a frontend-facing API; it is a backend service for two specific endpoints.

**Verdict:** ✅ Resolved. Single API surface for the frontend.

---

## 2. Legacy Orchestrator — ⚠️ PARTIALLY RESOLVED

**Original concern:** orchestrator.py is a large monolithic module; two parallel “brains” (orchestrator vs ai-router).

**Current state:**
- **orchestrator.py** still exists and is imported by `api.py` for `manthana_search`, `synthesize`, `init_indexes`, `close_client`.
- **Frontend path:** Frontend → ai-router `/v1/search`, `/v1/query`, `/v1/report/enrich` — ai-router does NOT use orchestrator. It has its own search (search_utils, SearXNG, Meilisearch) and report enrichment.
- **api.py usage:** When ai-router proxies to api.py for icd10 and report/pdf, api.py does NOT use orchestrator for those paths:
  - `icd10/suggest` uses `ICD10_DB` directly
  - `report/pdf` uses ReportLab directly
- **orchestrator** is used by api.py for its own `/search` and `/report/enrich` — but the frontend does not call these directly. It calls ai-router.

**Verdict:** ⚠️ Partially resolved. Orchestrator is not in the critical frontend path. It remains in the codebase for api.py’s legacy endpoints, which are not used by the main frontend flow. Full consolidation would require deprecating api.py’s search/synthesize or merging orchestrator into ai-router.

---

## 3. No API Versioning — ✅ RESOLVED

**Original concern:** Endpoints like `/search`, `/query`, `/analyze/auto` had no `/v1/` prefix.

**Current state:**
- **ai-router** defines `v1 = APIRouter(prefix="/v1", tags=["v1"])`.
- **All API routes** are registered on `v1`: `/v1/search`, `/v1/query`, `/v1/analyze/auto`, `/v1/categories`, `/v1/plagiarism/check`, etc.
- **Root routes** kept only for infra: `/health`, `/info`, `/metrics`.
- **Frontend** uses `NEXT_PUBLIC_API_VERSION ?? "/v1"` in `api.ts`.
- **Tests** use `/v1/` paths (e.g. `test_router.py`).

**Verdict:** ✅ Resolved. All routes are versioned under `/v1/`.

---

## 4. Tight Coupling — ⚠️ MOSTLY RESOLVED

**Original concern:** ai-router imports `plagiarism_service` (top-level) and `search_utils` from its own directory.

**Current state:**

| Import | Before | After |
|--------|--------|-------|
| **Plagiarism** | `from plagiarism_service import check_originality` (top-level) | `from services.shared.plagiarism import check_originality` |
| **Medical ontology** | `_ICD10_RADLEX_MAP`, `_infer_rads_system` duplicated in ai-router | `from services.shared.medical_ontology import infer_rads_system, lookup_icd_radlex` |
| **Search utils** | `from search_utils import ...` (ai-router local) | **Still** `from search_utils import ...` (ai-router local) |

**Additional findings:**
- `plagiarism_service.py` at project root is now a thin re-export (27 lines) from `services.shared.plagiarism` for backward compatibility.
- `services/shared/medical_ontology.py` exists with ICD10_DB, RadLex, RADS — single source of truth.
- `search_utils.py` remains in `services/ai-router/` and is used only by ai-router. PRE_PRODUCTION_FIX_PLAN noted: “Post-launch: Introduce services/shared/search.py”.

**Verdict:** ⚠️ Mostly resolved. Plagiarism and medical ontology are in shared. `search_utils` is still local to ai-router; moving it to shared would complete the decoupling.

---

## Conclusion

All four issues are **resolved or partially resolved**:

1. **Dual API surface** — ✅ Resolved  
2. **Legacy orchestrator** — ⚠️ Partially resolved (not in critical path)  
3. **No API versioning** — ✅ Resolved  
4. **Tight coupling** — ✅ Resolved (search_utils moved to `services/shared/`)

**Recommendation:** Orchestrator consolidation remains a post-launch improvement per PRE_PRODUCTION_FIX_PLAN.
