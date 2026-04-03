# Manthana Production Launch Upgrade Plan

**Document:** Master fix plan for EXPERT_REVIEW concerns (Section 7.2)  
**Scope:** Clinical trials, herb-drug evidence, audit trail, India-focused model validation  
**Target:** Production-ready medical product with valid clinical resources  
**Date:** March 2025

---

## Part 1: Deep Dive — EXPERT_REVIEW Concerns Verification

### 1.1 Model Validation (Indian Population)

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "Some models (e.g. skin) may not be validated for target populations (e.g. Indian)" | **TRUE** | `services/cancer/main.py`: Skin model uses `marmal88/skin_disease` (HAM10000). Disclaimer: "Trained on HAM10000 dataset. Not validated for oral pathology." No explicit Indian population disclaimer for skin. |
| "UPGRADE_PLAN acknowledges this; caps and disclosures are in place" | **PARTIAL** | Eye service (`services/eye/main.py:248`) has explicit: "Independent clinical validation is required for the Indian population." Skin/cancer service lacks Indian-specific disclosure. Confidence caps: Eye heuristic 0.65, ML 0.82; Cancer oral 0.60; Skin ML uses model output. |

**What exists:**
- Eye: Indian population disclaimer when ML model used; heuristic fallback with 0.65 cap
- Cancer skin: HAM10000 disclaimer; heuristic fallback for oral
- Radiology: CheXpert + MIMIC-CXR validation (Western datasets)
- Pathology: Patch-level disclaimer; no population-specific note

**Gap:** No India-specific validation disclosure for skin, radiology, or pathology. No geographical integration (CTRI, Indian datasets).

---

### 1.2 Clinical Trials

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "Stub only. No real ClinicalTrials.gov integration" | **TRUE** | `services/ai-router/main.py:1682-1703`: Returns `trials: []`, `total: 0`, with note "Clinical trials search is a stub. Integrate ClinicalTrials.gov API for production." |

**What exists:**
- Frontend calls `POST /clinical-trials/search` with `{query, filters}`
- Backend returns empty array and stub note
- SearXNG config includes clinicaltrials.gov as a search engine (web search only, not structured API)
- `search_utils.py` has `clinicaltrials.gov` in trust scoring

**Gap:** Zero API integration. No CTRI (India) integration.

---

### 1.3 Herb–Drug Interactions

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "Combines herb lookup + drug interaction; logic is heuristic, not evidence-based" | **TRUE** | `services/ai-router/main.py:1636-1679`: Calls Ayurveda `/search/herb` (2-herb in-memory DB) + Drug `/interaction/check/enriched` with **herb passed as drug_a** — herbs are not drugs; OpenFDA won't match. Drug service uses heuristic matrix + OpenFDA for drug-drug only. |

**What exists:**
- Ayurveda `HERB_DATABASE`: 2 herbs (ashwagandha, amalaki) with rasa, guna, virya, indications, contraindications
- Drug `/interaction/check`: Heuristic matrix ("No known major interaction in this simplified model")
- Drug `/interaction/check/enriched`: OpenFDA adverse events for drug-drug; herb passed as drug yields no meaningful match
- No herb→constituent→drug interaction mapping
- No evidence-based herb-drug database

**Gap:** Logic is fundamentally flawed (herb ≠ drug in FDA/OpenFDA). No PubMed, Natural Medicines, HEDRINE, or similar evidence integration.

---

### 1.4 Audit Trail

| Claim | Verdict | Evidence |
|-------|---------|----------|
| "No logging of which model produced which finding for a given patient/study. Important for regulatory compliance." | **TRUE** | `request_id` exists per request; `models_used` passed in `/analyze/auto` response. No persistent storage. No table/schema for: `(request_id, patient_id, study_id, model_id, finding, confidence, timestamp)`. `patient_id` is optional in `AutoAnalyzeRequest` but never logged. |

**What exists:**
- `request_id` in response headers and payload
- `models_used` in analysis response (ephemeral)
- `patient_id` optional in `services/shared/models.py:177` — "Optional patient identifier for audit trails" — but never persisted
- Structured `json_log` for errors; no structured audit log for successful analyses

**Gap:** No audit log table, no persistence, no regulatory-grade traceability.

---

## Part 2: Master Upgrade Plan

### Phase A — Clinical Trials (Valid, Production-Ready Integration)

#### A1. ClinicalTrials.gov API v2 Integration

**API:** `https://clinicaltrials.gov/api/v2/studies`  
**Docs:** https://clinicaltrials.gov/data-api/about-api  
**Format:** JSON, pagination via `pageToken`, `pageSize` (max 1000)

