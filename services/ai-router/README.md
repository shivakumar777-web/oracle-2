# Manthana AI Router Service

The AI Router is the central orchestrator for the Manthana medical intelligence platform. All external requests are routed through this service, which then forwards them to the appropriate downstream microservices or combines search and LLM responses.

## Features

- FastAPI-based async service on port **8000**
- Centralized health check for all downstream services
- Automatic routing of uploaded medical data
- RAG-style query endpoint combining Meilisearch, Qdrant, and Ollama
- Streaming `/chat` endpoint designed for the Perplexica frontend
- Prometheus-compatible `/metrics` endpoint
- Circuit breaker per downstream service
- Request-level rate limiting and request IDs

## Key Endpoints

- `GET /health` – Router and downstream health summary
- `POST /analyze/auto` – Auto-detect file type and forward to the correct service
- `POST /query` – Enriched medical Q&A using search + LLM
- `POST /chat` – Streaming SSE chat endpoint for the frontend
- `GET /services` – Static description of all services and capabilities
- `GET /metrics` – Basic Prometheus metrics
- `GET /info` – Router metadata and disclaimer

## Configuration

Configuration is handled via environment variables (see `.env.example`) and parsed with `pydantic` settings from `services/shared/config.py`.

Important variables:

- `OLLAMA_URL` – base URL for the Ollama API
- `QDRANT_URL` – base URL for Qdrant
- `MEILISEARCH_URL` / `MEILISEARCH_KEY` – Meilisearch configuration
- `MAX_UPLOAD_MB` – maximum upload size in megabytes
- `RADIOLOGY_URL`, `ECG_URL`, …, `INDEXER_URL` – internal service URLs

## Running Locally

```bash
cd services/ai-router
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8000
```

The OpenAPI docs will be available at `http://localhost:8000/docs`.

