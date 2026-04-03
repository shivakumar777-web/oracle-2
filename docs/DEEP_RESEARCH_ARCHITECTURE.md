# Manthana Deep Research — Architecture (post-gap implementation)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Frontend wizard (domains → intent → depth → query)                         │
│  • subdomain_map + flat subdomains (compat)                                 │
│  • DomainSourcesProvider → GET /v1/config/domain-sources (SSR fallback TS)    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ POST /v1/deep-research/stream (SSE)
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  research-service — orchestrator                                            │
│  1. retrieve_merged_sources                                                 │
│     • Universal Search pills: services.shared.domain_sources                │
│     • Optional: decompose_query (planner) → parallel _retrieve_single rounds  │
│     • Domain rewrite: build_domain_query → Meili / Qdrant / Perplexica /      │
│       general SearXNG; PubMed/CT raw; scoped SearXNG uses original question   │
│  2. record_lesson (evolution JSONL)                                          │
│  3. score_sources + filter_low_quality (if deep)                            │
│  4. synthesize_research_report                                              │
│     • load_lessons → prompt memory block                                    │
│     • llm_with_fallback (Groq → OpenAI → Ollama)                             │
│     • parse JSON sections                                                   │
│     • extract_cited_indices → build_grounded_citations → remap [n] markers  │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │ SSE: log → section → citations → followup → done
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│  UI: WorkspaceThinkingState (SSE + optimistic simulated logs if sparse)      │
│      WorkspaceResultState (disclaimer + provider badge + sections/refs)      │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Key modules**

| Area | Location |
|------|----------|
| Domain source of truth | `services/shared/domain_sources.py` |
| Grounded citations | `services/research-service/citation_grounding.py` |
| Planner | `services/research-service/planner.py` |
| Scoring | `services/research-service/reflection.py` |
| LLM chain | `services/research-service/llm_router.py` |
| Lessons | `services/research-service/evolution.py` |
| Orchestration | `services/research-service/orchestrator.py` |
| Public config API | `GET /v1/config/domain-sources` |
| Staff insights | `GET /v1/research/insights` (JWT + staff role) |

**`deep` flag**

- `focused` depth forces fast path (`use_deep=False`): no decomposition, no scoring.
- Otherwise `deep=True` (default): decomposition (when query > 6 words and not focused) + scoring.