**Implementation:**

1. **New module:** `services/ai-router/clinical_trials.py`
   - `async def fetch_clinical_trials_gov(query: str, filters: dict, page: int = 1) -> dict`
   - Query params: `query.cond`, `query.term`, `query.titles`, `filter.overallStatus` (RECRUITING, COMPLETED, etc.)
   - Filter by `filter.countries` = "India" when `filters.get("country") == "IN"` or `filters.get("india_only")`
   - Parse: `nctId`, `briefTitle`, `overallStatus`, `phase`, `enrollmentInfo`, `conditions`, `locations`
   - Redis cache: key `ctgov:{sha256(query+filters)}`, TTL 3600

2. **Response schema** (align with frontend `ClinicalTrialResult`):
   ```json
   {
     "nctId": "NCT01234567",
     "title": "Study title",
     "status": "RECRUITING",
     "phase": "PHASE2",
     "conditions": ["Condition 1"],
     "locations": [{"city": "Mumbai", "country": "India"}],
     "url": "https://clinicaltrials.gov/study/NCT01234567"
   }
   ```

#### A2. CTRI (Clinical Trials Registry – India) Integration

**Source:** https://ctri.nic.in/  
**API:** No public REST API. Options:
- **Option 1:** Scrape/search via `https://ctri.nic.in/Clinicaltrials/searchbyctri.php` (fragile, ToS risk)
- **Option 2:** Use **Bioregistry** for CTRI metadata: `https://bioregistry.io/api/registry/ctri?format=json`
- **Option 3:** **WHO ICTRP** aggregates CTRI — check `https://www.who.int/clinical-trials-registry-platform` for API
- **Recommended:** Implement ClinicalTrials.gov first (has India filter). Add CTRI as Phase 2 via WHO ICTRP or manual CSV import if available.

**India-focused filter:**
- ClinicalTrials.gov: `filter.countries=India`
- Frontend: Add "India only" toggle; pass `filters: { country: "IN" }`

#### A3. Open-Source Resources

| Resource | URL | Use |
|----------|-----|-----|
| ClinicalTrials.gov API v2 | https://clinicaltrials.gov/data-api/api/v2/studies | Primary trials source |
| AACT (Aggregate Analysis of ClinicalTrials.gov) | https://aact.ctti-clinicaltrials.org/ | PostgreSQL snapshot for advanced queries (optional) |
| WHO ICTRP | https://www.who.int/clinical-trials-registry-platform | Global + India trials (check API availability) |

---

### Phase B — Herb–Drug Evidence-Based Upgrade

#### B1. Problem Summary

Current flow is **conceptually wrong**: herb name → drug interaction API. Herbs are not in OpenFDA as drugs. Need: **herb → constituents → known interactions → evidence**.

#### B2. Evidence-Based Data Sources

| Source | Type | Access | Evidence Level |
|--------|------|--------|----------------|
| **PubMed** | Literature | E-utilities API (free) | Systematic reviews, case reports |
| **HEDRINE** | Herb-drug DB | https://hedrine.ulb.be/ — check for API/export | Validated + theoretical |
| **NaPDI** | Natural product–drug | https://repo.napdi.org/ — experiments | Research database |
| **HerbComb** | Herb-ingredient | GitHub: 19900321/HerbComb | 13,217 ingredient-ingredient interactions |
| **Natural Medicines (NatMed Pro)** | Commercial | Subscription | Gold standard — not free |
| **LiverTox** | NIH | https://www.ncbi.nlm.nih.gov/books/NBK547852/ | Drug/herb hepatotoxicity |

#### B3. Implementation Strategy

**Step 1 — Herb constituent mapping (Ayurveda service):**

- Extend `HERB_DATABASE` with `constituents` and `standard_names`:
  ```python
  "ashwagandha": {
    "names": ["ashwagandha", "withania somnifera"],
    "constituents": ["withaferin A", "withanolides"],  # for interaction lookup
    "standard_names": ["Withania somnifera", "Ashwagandha"],  # for PubMed
    ...
  }
  ```
- Use **PubMed E-utilities** to fetch herb-drug interaction literature:
  - `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&term=ashwagandha+warfarin+interaction&retmax=5`
  - Return PMIDs + titles; optional abstract via `efetch`

**Step 2 — Curated herb-drug interaction table:**

