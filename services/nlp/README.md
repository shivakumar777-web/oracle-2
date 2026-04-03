# Manthana NLP Service

The NLP microservice provides medical question answering, entity extraction, report summarization, and ICD-10 suggestion capabilities.

## Features

- FastAPI-based async service on port **8108**
- Integration with Ollama (meditron and llama3.2 models)
- Medical Q&A with mandatory disclaimer
- Lightweight rule-based medical entity extraction
- Report summarization and ICD-10 suggestion via LLM

## Key Endpoints

- `GET /health` – service health
- `GET /info` – configuration and model details
- `POST /query/medical` – medical Q&A (meditron)
- `POST /extract/entities` – extract diseases, drugs, symptoms, procedures
- `POST /summarize/report` – summarize radiology/pathology/clinical reports
- `POST /classify/icd` – suggest ICD-10 codes
- `GET /models` – list available Ollama models

## Configuration

Configured via `.env` (see `.env.example`):

- `OLLAMA_URL` – base URL for Ollama
- `MEDITRON_MODEL` – primary QA model
- `SUMMARY_MODEL` – summarization model
- `LOG_LEVEL`, `MAX_UPLOAD_MB` – service tuning

## Running Locally

```bash
cd services/nlp
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8108
```

The OpenAPI docs will be available at `http://localhost:8108/docs`.

