# Manthana ECG Service

The ECG microservice analyzes ECG signals from CSV files or images using NeuroKit2.

## Features

- FastAPI-based async service on port **8102**
- CSV input (`time`, `voltage`) or ECG image input
- Extraction of heart rate, HRV, RR intervals, R-peak count
- Basic arrhythmia flags and signal quality estimate
- In-memory storage of analysis reports with retrievable summaries

## Key Endpoints

- `GET /health` – service health
- `GET /info` – metadata
- `POST /analyze/ecg` – CSV or image ECG analysis
- `POST /analyze/image` – explicit ECG image analysis
- `GET /report/{analysis_id}` – formatted clinical-style report

## Running Locally

```bash
cd services/ecg
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8102
```

The OpenAPI docs will be available at `http://localhost:8102/docs`.

