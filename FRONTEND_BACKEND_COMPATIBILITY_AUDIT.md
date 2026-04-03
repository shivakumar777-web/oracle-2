# Frontend–Backend Compatibility Re-Audit

**Date:** 2026-03-17  
**Scope:** `/opt/manthana` (manthana backend + `frontend-manthana` Next.js app)  
**Assumption:** Frontend calls `NEXT_PUBLIC_API_URL` (default `http://localhost:8000` or `http://45.130.165.198:8000`) — i.e. **ai-router** on port 8000.  
**Note:** `api.py` (manthana-api) runs on port 8001 and is **not** the primary frontend target.

---

## 1. Port & Routing Summary

| Service        | Port | Exposed as        | Frontend target? |
|----------------|------|-------------------|------------------|
| ai-router      | 8000 | api.${DOMAIN}     | **Yes** (primary)|
| manthana-api   | 8001 | search.api.${DOMAIN} | No (legacy)   |

Frontend `API_BASE` = `NEXT_PUBLIC_API_URL ?? "http://localhost:8000"` → all API calls go to **ai-router:8000**.

---

## 2. Endpoint-by-Endpoint Verification

### 2.1 Endpoints that EXIST on ai-router (8000) and work

| Endpoint | Method | Status | Notes |
|----------|--------|--------|-------|
| `/health` | GET | ✅ | Returns `format_response("success", ...)` with `data.router`, `data.services`. No `timestamp`. |
| `/search` | GET | ✅ | Returns `format_response` with `data.results[]`, `data.synthesis` (null), `data.images`, `data.videos`. Field `snippet` not aliased as `content` — frontend may expect both. |
| `/query` | POST | ✅ | Body: `{query\|question}`. Returns `format_response` with `data.answer`, `data.sources`. |
| `/deep-research` | POST | ✅ | Body: `{query, domains, subdomains, intent, depth}`. Returns sections, citations. |
| `/analyze/auto` | POST | ⚠️ | **Exists** but response shape **wrong**. See §3.1. |
| `/report/enrich` | POST | ✅ | Body: `{modality, findings[]}`. Returns enriched_findings, rads_score, triage_level, impression. |
| `/plagiarism/check` | POST | ✅ | Body: `{text, scanId}`. Returns **raw** `PlagiarismResult` (no envelope): `originalityScore`, `matches`, etc. Frontend calls this path — **correct**. |
| `/services` | GET | ✅ | Lists downstream services. |
| `/search/autocomplete` | GET | ✅ | Returns `{suggestions: []}` (no envelope). |
| `/info` | GET | ✅ | Service info. |
| `/metrics` | GET | ✅ | Prometheus metrics. |

### 2.2 Endpoints that EXIST only on api.py (8001) — NOT on ai-router

Frontend calls **8000**; these return **404** when hit via ai-router:

| Endpoint | In api.py | In ai-router | Frontend calls |
|----------|-----------|--------------|----------------|
| `/categories` | ✅ | ❌ | `getCategories()` → `/categories` |
| `/icd10/suggest` | ✅ | ❌ | `suggestICD10()` → `/icd10/suggest?q=...` |
| `/report/pdf` | ✅ | ❌ | `fetchReportPDF()` → `/report/pdf` |

### 2.3 Endpoints that EXIST only on microservices — NOT on ai-router

| Endpoint | Service | Port | In ai-router | Frontend calls |
|----------|---------|------|--------------|----------------|
| `/analyze/xray` | radiology | 8101 | ❌ | Via `/analyze/auto` only (auto-routes). No direct `/analyze/xray` on 8000. |
| `/analyze/xray/heatmap` | radiology | 8101 | ❌ | `fetchHeatmap()` → `/analyze/xray/heatmap` → **404** |
| `/interaction/check` | drug | 8109 | ❌ | `checkDrugInteraction()` → `/drug-interaction/check` (different path!) |
| `/interaction/check/enriched` | drug | 8109 | ❌ | `fetchEnrichedDrugInteraction()` → `/interaction/check/enriched` → **404** |
| `/snomed/lookup` | nlp | 8108 | ❌ | `fetchSnomedLookup()` → `/snomed/lookup?term=...` → **404** |

### 2.4 Endpoints that DO NOT EXIST anywhere

