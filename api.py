"""
api.py — Manthana Legacy Search API
=====================================
Thin FastAPI wrapper over ``orchestrator.py``.

Endpoints:
  GET  /             → service info
  GET  /health       → health check
  GET  /search       → search (query-string)
  POST /search       → search (JSON body)
  GET  /categories   → medical domain categories
  GET  /icd10/suggest → ICD-10 autocomplete
  GET  /docs         → Swagger UI
  GET  /redoc        → ReDoc UI

Runs on port 8001 inside Docker (``manthana-api`` service).
"""

from __future__ import annotations

import json
import logging
import os
import re
import time
from contextlib import asynccontextmanager
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, List, Optional

import uvicorn
from fastapi import Body, FastAPI, HTTPException, Query, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

from orchestrator import close_client, init_indexes, manthana_search, synthesize
from services.shared.medical_ontology import (
    enrich_findings_with_ontology,
    icd10_lookup,
    infer_rads_system,
    lookup_icd_radlex,
)

try:
    from reportlab.lib import colors  # type: ignore[import]
    from reportlab.lib.pagesizes import A4  # type: ignore[import]
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet  # type: ignore[import]
    from reportlab.lib.units import mm  # type: ignore[import]
    from reportlab.platypus import (  # type: ignore[import]
        Paragraph,
        SimpleDocTemplate,
        Spacer,
        Table,
        TableStyle,
    )

    _REPORTLAB_AVAILABLE = True
except Exception:  # pragma: no cover
    _REPORTLAB_AVAILABLE = False

# ── Logging ───────────────────────────────────────────────────────────
_LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()
logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)-5s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("manthana.api")


# ═══════════════════════════════════════════════════════════════════════
#  SEARCH CATEGORIES
# ═══════════════════════════════════════════════════════════════════════

CATEGORIES: List[Dict[str, str]] = [
    {"id": "medical",     "label": "All Medical"},
    {"id": "allopathy",   "label": "Allopathy"},
    {"id": "ayurveda",    "label": "Ayurveda"},
    {"id": "homeopathy",  "label": "Homeopathy"},
    {"id": "siddha",      "label": "Siddha"},
    {"id": "unani",       "label": "Unani"},
    {"id": "naturopathy", "label": "Naturopathy"},
    {"id": "science",     "label": "Research & Science"},
    {"id": "regulatory",  "label": "Regulatory (CDSCO/AYUSH)"},
    {"id": "general",     "label": "General Web"},
]


# ═══════════════════════════════════════════════════════════════════════
#  REQUEST / RESPONSE MODELS
# ═══════════════════════════════════════════════════════════════════════

class SearchRequest(BaseModel):
    """JSON body for ``POST /search``."""
    query: str = Field(..., min_length=2, max_length=500, description="Medical search query.")
    category: str = Field(default="medical", description="Search category.")
    force_ai: bool = Field(default=False, description="Force AI synthesis even for simple queries.")


class ICD10Match(BaseModel):
    term: Optional[str] = None
    code: str
    description: str


class ICD10Response(BaseModel):
    query: str
    suggestions: List[ICD10Match]


class ReportEnrichRequest(BaseModel):
    """JSON body for POST /report/enrich."""
    modality: str = Field(..., description="Imaging modality (e.g. chest_xray, mammogram).")
    findings: List[Dict[str, Any]] = Field(
        ...,
        description="List of findings with label, confidence, severity.",
    )


class ReportPdfRequest(BaseModel):
    """Full ClinicalAnalysisResponse JSON (output of /report/enrich)."""
    enriched_findings: List[Dict[str, Any]] = Field(default_factory=list)
    rads_score: Dict[str, Any] = Field(default_factory=dict)
    triage_level: str = Field(default="ROUTINE")
    impression: str = Field(default="")
    report_standard: str = Field(default="ACR 2024")


# ═══════════════════════════════════════════════════════════════════════
#  UNIFIED SEARCH HANDLER
# ═══════════════════════════════════════════════════════════════════════

