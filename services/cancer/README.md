# Manthana Cancer Service

The cancer microservice provides triage support for oral cavity images, skin lesions, and histopathology slides.

## Features

- FastAPI-based service on port **8104**
- Oral image classification into normal/precancerous/cancerous
- Skin lesion analysis with malignancy risk and ABCDE feature scores
- Basic histopathology tissue classification
- All results include an AI disclaimer and are not a substitute for clinical judgment

## Key Endpoints

- `GET /health` – service health
- `GET /info` – capabilities metadata
- `POST /analyze/oral` – oral cavity image classification
- `POST /analyze/skin` – lesion type, malignancy risk, ABCDE flags
- `POST /analyze/pathology` – histopathology tissue classification

## Running Locally

```bash
cd services/cancer
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8104
```

Swagger docs: `http://localhost:8104/docs`.

