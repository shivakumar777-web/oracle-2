# Manthana Web — Premium “Super Aggregator” Implementation

## What was implemented

1. **Multi-source Research Papers** (`/v1/search/papers`): PubMed, Semantic Scholar, Europe PMC (article search), OpenAlex, Crossref, **DOAJ**, **CORE**, SearXNG **science** + **medical**, optional **Wikidata** entity rows when thin, then **fallback** to SearXNG **general** with academic heuristics (`paperFallback` on rows / response).

2. **Shared paper detection** (`routers/paper_sources.py`): Broad `engine` + URL hints; used by `/v1/search` **tabCounts**.

3. **`enrich_result`**: Uses `engine_implies_peer()` for broader peer-reviewed detection from SearXNG.

4. **Main search `/v1/search` (page 1)**: Parallel SearXNG **images** + **videos** merged into preview strips and tab counts.

5. **Guidelines** (`/v1/search/guidelines`): Extra SearXNG **general** pass when results &lt; 8 (`guidelineFallback` on rows / response).

6. **Trials** (`/v1/search/trials`): SearXNG **medical** supplement when ClinicalTrials.gov returns &lt; 5 (`trialsFallback` on rows / response).

7. **PDFs tab**: Broader PDF detection; secondary SearXNG **medical** when thin.

8. **Circuit breakers**: OpenAlex, Crossref, Europe PMC, **DOAJ**, **CORE**, **Wikidata** (plus existing breakers).

9. **Aggregator helpers** (`routers/aggregator.py`): `merge_unique_by_url`, `infer_medical_category`.

10. **Clients**: `clients/doaj.py`, `clients/core.py`, `clients/wikidata.py`, `clients/base_search.py` (stub for future BASE API).

11. **Caching** (`cache.py`): `guidelines` / `pdfs` **3600s**; `papers` **1800s**; others per tab.

12. **Frontend** (`lib/api/web/types.ts`, `ResultCard.tsx`): Optional `paperFallback`, `guidelineFallback`, `trialsFallback`, `sourceBadge` on results; tab-level flags on `SearchResponse`.

13. **SearXNG** (`configs/searxng/settings.yml`): Comment block for optional native engines (e.g. arxiv) — enable only if your image supports them.

## Keys (all optional except Meili in production)

| Variable | Purpose |
|----------|---------|
| `NCBI_API_KEY` | PubMed 10 req/s (free) |
| `SEMANTIC_SCHOLAR_API_KEY` | Higher SS limits (free tier available) |
| `OPENALEX_MAILTO` | Polite User-Agent for OpenAlex/Crossref |
| `CORE_API_KEY` | Optional CORE API v3 Bearer token for higher limits (basic works without key) |

## Rebuild web-service

```bash
docker-compose build web-service && docker-compose up -d web-service
```

## Smoke checks

```bash
curl -sS "http://localhost:PORT/v1/search/papers?q=diabetes&page=1" | head -c 400
curl -sS "http://localhost:PORT/v1/search/guidelines?q=hypertension&page=1" | head -c 400
curl -sS "http://localhost:PORT/v1/search/trials?q=cancer&page=1" | head -c 400
```
