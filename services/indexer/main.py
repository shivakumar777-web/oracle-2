import sys
import os
import logging
from typing import Any, Dict, List, Optional

# Add project root to path for shared module access
PROJECT_ROOT = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "../..")
)
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

# Add ai-tools to path
AI_TOOLS = os.path.join(PROJECT_ROOT, "ai-tools")
if AI_TOOLS not in sys.path:
    sys.path.insert(0, AI_TOOLS)

import httpx
from fastapi import Body, Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import format_response, generate_request_id


logger = logging.getLogger("manthana-indexer")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class Document(BaseModel):
    title: str
    content: str
    source_url: str
    category: str
    date: Optional[str] = None


class BatchIndexRequest(BaseModel):
    documents: List[Document] = Field(..., max_length=100)


class IndexResponse(BaseModel):
    indexed: bool
    doc_id: str
    vector_id: str


class StatsResponse(BaseModel):
    meilisearch_count: int
    qdrant_count: int


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Indexer Service",
        description="Indexer for Meilisearch and Qdrant using biomedical embeddings.",
        version="1.0.0",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            os.getenv("FRONTEND_URL", "http://localhost:3001"),
            "http://localhost:3000",
            "http://localhost:3001",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    client = httpx.AsyncClient(timeout=30.0)
    model = SentenceTransformer("pritamdeka/S-PubMedBert-MS-MARCO")

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    async def ensure_qdrant_collection() -> None:
        try:
            await client.put(
                f"{settings.QDRANT_URL.rstrip('/')}/collections/medical_documents",
                json={
                    "vectors": {
                        "size": 768,
                        "distance": "Cosine",
                    }
                },
                headers={"Content-Type": "application/json"},
            )
        except Exception as exc:
            logger.warning(f"Failed to ensure Qdrant collection: {exc}")

    async def ensure_meili_index() -> None:
        try:
            await client.post(
                f"{settings.MEILISEARCH_URL.rstrip('/')}/indexes",
                json={"uid": "medical_search", "primaryKey": "id"},
                headers={
                    "Content-Type": "application/json",
                    "X-Meili-API-Key": settings.MEILISEARCH_KEY,
                },
            )
        except Exception:
            # Index may already exist; ignore
            pass

    @app.on_event("startup")
    async def startup_event():
        await ensure_qdrant_collection()
        await ensure_meili_index()

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the indexer service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="indexer",
            details=None,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Service information.",
    )
    async def info(request: Request):
        request_id = generate_request_id()
        data = {
            "service": "indexer",
            "embedding_model": "pritamdeka/S-PubMedBert-MS-MARCO",
            "model_type": "ml_validated",
            "validated": True,
        }
        payload = format_response(
            status="success",
            service="indexer",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    async def index_single_document(doc: Document, request_id: str) -> IndexResponse:
        vector = model.encode(doc.content).tolist()
        payload = {
            "title": doc.title,
            "content": doc.content,
            "source_url": doc.source_url,
            "category": doc.category,
            "date": doc.date,
        }
        try:
            meili_resp = await client.post(
                f"{settings.MEILISEARCH_URL.rstrip('/')}/indexes/medical_search/documents",
                json=[{"id": doc.source_url, **payload}],
                headers={
                    "Content-Type": "application/json",
                    "X-Meili-API-Key": settings.MEILISEARCH_KEY,
                },
            )
            meili_resp.raise_for_status()
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Failed to index in Meilisearch: {exc}"
            ) from exc

        try:
            qdrant_resp = await client.put(
                f"{settings.QDRANT_URL.rstrip('/')}/collections/medical_documents/points",
                json={
                    "points": [
                        {
                            "id": doc.source_url,
                            "vector": vector,
                            "payload": payload,
                        }
                    ]
                },
                headers={"Content-Type": "application/json"},
            )
            qdrant_resp.raise_for_status()
        except Exception as exc:
            raise HTTPException(
                status_code=502, detail=f"Failed to index in Qdrant: {exc}"
            ) from exc

        return IndexResponse(indexed=True, doc_id=doc.source_url, vector_id=doc.source_url)

    @app.post(
        "/index/document",
        response_model=BaseResponse,
        tags=["index"],
        description="Index a single document into Meilisearch and Qdrant.",
    )
    async def index_document(
        request: Request,
        doc: Document = Body(...),
    ):
        request_id = generate_request_id()
        try:
            result = await index_single_document(doc, request_id)
        except HTTPException as exc:
            error = ErrorDetail(
                code=exc.status_code,
                message=str(exc.detail),
                details=None,
            )
            payload = format_response(
                status="error",
                service="indexer",
                data=None,
                error=error.dict(),
                request_id=request_id,
            )
            return JSONResponse(status_code=exc.status_code, content=payload)

        payload = format_response(
            status="success",
            service="indexer",
            data=result.dict(),
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/index/batch",
        response_model=BaseResponse,
        tags=["index"],
        description="Batch index up to 100 documents at once.",
    )
    async def index_batch(
        request: Request,
        body: BatchIndexRequest,
    ):
        request_id = generate_request_id()
        results: List[Dict[str, Any]] = []
        for doc in body.documents:
            res = await index_single_document(doc, request_id)
            results.append(res.dict())
        payload = format_response(
            status="success",
            service="indexer",
            data={"results": results},
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    @app.get(
        "/stats",
        response_model=BaseResponse,
        tags=["core"],
        description="Return simple statistics on indexed documents.",
    )
    async def stats(request: Request):
        request_id = generate_request_id()
        meili_count = 0
        qdrant_count = 0
        try:
            meili_resp = await client.get(
                f"{settings.MEILISEARCH_URL.rstrip('/')}/indexes/medical_search/stats",
                headers={
                    "X-Meili-API-Key": settings.MEILISEARCH_KEY,
                },
            )
            if meili_resp.status_code == 200:
                meili_count = meili_resp.json().get("numberOfDocuments", 0)
        except Exception:
            pass
        try:
            qdrant_resp = await client.get(
                f"{settings.QDRANT_URL.rstrip('/')}/collections/medical_documents",
            )
            if qdrant_resp.status_code == 200:
                qdrant_count = qdrant_resp.json().get("result", {}).get("points_count", 0)
        except Exception:
            pass
        data = StatsResponse(
            meilisearch_count=meili_count,
            qdrant_count=qdrant_count,
        ).dict()
        payload = format_response(
            status="success",
            service="indexer",
            data=data,
            error=None,
            request_id=request_id,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

