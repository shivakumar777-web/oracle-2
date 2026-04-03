# Manthana Ayurveda Service

The Ayurveda microservice provides Prakriti/Vikriti analysis, herb and formulation lookup, and classical query handling backed by an LLM.

## Features

- FastAPI-based async service on port **8110**
- Deterministic Prakriti scoring engine based on questionnaire attributes
- Simple Vikriti (imbalance) detection from symptom lists
- Herb and formulation lookups from an internal knowledge base
- Classical query and modern correlation via Ollama
- Standard disclaimer appended to all responses

## Key Endpoints

- `GET /health` – service health
- `GET /info` – metadata and available questions
- `POST /analyze/prakriti` – compute Vata/Pitta/Kapha percentages and dominant dosha
- `POST /analyze/vikriti` – detect current imbalance and root tendencies
- `POST /search/herb` – multilingual herb search with Rasa/Guna/Virya/Vipaka
- `POST /search/formulation` – classical formulations for conditions
- `POST /query/classical` – LLM-based answers with classical context
- `POST /correlate/modern` – Ayurveda ↔ modern medicine correlations

## Running Locally

```bash
cd services/ayurveda
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8110
```

The OpenAPI docs will be available at `http://localhost:8110/docs`.