async def _execute_search(
    query: str,
    category: str,
    force_ai: bool,
) -> JSONResponse:
    """Shared handler for both GET and POST /search."""
    query = query.strip()
    if len(query) < 2:
        raise HTTPException(status_code=400, detail="Query too short. Minimum 2 characters.")
    if len(query) > 500:
        raise HTTPException(status_code=400, detail="Query too long. Maximum 500 characters.")

    try:
        result = await manthana_search(
            query=query,
            category=category,
            force_ai=force_ai,
        )
        return JSONResponse(content=result)
    except Exception as exc:
        log.error("Search pipeline error: %s", exc, exc_info=True)
        raise HTTPException(
            status_code=500,
            detail="Search pipeline encountered an internal error. Please try again.",
        ) from exc


# ═══════════════════════════════════════════════════════════════════════
#  APP FACTORY
# ═══════════════════════════════════════════════════════════════════════

@asynccontextmanager
async def lifespan(application: FastAPI):
    """Startup: init indexes.  Shutdown: close HTTP client."""
    log.info("🔱 Manthana API starting...")
    await init_indexes()
    log.info("✅ Manthana API ready")
    yield
    log.info("🛑 Manthana API shutting down...")
    await close_client()
    log.info("✅ Shutdown complete")


app = FastAPI(
    title="Manthana API",
    description="India's Medical Intelligence Search Engine",
    version="2.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────
_cors_origins = list(filter(None, [
    os.getenv("FRONTEND_URL", "http://localhost:3001"),
    "http://localhost:3000",
    "http://localhost:3001",
]))
# Add any extra origins from env (comma-separated)
_extra = os.getenv("EXTRA_CORS_ORIGINS", "")
if _extra:
    _cors_origins.extend(o.strip() for o in _extra.split(",") if o.strip())

app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Request logging middleware ────────────────────────────────────────

@app.middleware("http")
async def log_requests(request: Request, call_next):
    t0 = time.monotonic()
    response: Response = await call_next(request)
    elapsed = round(time.monotonic() - t0, 3)
    log.info(
        "%s %s → %d (%ss)",
        request.method,
        request.url.path,
        response.status_code,
        elapsed,
    )
    return response


# ══════════════════════════════════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════════════════════════════════

@app.get("/", tags=["info"])
async def root():
    """Service information and available endpoints."""
    return {
        "product": "Manthana",
        "tagline": "Churning the ocean of medical knowledge",
        "version": "2.0.0",
        "status": "operational",
        "endpoints": {
            "search_GET":     "/search?q=your+query",
            "search_POST":    "/search",
            "categories":     "/categories",
            "icd10_suggest":  "/icd10/suggest?q=diabetes",
            "report_enrich":  "/report/enrich",
            "health":         "/health",
            "docs":           "/docs",
        },
    }


@app.get("/health", tags=["info"])
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "manthana-api",
        "version": "2.0.0",
        "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }


@app.get("/search", tags=["search"])
async def search_get(
    q: str = Query(
        ...,
        min_length=2,
        max_length=500,
        description="Medical search query",
    ),
    category: str = Query("medical", description="Search category"),
    force_ai: bool = Query(False, description="Force AI synthesis"),
    forceai: bool = Query(False, description="Force AI synthesis (alias)"),
):
    """Search via query-string parameters."""
    return await _execute_search(
        query=q,
        category=category,
        force_ai=force_ai or forceai,
    )


@app.post("/search", tags=["search"])
async def search_post(body: SearchRequest):
    """Search via JSON body."""
    return await _execute_search(
        query=body.query,
        category=body.category,
        force_ai=body.force_ai,
    )


@app.get("/categories", tags=["search"])
async def categories():
    """Return available medical domain categories."""
    return {"categories": CATEGORIES}


@app.get("/icd10/suggest", tags=["icd10"], response_model=ICD10Response)
async def icd10_suggest(
    q: str = Query(
        ...,
        min_length=2,
        max_length=200,
        description="ICD-10 autocomplete query",
    ),
):
    """ICD-10 code autocomplete/suggestion.

    Supports exact match, prefix match, substring match, and code/description search.
    """
    matches = icd10_lookup(q)
    return {"query": q, "suggestions": matches}


@app.post("/report/enrich", tags=["reports"],
          description="Enrich imaging findings with ICD-10, RadLex, RADS, and LLM impression/differential.")
async def report_enrich(body: ReportEnrichRequest):
    """Enrich structured findings with ICD-10, RadLex, RADS, impression, differential."""
    modality = body.modality or ""
    findings_in = body.findings or []
    if not modality or not findings_in:
        raise HTTPException(status_code=400, detail="Both 'modality' and non-empty 'findings' are required.")

    ontology = enrich_findings_with_ontology(findings_in, modality)
    enriched_findings = ontology["enriched_findings"]
    rads_score = ontology["rads_score"]
    triage_level = ontology["triage_level"]
    labels = [f.get("label", "") for f in enriched_findings if f.get("label")]

    impression = ""
    differential_map: Dict[str, List[str]] = {}
    try:
        prompt = (
            "You are a radiology reporting assistant.\n"
            "Given the imaging modality and findings, produce ONLY a compact JSON object:\n"
            '{"impression": "single concise impression sentence", '
            '"differential": {"<label>": ["Dx1","Dx2","Dx3"], ...}, '
            '"triage_level": "ROUTINE"|"URGENT"|"EMERGENT"}\n\n'
            f"Modality: {modality}\nFindings: {json.dumps(findings_in, default=str)}"
        )
        raw = await synthesize(query=prompt, context="")
        if raw:
            s = raw.strip()
            if "```" in s:
                start = s.find("{")
                end = s.rfind("}") + 1
                if start >= 0 and end > start:
                    s = s[start:end]
            parsed = json.loads(s)
            impression = str(parsed.get("impression", "") or "")
            if parsed.get("triage_level") in ("ROUTINE", "URGENT", "EMERGENT"):
                triage_level = parsed["triage_level"]
            diff_raw = parsed.get("differential") or {}
            if isinstance(diff_raw, dict):
                for k, v in diff_raw.items():
                    if isinstance(v, list):
                        differential_map[str(k)] = [str(x) for x in v][:3]
    except Exception as exc:
        log.warning("Report enrich LLM fallback: %s", exc)

    for ef in enriched_findings:
        lbl = ef.get("label")
        ef["differential"] = differential_map.get(lbl, []) if lbl else []

    if not impression:
        labels_str = ", ".join(l for l in labels if l)
        impression = f"{labels_str}. Correlate clinically." if labels_str else "No dominant abnormality. Correlate clinically."

    return {
        "enriched_findings": enriched_findings,
        "rads_score": rads_score,
        "triage_level": triage_level,
        "impression": impression,
        "report_standard": "ACR 2024",
    }


def _safe_filename_part(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"[^a-z0-9_-]+", "_", s)
    return s.strip("_") or "report"


@app.post(
    "/report/pdf",
    tags=["reports"],
    description="Generate a branded PDF clinical report from /report/enrich JSON.",
)
async def report_pdf(body: ReportPdfRequest):
    if not _REPORTLAB_AVAILABLE:
        raise HTTPException(
            status_code=500,
            detail="PDF generator dependency missing (reportlab).",
        )

    now = datetime.utcnow()
    modality = _safe_filename_part(body.rads_score.get("system") or "study")
    date_str = now.strftime("%Y%m%d")
    report_id = now.strftime("%H%M%S")
    filename = f"Manthana_Report_{modality}_{date_str}_{report_id}.pdf"

    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=16 * mm,
        title="Manthana Clinical Report",
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "Title",
        parent=styles["Title"],
        fontName="Times-Bold",
        fontSize=18,
        leading=22,
        textColor=colors.HexColor("#111111"),
    )
    h_style = ParagraphStyle(
        "Heading",
        parent=styles["Heading2"],
        fontName="Times-Bold",
        fontSize=12.5,
        leading=16,
        spaceBefore=10,
        spaceAfter=6,
    )
    body_style = ParagraphStyle(
        "Body",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=10.5,
        leading=14,
    )
    small_style = ParagraphStyle(
        "Small",
        parent=styles["BodyText"],
        fontName="Times-Roman",
        fontSize=9,
        leading=12,
        textColor=colors.HexColor("#333333"),
    )

    triage = (body.triage_level or "ROUTINE").upper()
    triage_color = {
        "EMERGENT": colors.HexColor("#8B0000"),
        "URGENT": colors.HexColor("#B45309"),
        "ROUTINE": colors.HexColor("#1F2937"),
    }.get(triage, colors.HexColor("#1F2937"))

    story: List[Any] = []
    story.append(Paragraph("Manthana Clinical Report", title_style))
    story.append(Spacer(1, 6))
    story.append(
        Paragraph(
            f"<b>Generated:</b> {now.strftime('%Y-%m-%d %H:%M UTC')} &nbsp;&nbsp; "
            f"<b>Standard:</b> {body.report_standard or 'ACR 2024'}",
            small_style,
        )
    )
    story.append(Spacer(1, 8))
    story.append(
        Table(
            [[Paragraph(f"<font color='{triage_color.hexval()}'><b>TRIAGE: {triage}</b></font>", body_style)]],
            style=TableStyle(
                [
                    ("BOX", (0, 0), (-1, -1), 1, triage_color),
                    ("BACKGROUND", (0, 0), (-1, -1), triage_color),
                    ("LEFTPADDING", (0, 0), (-1, -1), 8),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            ),
            colWidths=[170 * mm],
        )
    )

    story.append(Spacer(1, 10))
    story.append(Paragraph("Impression", h_style))
    story.append(Paragraph(body.impression or "—", body_style))

    story.append(Spacer(1, 10))
    story.append(Paragraph("RADS Score", h_style))
    rads = body.rads_score or {}
    rads_table = [
        ["System", str(rads.get("system", "—"))],
        ["Score", str(rads.get("score", "—"))],
        ["Meaning", str(rads.get("meaning", "—"))],
        ["Action", str(rads.get("action", "—"))],
        ["Reference", str(rads.get("reference", "—"))],
    ]
    story.append(
        Table(
            rads_table,
            style=TableStyle(
                [
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                    ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#F1F5F9")),
                    ("FONTNAME", (0, 0), (-1, -1), "Times-Roman"),
                    ("FONTSIZE", (0, 0), (-1, -1), 9.5),
                    ("VALIGN", (0, 0), (-1, -1), "TOP"),
                    ("LEFTPADDING", (0, 0), (-1, -1), 6),
                    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                    ("TOPPADDING", (0, 0), (-1, -1), 4),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                ]
            ),
            colWidths=[28 * mm, 142 * mm],
        )
    )

    story.append(Spacer(1, 10))
    story.append(Paragraph("Findings (ICD-10 + RadLex)", h_style))
    findings = body.enriched_findings or []
    if not findings:
        story.append(Paragraph("—", body_style))
    else:
        rows = [["Finding", "ICD-10", "RadLex", "Confidence", "Severity"]]
        for f in findings:
            rows.append(
                [
                    str(f.get("label") or "—"),
                    str(f.get("icd10_code") or "—"),
                    str(f.get("radlex_id") or "—"),
                    str(f.get("confidence") if f.get("confidence") is not None else "—"),
                    str(f.get("severity") or "—"),
                ]
            )
        story.append(
            Table(
                rows,
                style=TableStyle(
                    [
                        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#CBD5E1")),
                        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0F172A")),
                        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                        ("FONTNAME", (0, 0), (-1, 0), "Times-Bold"),
                        ("FONTNAME", (0, 1), (-1, -1), "Times-Roman"),
                        ("FONTSIZE", (0, 0), (-1, -1), 9),
                        ("VALIGN", (0, 0), (-1, -1), "TOP"),
                        ("LEFTPADDING", (0, 0), (-1, -1), 5),
                        ("RIGHTPADDING", (0, 0), (-1, -1), 5),
                        ("TOPPADDING", (0, 0), (-1, -1), 4),
                        ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
                    ]
                ),
                colWidths=[62 * mm, 18 * mm, 22 * mm, 26 * mm, 42 * mm],
            )
        )

    story.append(Spacer(1, 10))
    story.append(Paragraph("Disclaimer", h_style))
    story.append(
        Paragraph(
            "This report is generated by Manthana as a clinical decision support aid and must be "
            "reviewed by a qualified medical professional. AI outputs may be incomplete or inaccurate.",
            body_style,
        )
    )

    doc.build(story)
    buf.seek(0)

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return StreamingResponse(buf, media_type="application/pdf", headers=headers)


# ═══════════════════════════════════════════════════════════════════════
#  CLI ENTRY-POINT
# ═══════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "api:app",
        host="0.0.0.0",
        port=8001,
        reload=False,
        log_level="info",
    )
