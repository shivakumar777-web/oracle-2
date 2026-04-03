# Manthana API Changelog

**Format:** [Keep a Changelog](https://keepachangelog.com/en/1.0.0/)  
**Versioning:** API follows `/v1/` prefix; breaking changes will increment to `/v2/` when introduced.

---

## [Unreleased]

### Added

- `POST /v1/report/enrich` — Enrich imaging findings with ICD-10, RadLex, RADS, LLM impression
- `GET /v1/audit/log` — Query audit trail (admin/compliance)
- `GET /v1/me` — Current user from JWT (Better Auth)

### Changed

- All `/v1/` endpoints return consistent envelope: `{status, service, data, error, request_id, timestamp}`
- `/v1/search/autocomplete` — Now wrapped in envelope; `data.suggestions`
- `/v1/icd10/suggest` — Now wrapped in envelope; `data.query`, `data.suggestions`

---

## [1.0.0] / 2026-03

### Added

- **Search:** `GET /v1/search` — Medical web search with trust scoring
- **Search:** `GET /v1/search/autocomplete` — Search suggestions
- **Query:** `POST /v1/query` — RAG-style Q&A
- **Deep Research:** `POST /v1/deep-research` — Structured research with citations
- **Chat:** `POST /v1/chat` — Streaming chat
- **Clinical:** `POST /v1/analyze/auto` — Auto-route to radiology, eye, cancer, etc.
- **Clinical:** `POST /v1/analyze/xray`, `/v1/analyze/xray/heatmap`, `/v1/analyze/dicom`, etc.
- **Plagiarism:** `POST /v1/plagiarism/check` — Originality check
- **Reports:** `POST /v1/report/enrich` — Enrich findings with ICD-10/RadLex
- **Tools:** `GET /v1/icd10/suggest` — ICD-10 autocomplete
- **Tools:** `POST /v1/report/pdf` — Generate PDF report
- **Tools:** `POST /v1/drug-interaction/check`, `POST /v1/herb-drug/analyze`, etc.
- **Core:** `GET /health`, `GET /info`, `GET /metrics` — Health and observability

### Response Envelope

All successful responses:

```json
{
  "status": "success",
  "service": "ai-router",
  "data": { ... },
  "error": null,
  "request_id": "uuid",
  "timestamp": "2026-03-17T12:00:00Z"
}
```

Error responses:

```json
{
  "status": "error",
  "service": "ai-router",
  "data": null,
  "error": {
    "code": 400,
    "message": "...",
    "details": { ... }
  },
  "request_id": "uuid",
  "timestamp": "2026-03-17T12:00:00Z"
}
```

---

## Breaking Changes

- **v1.0.0:** All routes moved under `/v1/` prefix. Legacy `/search`, `/query` without prefix are deprecated.
- **Autocomplete:** Previously returned `{suggestions: []}`. Now returns envelope with `data.suggestions`. Frontend already handles both.
- **ICD-10:** Previously returned `{query, suggestions}`. Now returns envelope with `data.query`, `data.suggestions`.

---

*For deployment and security, see `DEPLOYMENT_CHECKLIST.md` and `COMPLIANCE.md`.*
