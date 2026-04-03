# Manthana Segmentation Service

The segmentation microservice provides automatic and interactive segmentation utilities for medical images.

## Features

- FastAPI-based service on port **8107**
- Automatic threshold-based segmentation
- Interactive segmentation with point prompts (approximated)
- Organ-specific segmentation with volume estimation
- Returns base64-encoded PNG masks and contour coordinates

## Key Endpoints

- `GET /health` – service health
- `GET /info` – capabilities
- `POST /segment/auto` – automatic segmentation
- `POST /segment/interactive` – point-prompted segmentation
- `POST /segment/organ` – organ-specific segmentation with area in cm²

## Running Locally

```bash
cd services/segmentation
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8107
```

Docs: `http://localhost:8107/docs`.

