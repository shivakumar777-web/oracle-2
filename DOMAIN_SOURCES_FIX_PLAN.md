# Domain-Specific Sources Fix Plan

**Date:** March 19, 2026  
**Status:** IMPLEMENTED  
**Issue:** When user selects a single domain (Ayurveda, Homeopathy, Siddha, Unani), the sources shown are generic/allopathy (PubMed, ClinicalTrials, generic Web) instead of domain-authentic sources.

---

## Investigation Summary

### Current Behavior
1. **Source routing** (`route_sources`) does NOT consider domain
2. **PubMed** and **ClinicalTrials** are added for ALL domains when evidence mode is gold/all/trials or enable_trials
3. **PubMed** = peer-reviewed Western medicine only
4. **ClinicalTrials.gov** = Western clinical trials only
5. **SearXNG** = correctly uses domain-specific category (ayurveda, homeopathy, siddha, unani) via CATEGORY_MAP
6. **RAG (MeiliSearch, Qdrant)** = generic index "medical_search" / "medical_documents" — content may be mixed
7. **should_prioritize_domain_sources** = reorders to boost domain URLs (ayush.gov.in, etc.) but cannot create domain content from allopathy-only sources

### Root Cause
- PubMed and ClinicalTrials are **allopathy-only** sources
- They are added regardless of selected domain
- Result: Ayurveda query shows PubMed/ClinicalTrials sources instead of ayush.gov.in, ccras.nic.in, etc.

### domain_intelligence.py Already Defines Domain-Specific Source Strategy
```python
# get_domain_specific_sources():
ALLOPATHY: ["pubmed", "clinical_trials", "meilisearch", "qdrant"]
AYURVEDA/SIDDHA: ["meilisearch", "qdrant", "ayush_portal"]  # NO pubmed/trials
HOMEOPATHY: ["meilisearch", "qdrant", "clinical_trials"]     # Some homeopathy trials
UNANI: ["meilisearch", "qdrant", "emro_who"]
```

---

## Fix Plan

### Fix 1: Domain-Gate PubMed and ClinicalTrials (Critical)
**File:** `services/oracle-service/routers/chat.py`

Only add PubMed and ClinicalTrials when `effective_domain == MedicalDomain.ALLOPATHY`.

```python
# Before adding PubMed:
if SourceStrategy.PUBMED in strategies and settings.ORACLE_ENABLE_PUBMED and effective_domain == MedicalDomain.ALLOPATHY:
    tasks["pubmed"] = ...

# Before adding ClinicalTrials:
if SourceStrategy.CLINICAL_TRIALS in strategies and settings.ORACLE_ENABLE_TRIALS:
    # ClinicalTrials: allopathy only (homeopathy has some trials but mostly Western)
    if effective_domain == MedicalDomain.ALLOPATHY or effective_domain == MedicalDomain.HOMEOPATHY:
        tasks["trials"] = ...
```

**Decision:** ClinicalTrials for HOMEOPATHY — domain_intelligence lists it. Keep for homeopathy. For Ayurveda, Siddha, Unani — exclude.

### Fix 2: Use effective_domain for SearXNG Category
**File:** `services/oracle-service/routers/chat.py`

Ensure we use `effective_domain.value` for category (already using domain.lower() which matches). Verify: `searxng_cat = CATEGORY_MAP.get(effective_domain.value, "medical")`

### Fix 3: Filter Allopathy-Only Sources for Non-Allopathy Domains (Defense in Depth)
**File:** `services/oracle-service/routers/chat.py`

When building `all_docs` and `sources_for_stream`, for non-allopathy domains, **exclude** sources from:
- `pubmed.ncbi.nlm.nih.gov`
- `clinicaltrials.gov`

This ensures even if they slip in, they won't be shown.

### Fix 4: Use Domain-Expanded Query for SearXNG
**File:** `services/oracle-service/routers/chat.py`

Currently: `fetch_searxng(message, searxng_cat, ...)` uses raw message.
Should use: `fetch_searxng(rag_query, searxng_cat, ...)` — rag_query is domain-expanded (e.g. "piles" → "arsha" for Ayurveda). This improves domain-specific search recall.

---

## Implementation Order

| Step | Task | Impact |
|------|------|--------|
| 1 | Domain-gate PubMed (allopathy only) | High |
| 2 | Domain-gate ClinicalTrials (allopathy + homeopathy) | High |
| 3 | Use domain-expanded query for SearXNG | Medium |
| 4 | Filter allopathy-only URLs from final sources for traditional domains | Medium (defense) |

---

## Verification

```bash
# Ayurveda — should NOT see PubMed/ClinicalTrials in sources
curl -s -X POST http://localhost:8100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"piles treatment","domain":"ayurveda","evidence":"gold"}' | grep -o '"source": "[^"]*"'

# Expect: Web, Meili, Qdrant — NOT PubMed, ClinicalTrials

# Allopathy — should see PubMed when evidence=gold
curl -s -X POST http://localhost:8100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"diabetes treatment","domain":"allopathy","evidence":"gold"}' | grep -o '"source": "[^"]*"'

# Expect: PubMed, Web, Meili, Qdrant
```

---

## Out of Scope (Future)

- Domain-specific RAG indexes (ayurveda_docs, homeopathy_docs) — requires indexing pipeline
- ayush_portal as dedicated source — would need API integration
