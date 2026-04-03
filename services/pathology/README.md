# Manthana Pathology Service

The pathology microservice provides digital pathology analysis for whole-slide images (WSI) and tiles.

## Features

- FastAPI-based service on port **8105**
- Slide-level analysis: tissue type, cell density, abnormality score, regions of interest
- Tile-level analysis for 224x224 patches
- All responses include a standardized medical disclaimer

## Key Endpoints

- `GET /health` – service health
- `GET /info` – capabilities
- `POST /analyze/slide` – analyze WSI or large tile
- `POST /analyze/tile` – analyze 224x224 patch

## Running Locally

```bash
cd services/pathology
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8105
```

Docs: `http://localhost:8105/docs`.

