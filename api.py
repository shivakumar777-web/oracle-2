from fastapi import FastAPI, HTTPException, Request, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import time
import logging
import uvicorn
from orchestrator import manthana_search, init_indexes

# ── Logging ───────────────────────────────────────────────
logging.basicConfig(level=logging.INFO)
log = logging.getLogger("manthana-api")

# ── App Init ──────────────────────────────────────────────
app = FastAPI(
    title="Manthana API",
    description="India's Medical Intelligence Search Engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# ── CORS ──────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Request logging middleware ────────────────────────────
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = round(time.time() - start, 3)
    log.info(
        f"{request.method} {request.url.path} "
        f"→ {response.status_code} ({elapsed}s)"
    )
    return response

# ── Request Models ────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    category: Optional[str] = "medical"
    force_ai: Optional[bool] = False

# ═══════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════

@app.get("/")
async def root():
    return {
        "product": "Manthana",
        "tagline": "Churning the ocean of medical knowledge",
        "version": "1.0.0",
        "status": "operational",
        "endpoints": {
            "search_GET":  "/search?q=your+query",
            "search_POST": "/search",
            "health":      "/health",
            "docs":        "/docs"
        }
    }

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "manthana-api",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ")
    }

@app.get("/search")
async def search_get(
    q: str = Query(..., description="Medical search query"),
    category: str = Query("medical", description="Search category"),
    force_ai: bool = Query(False, description="Force AI synthesis")
):
    if not q or len(q.strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query too short. Minimum 2 characters."
        )
    if len(q) > 500:
        raise HTTPException(
            status_code=400,
            detail="Query too long. Maximum 500 characters."
        )
    try:
        result = await manthana_search(
            query=q.strip(),
            category=category,
            force_ai=force_ai
        )
        return JSONResponse(content=result)
    except Exception as e:
        log.error(f"Search error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search pipeline error: {str(e)}"
        )

@app.post("/search")
async def search_post(body: SearchRequest):
    if not body.query or len(body.query.strip()) < 2:
        raise HTTPException(
            status_code=400,
            detail="Query too short. Minimum 2 characters."
        )
    try:
        result = await manthana_search(
            query=body.query.strip(),
            category=body.category,
            force_ai=body.force_ai
        )
        return JSONResponse(content=result)
    except Exception as e:
        log.error(f"Search error: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Search pipeline error: {str(e)}"
        )

@app.get("/categories")
async def categories():
    return {
        "categories": [
            {"id": "medical",      "label": "All Medical"},
            {"id": "ayurveda",     "label": "Ayurveda"},
            {"id": "homeopathy",   "label": "Homeopathy"},
            {"id": "siddha",       "label": "Siddha"},
            {"id": "unani",        "label": "Unani"},
            {"id": "naturopathy",  "label": "Naturopathy"},
            {"id": "science",      "label": "Research & Science"},
            {"id": "regulatory",   "label": "Regulatory (CDSCO/AYUSH)"},
            {"id": "general",      "label": "General Web"}
        ]
    }

# ═══════════════════════════════════════════════════════════
# STARTUP
# ═══════════════════════════════════════════════════════════

@app.on_event("startup")
async def startup():
    log.info("🔱 Manthana API starting...")
    init_indexes()
    log.info("✅ Manthana API ready at http://0.0.0.0:8000")

# ═══════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8000,
        reload=False,
        workers=2,
        log_level="info"
    )