- Create `services/shared/herb_drug_evidence.py`:
  - Static table of **evidence-based** interactions from literature (manual curation from systematic reviews)
  - Schema: `(herb_standard_name, drug_name, severity, evidence_level, citation_pmid, mechanism)`
  - Start with 20–50 high-signal pairs (e.g. St. John's wort–warfarin, Ginkgo–anticoagulants, Ashwagandha–sedatives)
  - Source: PMC3575928, PMC3339338, Natural Standard reviews

**Step 3 — Drug interaction for constituents:**

- Map herb → constituents. For each constituent, check if it appears in DrugBank/OpenFDA (some phytochemicals are indexed).
- Drug service: Add optional `constituent_mode` for natural product names when querying OpenFDA.

**Step 4 — Response schema upgrade:**

```json
{
  "herb": "ashwagandha",
  "drug": "warfarin",
  "herb_info": { "rasa": [...], "indications": [...] },
  "interaction": {
    "severity": "moderate",
    "evidence_level": "systematic_review",
    "mechanism": "CYP3A4 induction; may reduce anticoagulant effect",
    "citations": [
      {"pmid": "12345678", "title": "...", "url": "https://pubmed.ncbi.nlm.nih.gov/12345678"}
    ],
    "recommendation": "Monitor INR; consider dose adjustment. Consult prescriber."
  },
  "data_sources": ["curated_evidence", "pubmed"],
  "disclaimer": "Evidence from literature. Not a substitute for clinical judgment."
}
```

#### B4. Open-Source / Free Resources

| Resource | URL | Use |
|----------|-----|-----|
| PubMed E-utilities | https://www.ncbi.nlm.nih.gov/books/NBK25501/ | Herb-drug interaction literature |
| PMC Open Access | https://www.ncbi.nlm.nih.gov/pmc/ | Full-text systematic reviews |
| HerbComb (GitHub) | https://github.com/19900321/HerbComb | Ingredient interactions (Python) |
| NaPDI | https://repo.napdi.org/ | Natural product–drug experiments |
| HEDRINE | https://hedrine.ulb.be/ | Check for data export/API |

---

### Phase C — Audit Trail (Regulatory Compliance)

#### C1. Requirements

- Log: `request_id`, `patient_id` (if provided), `study_id` (if provided), `service`, `model_id`, `endpoint`, `findings` (summary), `timestamp`, `user_id` (future)
- Persistence: Queryable for compliance audits
- Retention: Configurable (e.g. 7 years for medical)

#### C2. Implementation

**Option A — SQLite (minimal, no new infra):**

- New table in `manthana_audit.db`:
  ```sql
  CREATE TABLE analysis_audit (
    id INTEGER PRIMARY KEY,
    request_id TEXT NOT NULL,
    patient_id TEXT,
    study_id TEXT,
    service TEXT NOT NULL,
    model_id TEXT,
    endpoint TEXT,
    findings_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );
  ```
- Middleware in ai-router: After successful `/analyze/*`, insert row.
- No PII in `findings_summary` — store only labels + confidence, not raw images.

**Option B — PostgreSQL (production):**

- Same schema in existing Postgres if available.
- Index on `request_id`, `patient_id`, `created_at`.

**Option C — Loki-structured logs (already have Loki):**

- Emit structured JSON log for each analysis:
  ```json
  {"event": "analysis_complete", "request_id": "...", "patient_id": "...", "service": "radiology", "model_id": "densenet-chest", "findings_count": 3}
  ```
- Query via Loki/LogQL. No new DB. Retention via Loki config.
- **Limitation:** Logs may not be as durable as DB for long-term compliance.

**Recommended:** Option A (SQLite) for MVP; migrate to Postgres when scaling. Emit to Loki in parallel for observability.

#### C3. Schema in `services/shared/models.py`

- Add `AuditLogEntry` model.
- Add `write_audit_log(request_id, patient_id, service, model_id, findings)` in shared utils.
- Call from ai-router after each analysis success.

---

### Phase D — India-Focused Geographical Integration

#### D1. Model Validation Disclosures

| Service | Current | Upgrade |
|---------|---------|---------|
| **Eye (DR)** | "Independent clinical validation required for Indian population" | Keep. Add: `validation_note: "EyePACS/US cohort. DermaCon-IN or India-specific validation pending."` |
| **Cancer (skin)** | "Trained on HAM10000" | Add: `"Not validated for Indian skin tones or regional disease distribution (e.g. vitiligo, leprosy). DermaCon-IN validation pending."` |
| **Radiology** | "CheXpert + MIMIC-CXR" | Add: `"US/European cohorts. India-specific TB, melioidosis validation pending."` |
| **Pathology** | Patch-level only | Add: `"Training data predominantly Western. India-specific histopathology validation pending."` |

#### D2. India-Specific Datasets & Resources

| Resource | Description | Use |
|----------|-------------|-----|
| **DermaCon-IN** | 5,450 images, 3,002 patients, South India | Future skin model fine-tuning; cite as "India validation pending" |
| **Fitzpatrick17k** | Skin tone diversity | Bias analysis; disclose Fitzpatrick distribution |
| **CTRI** | 105,000+ Indian trials | Trials search with India filter |
| **ICMR** | Indian Council of Medical Research | Guidelines, datasets |
| **AYUSH** | Ministry of AYUSH | Ayurvedic pharmacopoeia, herb standardization |

#### D3. Geographical Features

1. **Clinical trials:** `filters.country = "IN"` → only India sites
2. **Search:** Boost Indian sources (already in `search_utils.py` trust tiers: ctri.nic.in, icmr.nic.in, etc.)
3. **Herb-drug:** Prioritize Indian herbs (ashwagandha, turmeric, tulsi, etc.) in curated table
4. **UI:** "India-focused" toggle in clinical tools; show CTRI link when relevant

#### D4. Confidence Caps for Non-Validated Populations

| Model | India-Validated | Cap | Disclosure |
|-------|-----------------|-----|------------|
| Eye DR (ML) | No | 0.82 | "Screening aid. Indian validation pending." |
| Skin (ML) | No | 0.80 | "HAM10000. Indian skin tones/diseases not validated." |
| Radiology | No | 0.90 | "Western cohorts. India-specific conditions not validated." |
| Oral (heuristic) | No | 0.60 | Already in place |

---

## Part 3: Implementation Order

| Phase | Task | Effort | Priority |
|-------|------|--------|----------|
| **A** | ClinicalTrials.gov API v2 integration | 2–3 days | P0 |
| **A** | India filter for trials | 0.5 day | P0 |
| **B** | Curated herb-drug evidence table (20–50 pairs) | 2–3 days | P0 |
| **B** | PubMed integration for herb-drug literature | 1–2 days | P1 |
| **B** | Fix herb-drug flow (constituent mapping, not herb-as-drug) | 1 day | P0 |
| **C** | Audit log (SQLite + middleware) | 1–2 days | P0 |
| **D** | India validation disclaimers (all services) | 0.5 day | P1 |
| **D** | DermaCon-IN / India dataset citation in docs | 0.5 day | P2 |
| **A** | CTRI via WHO ICTRP or Bioregistry (Phase 2) | 1–2 days | P2 |

---

## Part 4: Verification Checklist

Before production launch:

- [x] `/clinical-trials/search` returns real trials from ClinicalTrials.gov
- [x] India filter returns only India-site trials
- [x] `/herb-drug/analyze` uses evidence-based table + PubMed; no herb-as-drug
- [x] Audit log table populated for every analysis
- [x] All vision services have India validation disclaimer
- [x] Confidence caps enforced for non-India-validated models
- [x] Integration tests for clinical trials, herb-drug, audit (`tests/test_production_upgrade.py`) log

---

## Part 5: References

- ClinicalTrials.gov API: https://clinicaltrials.gov/data-api/about-api  
- CTRI: https://ctri.nic.in/  
- DermaCon-IN: https://arxiv.org/html/2506.06099v2  
- Herb-drug systematic review: https://ncbi.nlm.nih.gov/pmc/articles/PMC3575928/  
- HEDRINE: https://hedrine.ulb.be/  
- PubMed E-utilities: https://www.ncbi.nlm.nih.gov/books/NBK25501/  

---

## Part 6: Implementation Status (Completed)

| Phase | Status | Notes |
|-------|--------|-------|
| **A** Clinical Trials | ✅ DONE | ClinicalTrials.gov API v2, India filter, Redis cache |
| **B** Herb-Drug Evidence | ✅ DONE | Curated table (35+ pairs), PubMed E-utilities, no herb-as-drug |
| **C** Audit Trail | ✅ DONE | SQLite `analysis_audit`, write on /analyze/*, GET /v1/audit/log |
| **D** India Integration | ✅ DONE | validation_note + disclaimers (eye, cancer, radiology, pathology); confidence caps |

### Production-Ready Summary

- **Clinical trials:** Real API integration; India-only filter; 25 results per page
- **Herb-drug:** Evidence-based; citations (PMID); safetyLevel; data_sources
- **Audit:** Persistent log; query by request_id/patient_id/service
- **India:** All vision services disclose non-India validation; caps: Eye 0.82, Skin 0.80, Radiology 0.90

### Run Tests

```bash
PYTHONPATH=. .venv/bin/pytest tests/test_production_upgrade.py -v
```

---

*This plan addresses all four EXPERT_REVIEW Section 7.2 concerns with concrete, implementable steps. All P0/P1 items implemented.*
