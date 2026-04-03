# Manthana Indexer Service

The indexer microservice ingests crawled medical documents into Meilisearch and Qdrant with biomedical embeddings.

## Features

- FastAPI-based service on port **8112**
- Uses `pritamdeka/S-PubMedBert-MS-MARCO` sentence-transformer for 768-dim embeddings
- Indexes full text into Meilisearch for keyword search
- Stores vectors and metadata in Qdrant for semantic search

## Key Endpoints

- `GET /health` – service health
- `GET /info` – model and configuration details
- `POST /index/document` – index a single document
- `POST /index/batch` – batch index up to 100 documents
- `GET /stats` – document counts from Meilisearch and Qdrant

## Running Locally

```bash
cd services/indexer
cp .env.example .env
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8112
```

Docs: `http://localhost:8112/docs`.

