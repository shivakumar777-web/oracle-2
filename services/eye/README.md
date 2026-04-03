# Manthana Eye Service

The eye microservice provides basic diabetic retinopathy (DR) grading and OCT scan analysis.

## Features

- FastAPI-based service on port **8103**
- Accepts fundus and OCT images (PNG/JPG)
- Returns DR grade (0–4), severity label, confidence, and recommendation
- Uses deterministic heuristics to approximate grades; can be swapped with a deep model later

## Key Endpoints

- `GET /health` – service health
- `GET /info` – service metadata and DR grading scheme
- `POST /analyze/fundus` – DR analysis for fundus images
- `POST /analyze/oct` – basic OCT analysis reusing DR pipeline

## Running Locally

```bash
cd services/eye
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8103
```

Swagger docs: `http://localhost:8103/docs`.

