"""
clinical_trials.py — ClinicalTrials.gov API Client
==================================================
Fetch clinical trial results for medical search.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List

import httpx

logger = logging.getLogger("manthana.web.clinical_trials")

CLINICAL_TRIALS_API = "https://clinicaltrials.gov/api/v2/studies"


async def fetch_clinical_trials(
    query: str,
    limit: int = 10,
    page_token: str | None = None,
    timeout: float = 8.0,
) -> tuple[List[Dict[str, Any]], str | None, int]:
    """
    Search ClinicalTrials.gov API v2.
    Returns (results, next_page_token, total_count) or ([], None, 0) on error.
    """
    if not query or not query.strip():
        return [], None, 0

    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            params = {
                "query.term": query,
                "fields": "NCTId,BriefTitle,Condition,Phase,OverallStatus,EnrollmentCount,LocationCity,LocationState,LocationFacility",
                "format": "json",
                "pageSize": limit,
            }
            if page_token:
                params["pageToken"] = page_token

            resp = await client.get(CLINICAL_TRIALS_API, params=params)
            if resp.status_code != 200:
                logger.debug(f"ClinicalTrials.gov error {resp.status_code}")
                return [], None, 0

            data = resp.json()
            studies = data.get("studies", [])
            next_page_token = data.get("nextPageToken")
            total_count = data.get("totalCount", len(studies))
            results = []
            for s in studies:
                protocol = s.get("protocolSection") or s
                ident = (protocol.get("identificationModule") or protocol) if isinstance(protocol, dict) else {}
                status = (protocol.get("statusModule") or {}) if isinstance(protocol, dict) else {}
                design = (protocol.get("designModule") or {}) if isinstance(protocol, dict) else {}

                nct_id = ident.get("nctId", "")
                title = ident.get("briefTitle") or ident.get("officialTitle", "Clinical Trial")
                phase = design.get("phases") or []
                phase_str = phase[0] if phase else "N/A"
                overall_status = status.get("overallStatus", "UNKNOWN")
                enrollment_info = design.get("enrollmentInfo") or {}
                enrollment = enrollment_info.get("count", 0) if isinstance(enrollment_info, dict) else 0

                results.append({
                    "title": f"{title} (NCT{nct_id})" if nct_id else title,
                    "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else "",
                    "snippet": f"Phase {phase_str} • {overall_status} • {enrollment} participants",
                    "content": f"Phase {phase_str} • {overall_status} • {enrollment} participants",
                    "source": "ClinicalTrials.gov",
                    "type": "trial",
                    "publishedDate": None,
                    "phase": phase_str,
                    "status": overall_status,
                    "enrollment": enrollment,
                })
            return results, next_page_token, total_count
    except Exception as e:
        logger.debug(f"ClinicalTrials.gov fetch error: {e}")
        return [], None, 0
