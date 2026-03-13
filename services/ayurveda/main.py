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
from slowapi import Limiter
from slowapi.middleware import SlowAPIMiddleware
from slowapi.util import get_remote_address

from services.shared.config import Settings, get_settings
from services.shared.models import BaseResponse, ErrorDetail, HealthResponse
from services.shared.utils import DISCLAIMER, format_response, generate_request_id


logger = logging.getLogger("manthana-ayurveda")
logging.basicConfig(level=os.getenv("LOG_LEVEL", "INFO"))

limiter = Limiter(key_func=get_remote_address, default_limits=["100/minute"])


class PrakritiQuestionnaire(BaseModel):
    attributes: Dict[str, str] = Field(
        ...,
        description=(
            "Patient answers keyed by question/attribute name, e.g. "
            "body_frame, appetite, sleep_quality, temperature_tolerance, etc."
        ),
    )


class VikritiRequest(BaseModel):
    symptoms: List[str] = Field(..., description="Current symptoms list.")
    prakriti_profile: Optional[Dict[str, Any]] = Field(
        default=None, description="Previously computed Prakriti profile."
    )


class HerbSearchRequest(BaseModel):
    name: str = Field(..., description="Herb name in Sanskrit/Hindi/English/Latin.")


class FormulationSearchRequest(BaseModel):
    query: str = Field(..., description="Disease name or symptom description.")


class ClassicalQueryRequest(BaseModel):
    question: str


class CorrelateModernRequest(BaseModel):
    condition: str = Field(..., description="Ayurvedic condition name.")


DOSHA_WEIGHTS: Dict[str, Dict[str, Dict[str, float]]] = {
    "body_frame": {
        "slim": {"vata": 1.0},
        "medium": {"pitta": 1.0},
        "stocky": {"kapha": 1.0},
    },
    "appetite": {
        "variable": {"vata": 1.0},
        "strong": {"pitta": 1.0},
        "slow": {"kapha": 1.0},
    },
    "sleep_quality": {
        "light": {"vata": 1.0},
        "moderate": {"pitta": 1.0},
        "deep": {"kapha": 1.0},
    },
    "temperature_tolerance": {
        "cold_intolerant": {"vata": 1.0},
        "heat_intolerant": {"pitta": 1.0},
        "tolerant": {"kapha": 1.0},
    },
}


DIET_RECOMMENDATIONS: Dict[str, List[str]] = {
    "vata": [
        "Warm, cooked foods with healthy fats.",
        "Regular meal times.",
        "Avoid excessive raw, cold, and dry foods.",
    ],
    "pitta": [
        "Cooling foods like cucumber, coriander, and leafy greens.",
        "Avoid very spicy, oily, and fried foods.",
        "Prefer room temperature or cool drinks (not iced).",
    ],
    "kapha": [
        "Light, warm, and spicy foods.",
        "Reduce heavy, sweet, and oily foods.",
        "Encourage regular exercise and lighter dinners.",
    ],
}


HERB_DATABASE: Dict[str, Dict[str, Any]] = {
    "ashwagandha": {
        "names": ["ashwagandha", "withania somnifera"],
        "rasa": ["madhura", "tikta"],
        "guna": ["snigdha", "guru"],
        "virya": "ushna",
        "vipaka": "madhura",
        "indications": ["stress", "fatigue", "debilitation"],
        "contraindications": ["pregnancy without supervision"],
    },
    "amalaki": {
        "names": ["amalaki", "amla", "emblica officinalis"],
        "rasa": ["amla (sour) predominant but tridoshic"],
        "guna": ["laghu", "ruksha"],
        "virya": "shita",
        "vipaka": "madhura",
        "indications": ["pitta disorders", "rejuvenation"],
        "contraindications": [],
    },
}


FORMULATION_DATABASE: Dict[str, Dict[str, Any]] = {
    "amlapitta": {
        "condition": "amlapitta",
        "modern_correlate": "acid peptic disease / gastritis",
        "formulations": [
            {
                "name": "Avipattikar Churna",
                "ingredients": [
                    "Triphala",
                    "Trikatu",
                    "Mustaka",
                    "Vida lavana",
                ],
                "preparation": "Powder; typically taken with warm water before meals.",
            }
        ],
    }
}


