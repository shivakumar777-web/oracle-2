## Manthana – Medical Domain Intelligence Platform

Manthana is a vertical medical domain intelligence platform composed of multiple FastAPI microservices orchestrated by a central AI router. It integrates imaging, signal processing, NLP, cheminformatics, and Ayurvedic intelligence into a single deployable stack.

## Architecture

### Frontend (User Facing)
- Manthana UI → `frontend/manthana/` → port 3001  
  → Built with Next.js + Stitch AI designs  
  → The ONLY thing end users see

### Backend Services
- AI Router     → `services/ai-router/`      → port 8000
- ECG           → `services/ecg/`            → port 8102
- Eye           → `services/eye/`            → port 8103
- Cancer        → `services/cancer/`         → port 8104
- Pathology     → `services/pathology/`      → port 8105
- Brain         → `services/brain/`          → port 8106
- Segmentation  → `services/segmentation/`   → port 8107
- NLP           → `services/nlp/`            → port 8108
- Drug          → `services/drug/`           → port 8109
- Ayurveda      → `services/ayurveda/`       → port 8110
- Imaging Utils → `services/imaging-utils/`  → port 8111
- Indexer       → `services/indexer/`        → port 8112
- Auth          → `services/auth/`           → port 8200

### Internal Search Engine (Never Exposed)
- Perplexica    → `backend/search-engine/perplexica/` → port 3000
- SearxNG       → `search/searxng/`       → port 4000
- Meilisearch   → `search/meilisearch/`   → port 7700

### Infrastructure
- Traefik       → `gateway/traefik/`         → port 80/443
- Qdrant        → `storage/qdrant/`          → port 6333
- n8n           → `orchestration/n8n/`       → port 5678
- Grafana       → `observability/grafana/`   → port 3002
- Prometheus    → `observability/prometheus/` → port 9090
- Loki          → `observability/loki/`      → port 3100
- Ollama        → `ai/ollama/`               → port 11434

All services share common utilities in `services/shared` (config, models, helpers) and follow a consistent JSON response envelope with request IDs and rate limiting.

### Prerequisites

- Docker and Docker Compose
- For production: see **[DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md)** — especially `MEILI_MASTER_KEY`
- Python 3.10 (if running services outside Docker)
- Ollama installed with the required models (e.g. `meditron`, `llama3.2`)

### Quick Start

```bash
cd medical-search-engine
cp .env.example .env
make build
make up
make health
```

Once running:

- Router health: `http://localhost:8000/health`
- Versioned API: `http://localhost:8000/v1` (e.g. `/v1/search`, `/v1/query`)
- Router docs: `http://localhost:8000/docs`
- Individual service docs (examples):
  - ECG: `http://localhost:8102/docs`
  - NLP: `http://localhost:8108/docs`
  - Ayurveda: `http://localhost:8110/docs`

### Development

Each service directory contains:

- `main.py` – FastAPI application
- `requirements.txt` – Python dependencies
- `Dockerfile` – container build
- `.env.example` – service-specific environment variables
- `README.md` – service documentation

You can run a service locally with:

```bash
cd services/ecg
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --reload --port 8102
```

### Testing

Tests are placed under `tests/` and can be executed with:

```bash
# Full suite (requires optional deps for drug/ecg/eye)
PYTHONPATH=. pytest tests

# Critical path tests only (no ML deps)
make test-fast
# or: PYTHONPATH=. pytest tests -m "not integration" -v --cov=...

# Exclude integration tests (rdkit, neurokit2, pydicom)
PYTHONPATH=. pytest tests -m "not integration"
```

Coverage target: 55%+ on api, orchestrator, plagiarism_service, services/shared, services/ai-router.

### Disclaimer

All AI analyses provided by Manthana are for research and educational use only and are **not** a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider for clinical decisions.

