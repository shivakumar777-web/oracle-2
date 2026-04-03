# Manthana Imaging Utils Service

The imaging-utils microservice provides shared utilities for medical image conversion, metadata extraction, and preprocessing.

## Features

- FastAPI-based service on port **8111**
- DICOM to PNG conversion with common windowing presets
- NIfTI to PNG slice export and volume info
- Metadata extraction for DICOM, NIfTI, and PNG images
- Normalization and resizing of images for downstream AI models

## Key Endpoints

- `GET /health` – service health
- `GET /info` – presets and service metadata
- `POST /convert/dicom-to-png` – DICOM to PNG with windowing
- `POST /convert/nifti-to-png` – NIfTI slice conversion
- `POST /metadata/extract` – metadata extraction
- `POST /preprocess/normalize` – normalization and resizing

## Running Locally

```bash
cd services/imaging-utils
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8111
```

Docs: `http://localhost:8111/docs`.

