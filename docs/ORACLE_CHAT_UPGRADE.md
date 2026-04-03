# Oracle Chat Upgrade Guide

**Version:** 1.0  
**Last Updated:** March 2026

This document describes the Oracle Chat upgrade implemented across Phases 1–4 of the Manthana Medical AI Platform.

---

## Overview

The Oracle chat has been upgraded from a closed-book RAG (Meilisearch + Qdrant only) to a **hybrid open-book architecture** with:

- **Real-time web search** (SearXNG)
- **PubMed** for peer-reviewed literature
- **ClinicalTrials.gov** for active trials
- **Query intelligence** (classification, expansion, source routing)
- **Emergency detection** with fast-track and disclaimers
- **Enhanced citations** with trust scores

---

## API Reference

### POST /v1/chat

**Request body:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `message` | string | required | User message (1–4000 chars) |
| `history` | array | `[]` | Previous conversation turns |
| `intensity` | string | `"auto"` | `auto` \| `quick` \| `clinical` \| `deep` |
| `persona` | string | `"auto"` | `auto` \| `patient` \| `clinician` \| `researcher` \| `student` |
| `evidence` | string | `"auto"` | `auto` \| `gold` \| `all` \| `guidelines` \| `trials` |
| `domain` | string | `"allopathy"` | Medical domain context |
| `enable_web` | boolean | `true` | Include SearXNG web results |
| `enable_trials` | boolean | `false` | Include ClinicalTrials.gov |
| `experiment_id` | string | `null` | A/B test experiment identifier |
| `lang` | string | `"en"` | Language code |

**Streaming response (SSE):**

| Event type | Payload | Description |
|------------|---------|-------------|
| `progress` | `{stage, status}` | Source completion status |
| `emergency` | `{is_emergency: true}` | Emergency query detected |
| `sources` | `{sources: [...]}` | Citation metadata (id, title, url, trustScore) |
| `token` | `{message: {content}}` | Streaming text chunk |
| `done` | `{}` | Stream complete |

---

## Query Intelligence

### Classification

Queries are classified into:

- **emergency** — Urgent/acute (chest pain, stroke, overdose, etc.) → fast-track, RAG only
- **clinical_trial** — Trial-related → adds ClinicalTrials.gov
- **drug** — Drug info, interactions, dosing
- **general** — Broad medical questions

### Source Routing

| Query type | Sources used |
|------------|--------------|
| Emergency | Meilisearch, Qdrant only |
| Clinical trial | + ClinicalTrials.gov, PubMed |
| Gold/All evidence | + PubMed |
| enable_web | + SearXNG |

---

## Emergency Handling

When an emergency query is detected:

1. **Fast-track** — Only RAG (Meili + Qdrant); no external APIs
2. **Disclaimer** — System prompt instructs LLM to begin with: *"If this is a medical emergency, call emergency services (112 in India, 911 in US) immediately."*
3. **Stream event** — `{type: "emergency", is_emergency: true}` emitted for frontend

---

## Performance

- **Per-source timeout:** 8 seconds (6s for RAG)
- **Resilient fetch:** Timeouts and errors return empty results; chat continues
- **Re-ranking:** Heuristic relevance (query-term overlap) before context assembly

---

## A/B Testing

Pass `experiment_id` in the request to tag it for analytics. Logged as `chat_experiment` event with `experiment_id` and `request_id`.

---

## Environment Variables

Oracle Chat uses the shared Manthana config (`services/shared/config.py`). All required variables are **already configured** in `.env` and passed through `docker-compose.yml`:

| Variable | Source | Purpose |
|----------|--------|---------|
| `GROQ_API_KEY` | `.env` → ai-router | Groq API for chat |
| `MEILI_MASTER_KEY` | `.env` → Meilisearch + ai-router | Meilisearch auth |
| `QDRANT_URL` | docker-compose | `http://qdrant:6333` |
| `MEILISEARCH_URL` | docker-compose | `http://meilisearch:7700` |
| `SEARXNG_URL` | docker-compose | `http://searxng:8080` |

No additional setup required. PubMed and ClinicalTrials.gov need no API keys.

---

## File Reference

| Component | File |
|-----------|------|
| Query classifier | `services/ai-router/query_intelligence.py` |
| Source router | `services/ai-router/source_router.py` |
| Re-ranker | `services/ai-router/reranker.py` |
| PubMed client | `services/ai-router/pubmed_client.py` |
| Chat endpoint | `services/ai-router/main.py` |
| Chat models | `services/shared/models.py` |
