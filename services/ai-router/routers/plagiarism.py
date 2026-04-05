"""
Plagiarism routes: /v1/plagiarism/check, /v1/plagiarism/health
"""
from typing import TYPE_CHECKING, Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse

from auth import get_protected_user
from services.shared.audit import write_audit_log
from services.shared.models import ErrorDetail, PlagiarismCheckRequest
from services.shared.plagiarism import check_originality
from services.shared.utils import format_response, generate_request_id, json_log

if TYPE_CHECKING:
    from slowapi import Limiter


def create_plagiarism_router(limiter: "Limiter") -> APIRouter:
    router = APIRouter(tags=["plagiarism"])

    @router.post(
        "/plagiarism/check",
        description="Check originality of clinical or research text using local stack.",
    )
    @limiter.limit("60/minute")
    async def plagiarism_check_endpoint(
        request: Request,
        payload: PlagiarismCheckRequest,
        user: Optional[dict] = Depends(get_protected_user),
    ):
        text: str = payload.text
        scan_id: str = payload.scanId or ""
        rid = getattr(request.state, "request_id", generate_request_id())
        qdrant_client = getattr(request.app.state, "qdrant_client", None)
        try:
            result = await check_originality(
                report_text=text,
                qdrant_client=qdrant_client,
                searxng_url="http://searxng:8080",
            )
            try:
                write_audit_log(
                    request_id=rid,
                    service="plagiarism",
                    endpoint="/plagiarism/check",
                    model_id="originality-check",
                    findings=[{"label": "originality", "confidence": result.get("originalityScore", 0)}],
                )
            except Exception as audit_exc:
                json_log("manthana.ai-router", "warning", event="audit_log_failed", error=str(audit_exc), request_id=rid)
            return JSONResponse(
                status_code=200,
                content=format_response("success", "ai-router", result, None, rid),
            )
        except Exception as exc:
            json_log("manthana.ai-router", "error",
                     event="plagiarism_check_failed", error=str(exc), request_id=rid)
            err = ErrorDetail(
                code=500,
                message="Originality check failed",
                details={"detail": "Internal error while running plagiarism engine", "scanId": scan_id or None},
            )
            return JSONResponse(
                status_code=500,
                content=format_response("error", "ai-router", None, err.dict(), rid),
            )

    @router.get(
        "/plagiarism/health",
        description="Health check for the Manthana originality engine.",
    )
    async def plagiarism_health():
        return {"status": "ok", "layers": ["sentence-transformers", "searxng", "qdrant"], "cost": "₹0"}

    return router
