# M5 (Oracle) vs Deep Research — end-to-end status

## M5 — five-domain chat (integrative **comparison**)

| Layer | Status |
|--------|--------|
| **UI** | `frontend-manthana/.../app/page.tsx` — `mode === "m5"` calls `streamM5`. Domain pills include **M5 — All 5** (`DomainPills.tsx`). `SearchBar` links to `/?mode=m5`. |
| **API client** | `lib/api/oracle/client.ts` — `POST {ORACLE_BASE}/chat/m5`, SSE events `m5_domain`, `m5_summary`. |
| **Backend** | `services/oracle-service/routers/m5.py` — parallel `MedicalDomain` ×5, Meilisearch + Qdrant RAG, PubMed/ClinicalTrials for Allopathy, `m5_engine.build_m5_response_from_parts` + `stream_m5_response`. **Also** duplicated in `services/ai-router/main.py` (`/v1/chat/m5`) if that deployment is used. |
| **Flags** | `ORACLE_ENABLE_M5`; if `m5_engine` import fails, endpoint returns “M5 engine not available”. |

**Product role:** Side-by-side answers from **all five** systems + integrative summary — conversational, Oracle UX.

---

## Deep Research — user-chosen domains (integrative **cited synthesis**)

| Layer | Status |
|--------|--------|
| **UI** | `app/deep-research/page.tsx` — **multi-select** any combination; **All five** / **Clear** shortcuts; integrative badge when **≥2** domains. |
| **API** | `useDeepResearch` → `POST {RESEARCH_BASE}/deep-research/stream` with `domains[]` + Universal Search `sources[]`. |
| **Backend** | `services/research-service/orchestrator.py` — `retrieve_merged_sources` + `synthesize_research_report`; `integrative_mode` when multiple domains; cross-domain source bonus per `INTEGRATIVE_CROSS_DOMAIN_CORE`. |

**Product role:** One structured report with citations, scoped to **whichever** traditions the user selected (not always all five).

---

## Summary

- **M5:** Full five-way package on **Oracle home** — **built** (subject to oracle-service + `m5_engine` + env).  
- **Deep Research:** **Any combo** (including all five via “All five”) — **built**; pipeline is **research-service**, not Oracle M5.
