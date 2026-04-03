# Manthana Drug Service

The drug microservice provides cheminformatics utilities including SMILES analysis, basic toxicity estimation, similarity search, and interaction checks.

## Features

- FastAPI-based service on port **8109**
- RDKit-backed molecular property computation
- Lipinski Rule of 5 evaluation
- Heuristic toxicity scoring
- Simple interaction matrix and similarity search using Tanimoto similarity

## Key Endpoints

- `GET /health` – service health
- `GET /info` – capabilities and known drugs
- `POST /analyze/smiles` – compute MW, LogP, HBD/HBA, TPSA, Lipinski pass/fail, toxicity
- `POST /search/drug` – lookup by drug name
- `POST /interaction/check` – interaction matrix for 2–10 drugs
- `POST /similarity/find` – similar compounds to a query SMILES

## Running Locally

```bash
cd services/drug
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8109
```

Swagger docs: `http://localhost:8109/docs`.

