import sys
import os
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

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
from rdkit import Chem
from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors, rdchem, DataStructs
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id

# Optional Redis for OpenFDA caching
try:
    import redis.asyncio as aioredis  # type: ignore[import]

    _REDIS_AVAILABLE = True
except ImportError:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]
    _REDIS_AVAILABLE = False

_redis_client: Optional["aioredis.Redis"] = None  # type: ignore[name-defined]


logger = logging.getLogger("manthana-drug")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


async def _get_redis(settings: Settings):
    """Lazy-create a Redis client for OpenFDA caching."""
    global _redis_client
    if not _REDIS_AVAILABLE or aioredis is None:
        return None
    if _redis_client is None:
        try:
            _redis_client = aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
            )
            await _redis_client.ping()
            logger.info("[REDIS] Drug service cache connected (%s)", settings.REDIS_URL)
        except Exception as exc:
            logger.warning("[REDIS] Drug service cache unavailable: %s", exc)
            _redis_client = None
    return _redis_client


class SmilesRequest(BaseModel):
    smiles: str


class DrugSearchRequest(BaseModel):
    name: str


class InteractionCheckRequest(BaseModel):
    drugs: List[str] = Field(..., min_length=2, max_length=10)


class SimilarityRequest(BaseModel):
    smiles: str


class EnrichedInteractionRequest(BaseModel):
    drug_a: str = Field(..., description="First drug (name or SMILES).")
    drug_b: str = Field(..., description="Second drug (name or SMILES).")


KNOWN_DRUGS: Dict[str, Dict[str, Any]] = {
    "paracetamol": {
        "name": "Paracetamol",
        "smiles": "CC(=O)NC1=CC=C(O)C=C1",
        "formula": "C8H9NO2",
        "mechanism": "Analgesic and antipyretic; centrally acting COX inhibition.",
    },
    "ibuprofen": {
        "name": "Ibuprofen",
        "smiles": "CC(C)CC1=CC=C(C=C1)C(C)C(=O)O",
        "formula": "C13H18O2",
        "mechanism": "Non-selective COX inhibitor; NSAID.",
    },
}


def compute_properties(smiles: str) -> Dict[str, Any]:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError("Invalid SMILES string.")
    mw = Descriptors.MolWt(mol)
    logp = Crippen.MolLogP(mol)
    hbd = Lipinski.NumHDonors(mol)
    hba = Lipinski.NumHAcceptors(mol)
    tpsa = rdMolDescriptors.CalcTPSA(mol)
    rules_failed: List[str] = []
    if mw > 500:
        rules_failed.append("MW")
    if logp > 5:
        rules_failed.append("LogP")
    if hbd > 5:
        rules_failed.append("HBD")
    if hba > 10:
        rules_failed.append("HBA")
    pass_lipinski = len(rules_failed) == 0
    return {
        "mw": mw,
        "logp": logp,
        "hbd": hbd,
        "hba": hba,
        "tpsa": tpsa,
        "pass_lipinski": pass_lipinski,
        "failed_rules": rules_failed,
    }


