# Manthana Radiology Service

The radiology microservice provides AI-assisted analysis of chest X-ray images and DICOM studies using `torchxrayvision` DenseNet models.

## Features

- FastAPI-based async service on port **8101**
- Support for PNG/JPG and DICOM (`.dcm`) inputs
- Pathology confidence scores with high-confidence and critical flags
- DICOM-specific endpoint that returns key metadata fields
- Standardized JSON envelope and medical disclaimer

## Key Endpoints

- `GET /health` – service health status and model load flag
- `GET /info` – model details, device, thresholds
- `GET /conditions` – list of detectable chest conditions
- `POST /analyze/xray` – generic X-ray (PNG/JPG/DICOM) analysis
- `POST /analyze/dicom` – strict DICOM analysis with metadata

## Configuration

Configured via `.env` (see `.env.example`):

- `LOG_LEVEL` – logging verbosity
- `MAX_UPLOAD_MB` – maximum upload size in MB
- `ENABLE_GPU` – set `true` to enable CUDA if available
- `DEVICE` – optional manual device override

## Running Locally

```bash
cd services/radiology
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8101
```

The OpenAPI docs will be available at `http://localhost:8101/docs`.

