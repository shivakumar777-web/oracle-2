# Manthana Brain Service

The brain microservice performs basic analysis of MRI, EEG, and functional connectivity data.

## Features

- FastAPI-based service on port **8106**
- MRI volume and anomaly estimation using NiBabel and simple heuristics
- EEG band power analysis using MNE (delta, theta, alpha, beta, gamma)
- fMRI connectivity matrices using Nilearn
- Standard disclaimer on all responses

## Key Endpoints

- `GET /health` – service health
- `GET /info` – capabilities
- `POST /analyze/mri` – NIfTI/DICOM-like MRI analysis
- `POST /analyze/eeg` – EDF/CSV EEG processing
- `POST /analyze/connectivity` – fMRI connectivity analysis

## Running Locally

```bash
cd services/brain
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8106
```

Docs: `http://localhost:8106/docs`.