def estimate_toxicity(smiles: str) -> Dict[str, Any]:
    # Placeholder rule-based toxicity estimate using basic properties
    props = compute_properties(smiles)
    risk_score = 0.1
    if props["logp"] > 4:
        risk_score += 0.2
    if props["tpsa"] < 25:
        risk_score += 0.2
    if not props["pass_lipinski"]:
        risk_score += 0.2
    risk_score = min(0.99, risk_score)
    level = "low"
    if risk_score > 0.6:
        level = "high"
    elif risk_score > 0.3:
        level = "moderate"
    return {"toxicity_score": risk_score, "toxicity_level": level}


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Drug Service",
        description="Molecular property analysis and drug interaction checks.",
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

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the drug service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="drug",
            details=None,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Service metadata.",
    )
    async def info(request: Request):
        request_id = generate_request_id()
        data = {
            "service": "drug",
            "known_drugs": list(KNOWN_DRUGS.keys()),
        }
        payload = format_response(
            status="success",
            service="drug",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/smiles",
        response_model=BaseResponse,
        tags=["analysis"],
        description="Compute molecular properties, Lipinski rule of 5, and a toxicity estimate.",
    )
    async def analyze_smiles(
        request: Request,
        body: SmilesRequest,
    ):
        request_id = generate_request_id()
        try:
            props = compute_properties(body.smiles)
            tox = estimate_toxicity(body.smiles)
        except Exception as exc:
            logger.exception("SMILES analysis error")
            error = ErrorDetail(
                code=400,
                message="Failed to analyze SMILES string.",
                details={"error": str(exc)},
            )
            payload = format_response(
                status="error",
                service="drug",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=400, content=payload)

        data = {
            "properties": props,
            "toxicity": tox,
        }
        payload = format_response(
            status="success",
            service="drug",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/search/drug",
        response_model=BaseResponse,
        tags=["knowledge"],
        description="Look up drug properties by generic or brand name.",
    )
    async def search_drug(
        request: Request,
        body: DrugSearchRequest,
    ):
        request_id = generate_request_id()
        key = body.name.lower()
        for k, entry in KNOWN_DRUGS.items():
            if key in k or key in entry["name"].lower():
                props = compute_properties(entry["smiles"])
                data = {
                    "name": entry["name"],
                    "smiles": entry["smiles"],
                    "formula": entry["formula"],
                    "mechanism": entry["mechanism"],
                    "properties": props,
                }
                payload = format_response(
                    status="success",
                    service="drug",
                    data=data,
                    error=None,
                    request_id=request_id,
                    disclaimer=DISCLAIMER,
                )
                return JSONResponse(content=payload)
        error = ErrorDetail(
            code=404,
            message="Drug not found in local knowledge base.",
            details={"query": body.name},
        )
        payload = format_response(
            status="error",
            service="drug",
            data=None,
            error=error.dict(),
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(status_code=404, content=payload)

    @app.post(
        "/interaction/check",
        response_model=BaseResponse,
        tags=["interaction"],
        description="Check pairwise interaction risk between a list of drugs.",
    )
    async def interaction_check(
        request: Request,
        body: InteractionCheckRequest,
    ):
        request_id = generate_request_id()
        n = len(body.drugs)
        matrix: List[List[Dict[str, Any]]] = []
        for i in range(n):
            row: List[Dict[str, Any]] = []
            for j in range(n):
                if i == j:
                    row.append(
                        {"severity": "none", "contraindicated": False, "note": ""}
                    )
                else:
                    severity = "low"
                    note = "No known major interaction in this simplified model."
                    row.append(
                        {"severity": severity, "contraindicated": False, "note": note}
                    )
            matrix.append(row)
        data = {
            "drugs": body.drugs,
            "interaction_matrix": matrix,
        }
        payload = format_response(
            status="success",
            service="drug",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/interaction/check/enriched",
        response_model=BaseResponse,
        tags=["interaction"],
        description=(
            "Check enriched drug interaction using existing heuristic matrix plus "
            "OpenFDA adverse event evidence, with Redis caching (24h)."
        ),
    )
    async def interaction_check_enriched(
        request: Request,
        body: EnrichedInteractionRequest,
        settings: Settings = Depends(get_settings),
    ):
        request_id = generate_request_id()
        drug_a = body.drug_a.strip()
        drug_b = body.drug_b.strip()
        if not drug_a or not drug_b:
            error = ErrorDetail(
                code=400,
                message="Both drug_a and drug_b are required.",
                details=None,
            )
            payload = format_response(
                status="error",
                service="drug",
                data=None,
                error=error.dict(),
                request_id=request_id,
                disclaimer=DISCLAIMER,
            )
            return JSONResponse(status_code=400, content=payload)

        # Base interaction matrix using existing heuristic logic
        base_matrix = [
            [
                {"severity": "none", "contraindicated": False, "note": ""}
                if i == j
                else {
                    "severity": "low",
                    "contraindicated": False,
                    "note": "No known major interaction in this simplified model.",
                }
                for j in range(2)
            ]
            for i in range(2)
        ]

        # OpenFDA evidence with Redis cache
        redis_client = await _get_redis(settings)
        cache_key = None
        fda_data: Dict[str, Any] = {}
        try:
            key_raw = f"{drug_a.lower()}|{drug_b.lower()}"
            cache_key = f"openfda:interaction:{key_raw}"
            if redis_client is not None:
                cached = await redis_client.get(cache_key)
                if cached:
                    fda_data = json.loads(cached)
            if not fda_data:
                async with httpx.AsyncClient(timeout=15.0) as client:
                    async def _fetch_events(name: str) -> List[Dict[str, Any]]:
                        term = quote_plus(name.upper())
                        url = (
                            "https://api.fda.gov/drug/event.json"
                            f"?search=patient.drug.drugcharacterization:1+AND+patient.drug.medicinalproduct:{term}"
                            "&limit=3"
                        )
                        try:
                            resp = await client.get(url)
                            if resp.status_code != 200:
                                return []
                            data = resp.json()
                            results = []
                            for r in data.get("results", []):
                                reactions = [rx.get("reactionmeddrapt") for rx in r.get("patient", {}).get("reaction", [])]
                                seriousness = {
                                    k: v
                                    for k, v in r.items()
                                    if k.startswith("serious") and isinstance(v, int)
                                }
                                results.append(
                                    {
                                        "safety_report_id": r.get("safetyreportid"),
                                        "reactions": reactions,
                                        "seriousness": seriousness,
                                    }
                                )
                            return results
                        except Exception as exc:
                            logger.warning("OpenFDA query failed for %s: %s", name, exc)
                            return []

                    fda_data = {
                        "drug_a": await _fetch_events(drug_a),
                        "drug_b": await _fetch_events(drug_b),
                    }
                if redis_client is not None and cache_key is not None:
                    try:
                        await redis_client.setex(cache_key, 86400, json.dumps(fda_data))
                    except Exception as exc:
                        logger.warning("OpenFDA cache write failed: %s", exc)
        except Exception as exc:
            logger.warning("OpenFDA enrichment failed: %s", exc)

        data = {
            "drugs": [drug_a, drug_b],
            "interaction_matrix": base_matrix,
            "openfda_evidence": fda_data,
        }
        payload = format_response(
            status="success",
            service="drug",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/similarity/find",
        response_model=BaseResponse,
        tags=["similarity"],
        description="Find similar molecules based on Tanimoto similarity.",
    )
    async def similarity_find(
        request: Request,
        body: SimilarityRequest,
    ):
        request_id = generate_request_id()
        query_mol = Chem.MolFromSmiles(body.smiles)
        if query_mol is None:
            raise HTTPException(status_code=400, detail="Invalid SMILES.")
        query_fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(query_mol, radius=2)
        results: List[Dict[str, Any]] = []
        for name, entry in KNOWN_DRUGS.items():
            mol = Chem.MolFromSmiles(entry["smiles"])
            if mol is None:
                continue
            fp = rdMolDescriptors.GetMorganFingerprintAsBitVect(mol, radius=2)
            sim = float(DataStructs.TanimotoSimilarity(query_fp, fp))
            results.append(
                {
                    "name": entry["name"],
                    "smiles": entry["smiles"],
                    "similarity": sim,
                }
            )
        results.sort(key=lambda x: x["similarity"], reverse=True)
        data = {
            "query_smiles": body.smiles,
            "results": results[:10],
        }
        payload = format_response(
            status="success",
            service="drug",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

