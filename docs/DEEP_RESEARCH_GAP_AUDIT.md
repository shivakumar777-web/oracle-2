# Deep Research — Gap Audit (implementation status)

*All gaps below are **RESOLVED** in `/opt/manthana` as of this document. Prior descriptive audit text was superseded after end-to-end implementation.*

---

## Gap 1 — Subdomain map preserved on wire — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `services/shared/models.py` (`subdomain_map`, validator flattening), `orchestrator.py` (`format_subdomain_context`, `build_deep_research_prompt`), `useDeepResearch.ts`, `lib/api/research/types.ts` |
| **Functions** | `format_subdomain_context`, model validator `_flatten_subdomains_from_map` |
| **Tests** | (covered via integration with request model) |

---

## Gap 2 — Grounded citation extraction — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `citation_grounding.py`, `orchestrator.py` (`synthesize_research_report`, SSE citations) |
| **Functions** | `extract_cited_indices`, `build_grounded_citations`, `apply_grounded_citations_to_sections`, `remap_citation_markers_in_sections` |
| **Tests** | `services/research-service/tests/test_grounded_citations.py` |

---

## Gap 3 — Single source of truth for domain sources — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `services/shared/domain_sources.py`, `orchestrator.py` (imports), `routers/research.py` (`GET /config/domain-sources`), `lib/api/research/domain-sources.ts`, `contexts/DomainSourcesContext.tsx`, `universal-search-sources.ts` (SSR fallback + comment), `src/app/deep-research/layout.tsx` |
| **Functions** | `get_sources_for_domains` |
| **Tests** | (config endpoint contract via manual/API) |

---

## Gap 4 — Query decomposition / planner — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `planner.py`, `orchestrator.py` (`retrieve_merged_sources`, `_retrieve_single`, decomposition branch) |
| **Functions** | `decompose_query` |
| **Tests** | `services/research-service/tests/test_planner.py` |

---

## Gap 5 — Source quality scoring — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `reflection.py`, `orchestrator.py` (`_apply_scoring_and_cap`, SSE scoring log) |
| **Functions** | `score_sources`, `filter_low_quality` |
| **Tests** | `services/research-service/tests/test_reflection.py` |

---

## Gap 6 — Self-evolving memory (domain lessons) — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `evolution.py`, `orchestrator.py` (`record_lesson` after retrieval, `load_lessons` in prompt), `routers/research.py` (`GET /research/insights`), `auth.py` (`require_staff_user`) |
| **Functions** | `record_lesson`, `load_lessons`, `format_lessons_for_prompt`, `read_recent_lessons` |

---

## Gap 7 — Domain-aware query rewriting — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `orchestrator.py` |
| **Functions** | `build_domain_query`, `DOMAIN_QUERY_TEMPLATES`; wired in `_retrieve_single` (core vs PubMed vs scoped) |

---

## Gap 8 — Multi-provider LLM fallback — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `llm_router.py`, `config.py` (OpenAI/Ollama env), `orchestrator.py` (`synthesize_research_report`), `services/shared/models.py` (`provider_used`), frontend `types.ts`, `client.ts`, `WorkspaceResultState.tsx` |
| **Functions** | `llm_with_fallback`, `_call_groq`, `_call_openai`, `_call_ollama` |

---

## Gap 9 — Activity simulator wired — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `WorkspaceThinkingState.tsx`, `activity-log-simulator.ts` (existing `generateActivitySequence`) |
| **Behavior** | If SSE log &lt; 3 entries, interleave simulated pending lines (styled + pulse) |

---

## Gap 10 — `deep` flag repurposed; `stream` removed — **RESOLVED**

| Item | Detail |
|------|--------|
| **Files** | `services/shared/models.py`, `orchestrator.py` (`use_deep`, focused → fast path), `useDeepResearch.ts`, `types.ts` |
| **Behavior** | `deep` controls decomposition + scoring; `stream` removed (streaming is route-based) |

---

## Product safety & UX (final steps)

- **Non-dismissable disclaimer** + **provider badge** in `WorkspaceResultState.tsx`.
- **Architecture** diagram: `docs/DEEP_RESEARCH_ARCHITECTURE.md`.

---

## Tests run

```bash
PYTHONPATH=services/research-service:. pytest services/research-service/tests/ -v
```

*(Use a venv with `pytest`, `pytest-asyncio`, `pydantic-settings`, `groq`, `openai`, `httpx` as needed.)*