def create_app(settings: Settings) -> FastAPI:
    app = FastAPI(
        title="Manthana Ayurveda Service",
        description="Ayurvedic constitution analysis and knowledge service.",
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

    client = httpx.AsyncClient(timeout=60.0)

    @app.middleware("http")
    async def add_request_id(request: Request, call_next):
        request_id = generate_request_id()
        request.state.request_id = request_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = request_id
        return response

    def score_prakriti(attributes: Dict[str, str]) -> Dict[str, Any]:
        vata = 0.0
        pitta = 0.0
        kapha = 0.0
        for key, value in attributes.items():
            weights = DOSHA_WEIGHTS.get(key, {})
            mapping = weights.get(value)
            if mapping:
                vata += mapping.get("vata", 0.0)
                pitta += mapping.get("pitta", 0.0)
                kapha += mapping.get("kapha", 0.0)
        total = vata + pitta + kapha or 1.0
        v_pct = round(100.0 * vata / total, 1)
        p_pct = round(100.0 * pitta / total, 1)
        k_pct = round(100.0 * kapha / total, 1)
        scores = {"vata": v_pct, "pitta": p_pct, "kapha": k_pct}
        dominant = max(scores, key=scores.get)
        sorted_doshas = sorted(scores.items(), key=lambda x: x[1], reverse=True)
        sub_dosha = sorted_doshas[1][0] if len(sorted_doshas) > 1 else dominant
        recommendations = DIET_RECOMMENDATIONS.get(dominant, [])
        return {
            "scores": scores,
            "dominant": dominant,
            "sub_dosha": sub_dosha,
            "dietary_recommendations": recommendations,
        }

    async def call_ollama(question: str, system_prompt: str, request_id: str) -> str:
        try:
            resp = await client.post(
                f"{settings.OLLAMA_URL.rstrip('/')}/api/chat",
                json={
                    "model": settings.MEDITRON_MODEL,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": question},
                    ],
                    "stream": False,
                },
                headers={"Content-Type": "application/json"},
            )
            resp.raise_for_status()
            data = resp.json()
            return data.get("message", {}).get("content", "")
        except Exception as exc:
            logger.exception("Ollama call failed")
            raise HTTPException(
                status_code=502, detail=f"LLM backend error: {exc}"
            ) from exc

    @app.get(
        "/health",
        response_model=HealthResponse,
        tags=["core"],
        description="Health check for the Ayurveda service.",
    )
    async def health(request: Request):
        request_id = generate_request_id()
        return HealthResponse(
            status="healthy",
            service="ayurveda",
            details=None,
            request_id=request_id,
        )

    @app.get(
        "/info",
        response_model=BaseResponse,
        tags=["core"],
        description="Service metadata and disclaimer.",
    )
    async def info(request: Request):
        request_id = generate_request_id()
        data = {
            "service": "ayurveda",
            "prakriti_questions": list(DOSHA_WEIGHTS.keys()),
        }
        payload = format_response(
            status="success",
            service="ayurveda",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/prakriti",
        response_model=BaseResponse,
        tags=["prakriti"],
        description="Analyze Prakriti (constitution) based on questionnaire responses.",
    )
    async def analyze_prakriti(
        request: Request,
        body: PrakritiQuestionnaire,
    ):
        request_id = generate_request_id()
        profile = score_prakriti(body.attributes)
        data = {
            "vata": profile["scores"]["vata"],
            "pitta": profile["scores"]["pitta"],
            "kapha": profile["scores"]["kapha"],
            "dominant_dosha": profile["dominant"],
            "sub_dosha": profile["sub_dosha"],
            "dietary_recommendations": profile["dietary_recommendations"],
        }
        payload = format_response(
            status="success",
            service="ayurveda",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/analyze/vikriti",
        response_model=BaseResponse,
        tags=["vikriti"],
        description="Analyze current Vikriti (imbalance) relative to baseline Prakriti.",
    )
    async def analyze_vikriti(
        request: Request,
        body: VikritiRequest,
    ):
        request_id = generate_request_id()
        symptom_text = ", ".join(body.symptoms).lower()
        imbalance: Dict[str, float] = {"vata": 0.0, "pitta": 0.0, "kapha": 0.0}
        if any(k in symptom_text for k in ["anxiety", "insomnia", "dry", "constipation"]):
            imbalance["vata"] += 1.0
        if any(k in symptom_text for k in ["burning", "acidity", "anger", "redness"]):
            imbalance["pitta"] += 1.0
        if any(k in symptom_text for k in ["heaviness", "weight_gain", "lethargy"]):
            imbalance["kapha"] += 1.0
        total = sum(imbalance.values()) or 1.0
        for k in imbalance:
            imbalance[k] = round(100.0 * imbalance[k] / total, 1)
        dominant = max(imbalance, key=imbalance.get)
        data = {
            "symptoms": body.symptoms,
            "imbalanced_doshas": imbalance,
            "dominant_imbalance": dominant,
            "prakriti_profile": body.prakriti_profile,
        }
        payload = format_response(
            status="success",
            service="ayurveda",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/search/herb",
        response_model=BaseResponse,
        tags=["knowledge"],
        description="Search Ayurvedic herb properties across multiple languages.",
    )
    async def search_herb(
        request: Request,
        body: HerbSearchRequest,
    ):
        request_id = generate_request_id()
        query = body.name.lower()
        for herb_key, herb in HERB_DATABASE.items():
            for name in herb["names"]:
                if query in name:
                    payload_data = {
                        "herb": herb_key,
                        "properties": {
                            "rasa": herb["rasa"],
                            "guna": herb["guna"],
                            "virya": herb["virya"],
                            "vipaka": herb["vipaka"],
                        },
                        "indications": herb["indications"],
                        "contraindications": herb["contraindications"],
                    }
                    payload = format_response(
                        status="success",
                        service="ayurveda",
                        data=payload_data,
                        error=None,
                        request_id=request_id,
                        disclaimer=DISCLAIMER,
                    )
                    return JSONResponse(content=payload)
        error = ErrorDetail(
            code=404,
            message="Herb not found in knowledge base.",
            details={"query": body.name},
        )
        payload = format_response(
            status="error",
            service="ayurveda",
            data=None,
            error=error.dict(),
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(status_code=404, content=payload)

    @app.post(
        "/search/formulation",
        response_model=BaseResponse,
        tags=["knowledge"],
        description="Retrieve classical formulations for a given condition or symptom cluster.",
    )
    async def search_formulation(
        request: Request,
        body: FormulationSearchRequest,
    ):
        request_id = generate_request_id()
        q = body.query.lower()
        for key, entry in FORMULATION_DATABASE.items():
            if key in q or entry["condition"] in q:
                payload_data = entry
                payload = format_response(
                    status="success",
                    service="ayurveda",
                    data=payload_data,
                    error=None,
                    request_id=request_id,
                    disclaimer=DISCLAIMER,
                )
                return JSONResponse(content=payload)
        error = ErrorDetail(
            code=404,
            message="No classical formulation found for query.",
            details={"query": body.query},
        )
        payload = format_response(
            status="error",
            service="ayurveda",
            data=None,
            error=error.dict(),
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(status_code=404, content=payload)

    @app.post(
        "/query/classical",
        response_model=BaseResponse,
        tags=["knowledge"],
        description="Answer questions about Ayurveda using classical texts context.",
    )
    async def query_classical(
        request: Request,
        body: ClassicalQueryRequest,
    ):
        request_id = generate_request_id()
        system_prompt = (
            "You are an Ayurveda expert referencing Charaka Samhita and "
            "Sushruta Samhita. Provide classical references and shlokas "
            "when possible, and include a modern interpretation."
        )
        answer = await call_ollama(body.question, system_prompt, request_id)
        data = {
            "question": body.question,
            "answer": answer,
        }
        payload = format_response(
            status="success",
            service="ayurveda",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    @app.post(
        "/correlate/modern",
        response_model=BaseResponse,
        tags=["knowledge"],
        description="Correlate Ayurvedic conditions with modern medical equivalents.",
    )
    async def correlate_modern(
        request: Request,
        body: CorrelateModernRequest,
    ):
        request_id = generate_request_id()
        system_prompt = (
            "Map the given Ayurvedic condition to possible modern medical "
            "diagnoses and summarize key research findings. Be explicit "
            "about uncertainties."
        )
        answer = await call_ollama(body.condition, system_prompt, request_id)
        data = {
            "condition": body.condition,
            "correlation": answer,
        }
        payload = format_response(
            status="success",
            service="ayurveda",
            data=data,
            error=None,
            request_id=request_id,
            disclaimer=DISCLAIMER,
        )
        return JSONResponse(content=payload)

    return app


settings = get_settings()
app = create_app(settings)