| Frontend path | Frontend function | Backend |
|---------------|-------------------|---------|
| `/herb-drug/analyze` | `checkHerbDrugSafety(herb, drug)` | ❌ None. Ayurveda has `/search/herb` only. |
| `/clinical-trials/search` | `findClinicalTrials(query, filters)` | ❌ None. |
| `/drug-interaction/check` | `checkDrugInteraction(drugs)` | Drug has `/interaction/check` with `{drugs: [...]}` — different path, not exposed via ai-router. |

---

## 3. Response Shape Mismatches

### 3.1 `/analyze/auto` — Wrong data shape

**Current ai-router response:**
```json
{
  "status": "success",
  "service": "ai-router",
  "data": {
    "service_used": "radiology",
    "endpoint": "/analyze/xray",
    "downstream_status": 200,
    "result": {
      "status": "success",
      "service": "radiology",
      "data": {
        "pathologies": [{"name": "...", "score": 0.9, "high_confidence": true, "critical": false}],
        "model_type": "ml_validated",
        "validated": true,
        "supports_heatmap": true
      }
    }
  }
}
```

**Frontend expects** (`AnalysisResponse`):
```json
{
  "service_used": "radiology",
  "modality": "chest_xray",
  "findings": [
    {"label": "...", "confidence": 85, "severity": "critical", "model_type": "ml"}
  ],
  "report": "...",
  "models_used": [...],
  "supports_heatmap": true,
  "validated": true
}
```

**Mismatches:**
- `data.result` nested structure vs flat `data`
- `pathologies` vs `findings` (name→label, score→confidence 0–100, critical→severity)
- Missing `modality`, `report`, `models_used`

### 3.2 Envelope format

**Frontend `ApiEnvelope`** (api.ts):
```ts
status: "success" | "error";
service: string;
data: T;
error: string | null;
request_id: string;
timestamp: string;  // ← Frontend expects this
```

**Backend `format_response`** (services/shared/utils.py):
- `status`: "success" | "error" ✅ (audit said "ok" — incorrect; frontend uses "success")
- No `timestamp` field ❌

### 3.3 SNOMED lookup — Field name mismatch

**NLP service returns:**
```json
{"concept_id": "...", "term": "..."}
```

**Frontend `SnomedConcept` expects:**
```ts
{ conceptId: string; preferredTerm: string; }
```

---

## 4. CORS

**ai-router** (`services/ai-router/main.py`):
- `allow_origins`: `FRONTEND_URL`, `localhost:3000`, `localhost:3001`
- `allow_methods`: `*`
- `allow_headers`: `*`

✅ **CORS is correctly configured.**

---

## 5. Corrections to Original Audit

| Original audit claim | Re-audit finding |
|---------------------|------------------|
| Frontend expects `status: "ok"` | **Incorrect.** Frontend `ApiEnvelope` uses `status: "success" \| "error"`. |
| `POST /originality/check` missing | **Incorrect.** Frontend calls `/plagiarism/check` (exists on ai-router). |
| Drug interaction expects `{drug_a, drug_b}` | **Partially correct.** `fetchEnrichedDrugInteraction` uses `drug_a`/`drug_b`; drug service `/interaction/check/enriched` accepts that. But ai-router does not expose it. |
| `/herb/safety` | **Incorrect path.** Frontend calls `/herb-drug/analyze` with `{herb, drug}`. |
| `/trials/search` | **Incorrect path.** Frontend calls `/clinical-trials/search` with `{query, filters}`. |

---

## 6. Final Fix Plan

### Phase 1 — Add missing ai-router proxy routes (high priority)

These endpoints exist on microservices or api.py but are not exposed on ai-router:8000.

