"""
ClinicalTrials.gov API v2 integration for Manthana.

Fetches real clinical trials from ClinicalTrials.gov with support for:
- Condition/disease search
- India filter (query.locn=India)
- Status filter (RECRUITING, COMPLETED, etc.)
- Phase filter
- Redis caching (TTL 3600s)
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger("manthana.clinical-trials")

_CT_GOV_BASE = "https://clinicaltrials.gov/api/v2/studies"
_PAGE_SIZE = 25
_CACHE_TTL = 3600  # 1 hour

# Map frontend status to API filter values
_STATUS_MAP = {
    "active": "RECRUITING,NOT_YET_RECRUITING,ENROLLING_BY_INVITATION",
    "recruiting": "RECRUITING",
    "completed": "COMPLETED",
    "terminated": "TERMINATED",
    "withdrawn": "WITHDRAWN",
    "suspended": "SUSPENDED",
}

# Map frontend phase to API filter (phases in designModule)
_PHASE_MAP = {
    "phase1": "PHASE1",
    "phase2": "PHASE2",
    "phase3": "PHASE3",
    "phase4": "PHASE4",
    "i": "PHASE1",
    "ii": "PHASE2",
    "iii": "PHASE3",
    "iv": "PHASE4",
    "early": "EARLY_PHASE1",
    "na": "NA",
}


def _parse_study(study: Dict[str, Any]) -> Dict[str, Any]:
    """Extract frontend-compatible fields from a ClinicalTrials.gov study."""
    protocol = study.get("protocolSection", {})
    ident = protocol.get("identificationModule", {})
    status_mod = protocol.get("statusModule", {})
    design = protocol.get("designModule", {})
    conditions = protocol.get("conditionsModule", {})
    sponsor_mod = protocol.get("sponsorCollaboratorsModule", {})
    locations_mod = protocol.get("contactsLocationsModule", {})
    arms = protocol.get("armsInterventionsModule", {})

    nct_id = ident.get("nctId", "")
    brief_title = ident.get("briefTitle", "")

    # Phase
    phases = design.get("phases", [])
    phase = phases[0] if phases else "NA"

    # Conditions
    cond_list = conditions.get("conditions", [])
    condition = cond_list[0] if cond_list else ""

    # Interventions
    interventions = arms.get("interventions", [])
    intervention = ", ".join(i.get("name", "") for i in interventions[:3]) if interventions else ""

    # Sponsor
    lead = sponsor_mod.get("leadSponsor", {})
    sponsor = lead.get("name", "")

    # Dates
    start_struct = status_mod.get("startDateStruct", {})
    comp_struct = status_mod.get("completionDateStruct", {})
    start_date = start_struct.get("date", "") if isinstance(start_struct, dict) else ""
    completion_date = comp_struct.get("date", "") if isinstance(comp_struct, dict) else ""

    # Enrollment
    enrollment = design.get("enrollmentInfo", {})
    enrollment_count = enrollment.get("count") if isinstance(enrollment, dict) else None

    # Locations
    locations_raw = locations_mod.get("locations", []) or []
    locations = [{"city": loc.get("city", ""), "country": loc.get("country", "")} for loc in locations_raw[:5]]

    return {
        "nctId": nct_id,
        "title": brief_title,
        "status": status_mod.get("overallStatus", ""),
        "phase": phase,
        "condition": condition,
        "intervention": intervention,
        "sponsor": sponsor,
        "startDate": start_date,
        "completionDate": completion_date,
        "enrollmentCount": enrollment_count,
        "locations": locations,
        "url": f"https://clinicaltrials.gov/study/{nct_id}" if nct_id else "",
    }


async def fetch_clinical_trials_gov(
    query: str,
    filters: Optional[Dict[str, Any]] = None,
    page: int = 1,
    page_size: int = _PAGE_SIZE,
    redis_client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Fetch clinical trials from ClinicalTrials.gov API v2.

    Args:
        query: Search term (condition, disease, or intervention)
        filters: Optional dict with keys: country, india_only, status, phase
        page: Page number (1-based)
        page_size: Results per page
        redis_client: Optional Redis client for caching

    Returns:
        Dict with keys: trials (list), total (int), next_page_token (str or None)
    """
    filters = filters or {}
    india_only = filters.get("india_only") or filters.get("country") in ("IN", "India", "india")

    # Build query params
    params: Dict[str, str] = {
        "query.cond": query,
        "pageSize": str(min(page_size, 100)),
        "countTotal": "true",
    }

    if india_only:
        params["query.locn"] = "India"

    # Status filter
    status = (filters.get("status") or "").strip().lower()
    if status and status in _STATUS_MAP:
        params["filter.overallStatus"] = _STATUS_MAP[status]

    # Phase filter (API uses filter.phase in some versions; check docs)
    phase = (filters.get("phase") or "").strip().lower()
    # Normalize "i", "ii", "iii", "iv" from frontend
    phase_norm = {"i": "phase1", "ii": "phase2", "iii": "phase3", "iv": "phase4"}.get(phase, phase)
    if phase and (phase_norm in _PHASE_MAP or phase in _PHASE_MAP):
        phase_val = _PHASE_MAP.get(phase_norm) or _PHASE_MAP.get(phase)
        if phase_val:
            params["filter.phase"] = phase_val

    # Cache key
    cache_key = f"ctgov:{hashlib.sha256(json.dumps({'q': query, 'f': filters, 'p': page}, sort_keys=True).encode()).hexdigest()}"

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as exc:
            logger.warning("Clinical trials cache read failed: %s", exc)

    # Fetch from API
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(_CT_GOV_BASE, params=params)
            resp.raise_for_status()
            data = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("ClinicalTrials.gov API error: %s", exc)
        return {"trials": [], "total": 0, "next_page_token": None}
    except Exception as exc:
        logger.exception("ClinicalTrials.gov fetch failed: %s", exc)
        return {"trials": [], "total": 0, "next_page_token": None}

    studies = data.get("studies", [])
    next_token = data.get("nextPageToken")
    total = data.get("totalCount", len(studies)) if isinstance(data.get("totalCount"), int) else len(studies)

    trials = [_parse_study(s) for s in studies]

    result = {
        "trials": trials,
        "total": total,
        "next_page_token": next_token,
    }

    if redis_client:
        try:
            await redis_client.setex(cache_key, _CACHE_TTL, json.dumps(result))
        except Exception as exc:
            logger.warning("Clinical trials cache write failed: %s", exc)

    return result