| # | Route | Action |
|---|-------|--------|
| 1 | `GET /categories` | Proxy to `api.py:8001/categories` or add static list in ai-router (same as api.py `CATEGORIES`). |
| 2 | `GET /icd10/suggest?q=...` | Proxy to `api.py:8001/icd10/suggest` or embed `ICD10_DB` logic in ai-router. |
| 3 | `POST /report/pdf` | Proxy to `api.py:8001/report/pdf` (body passthrough). |
| 4 | `POST /analyze/xray` | Proxy to `radiology:8101/analyze/xray` (multipart file). |
| 5 | `POST /analyze/xray/heatmap` | Proxy to `radiology:8101/analyze/xray/heatmap` (multipart file). |
| 6 | `POST /interaction/check` | Proxy to `drug:8109/interaction/check`; body `{drugs: [...]}`. Frontend calls `/drug-interaction/check` — either add alias or change frontend to `/interaction/check`. |
| 7 | `POST /interaction/check/enriched` | Proxy to `drug:8109/interaction/check/enriched`; body `{drug_a, drug_b}`. |
| 8 | `GET /snomed/lookup?term=...` | Proxy to `nlp:8108/snomed/lookup`; **map response** `concept_id`→`conceptId`, `term`→`preferredTerm` for frontend. |

### Phase 2 — New endpoints (medium priority)

| # | Route | Action |
|---|-------|--------|
| 9 | `POST /herb-drug/analyze` | Implement in ai-router or ayurveda: combine herb lookup + drug interaction logic; body `{herb, drug}`. |
| 10 | `POST /clinical-trials/search` | Implement stub or integrate ClinicalTrials.gov API; body `{query, filters}`. |

### Phase 3 — Response shape fixes (high priority)

| # | Item | Action |
|---|------|--------|
| 11 | `/analyze/auto` response | Add post-processing in ai-router: flatten `result.data` into `AnalysisResponse`; map `pathologies`→`findings` (name→label, score×100→confidence, critical→severity); add `modality` from route; add `report` (e.g. LLM summary or concatenated findings); add `models_used` from service metadata. |
| 12 | `format_response` | Add optional `timestamp` field (ISO 8601 UTC) for envelope compatibility. |
| 13 | SNOMED response | In ai-router proxy, map `concept_id`→`conceptId`, `term`→`preferredTerm` before returning. |

### Phase 4 — Path aliases (low priority)

| # | Frontend path | Backend path | Action |
|---|---------------|--------------|--------|
| 14 | `/drug-interaction/check` | `/interaction/check` | Add ai-router route `/drug-interaction/check` that proxies to drug `/interaction/check` with same body. |

---

## 7. Summary Table (Re-Audited)

| Endpoint | On ai-router | On api.py | On microservice | Frontend calls | Fix |
|----------|--------------|-----------|-----------------|----------------|-----|
| GET /health | ✅ | ✅ | — | ✅ | None |
| GET /search | ✅ | ✅ | — | ✅ | None |
| GET /categories | ❌ | ✅ | — | ✅ | Add proxy |
| GET /icd10/suggest | ❌ | ✅ | — | ✅ | Add proxy |
| POST /query | ✅ | — | — | ✅ | None |
| POST /deep-research | ✅ | — | — | ✅ | None |
| POST /analyze/auto | ✅ | — | — | ✅ | Fix shape |
| POST /analyze/xray | ❌ | — | radiology | — | Add proxy (for direct calls) |
| POST /analyze/xray/heatmap | ❌ | — | radiology | ✅ | Add proxy |
| POST /report/enrich | ✅ | ✅ | — | ✅ | None |
| POST /report/pdf | ❌ | ✅ | — | ✅ | Add proxy |
| POST /plagiarism/check | ✅ | — | — | ✅ | None |
| POST /interaction/check | ❌ | — | drug | — | Add proxy |
| POST /interaction/check/enriched | ❌ | — | drug | ✅ | Add proxy |
| POST /drug-interaction/check | ❌ | — | drug | ✅ | Add proxy (alias) |
| POST /herb-drug/analyze | ❌ | — | — | ✅ | Implement |
| POST /clinical-trials/search | ❌ | — | — | ✅ | Implement |
| GET /snomed/lookup | ❌ | — | nlp | ✅ | Add proxy + field map |

---

## 8. Implementation Order

1. **Phase 1** — Proxies for `/categories`, `/icd10/suggest`, `/report/pdf`, `/analyze/xray`, `/analyze/xray/heatmap`, `/interaction/check`, `/interaction/check/enriched`, `/snomed/lookup`.
2. **Phase 3** — Normalize `/analyze/auto` response; add `timestamp` to envelope; fix SNOMED field names.
3. **Phase 2** — Implement `/herb-drug/analyze`, `/clinical-trials/search`.
4. **Phase 4** — Add `/drug-interaction/check` alias if frontend is not updated.
