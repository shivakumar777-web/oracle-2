"""
Herb-drug interaction analysis with evidence-based lookup and PubMed integration.

Replaces heuristic herb-as-drug flow with:
1. Curated evidence table (herb_drug_evidence)
2. PubMed E-utilities for literature
3. Ayurveda herb lookup for context
"""

from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote_plus

import httpx

from services.shared.herb_drug_evidence import lookup_herb_drug_evidence

logger = logging.getLogger("manthana.herb-drug")

_PUBMED_ESEARCH = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi"
_PUBMED_ESUMMARY = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi"
_PUBMED_CACHE_TTL = 86400  # 24h


def _safety_level_from_severity(severity: str) -> str:
    """Map evidence severity to frontend safetyLevel."""
    m = {"none": "safe", "mild": "caution", "moderate": "caution", "severe": "avoid", "contraindicated": "avoid"}
    return m.get((severity or "").lower(), "caution")


async def fetch_pubmed_herb_drug(
    herb: str,
    drug: str,
    max_results: int = 5,
    redis_client: Optional[Any] = None,
) -> List[Dict[str, Any]]:
    """
    Fetch herb-drug interaction literature from PubMed.

    Returns list of {pmid, title, url}.
    """
    query = f"{herb} {drug} interaction"
    cache_key = f"pubmed:herbdrug:{hashlib.sha256(query.lower().encode()).hexdigest()}"

    if redis_client:
        try:
            cached = await redis_client.get(cache_key)
            if cached:
                return json.loads(cached)
        except Exception as exc:
            logger.warning("PubMed cache read failed: %s", exc)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            # ESearch
            resp = await client.get(
                _PUBMED_ESEARCH,
                params={
                    "db": "pubmed",
                    "term": query,
                    "retmax": max_results,
                    "retmode": "json",
                },
            )
            resp.raise_for_status()
            data = resp.json()
            idlist = data.get("esearchresult", {}).get("idlist", [])
            if not idlist:
                return []

            # ESummary for titles
            summary_resp = await client.get(
                _PUBMED_ESUMMARY,
                params={
                    "db": "pubmed",
                    "id": ",".join(idlist),
                    "retmode": "json",
                },
            )
            summary_resp.raise_for_status()
            summary_data = summary_resp.json()
            result = summary_data.get("result", {})

            citations = []
            for pmid in idlist:
                if pmid == "result":  # esummary wraps in result
                    continue
                item = result.get(pmid, {})
                title = item.get("title", "")
                citations.append({
                    "pmid": pmid,
                    "title": title,
                    "url": f"https://pubmed.ncbi.nlm.nih.gov/{pmid}",
                })

            if redis_client:
                try:
                    await redis_client.setex(cache_key, _PUBMED_CACHE_TTL, json.dumps(citations))
                except Exception as exc:
                    logger.warning("PubMed cache write failed: %s", exc)

            return citations
    except Exception as exc:
        logger.warning("PubMed fetch failed: %s", exc)
        return []


async def analyze_herb_drug(
    herb: str,
    drug: str,
    herb_info: Optional[Dict[str, Any]] = None,
    redis_client: Optional[Any] = None,
) -> Dict[str, Any]:
    """
    Analyze herb-drug interaction using curated evidence + PubMed.

    Returns dict compatible with frontend HerbDrugResult and plan schema.
    """
    herb = (herb or "").strip()
    drug = (drug or "").strip()
    herb_info = herb_info or {}

    # 1. Curated evidence lookup
    evidence = lookup_herb_drug_evidence(herb, drug)

    # 2. PubMed literature (if no curated match or to enrich)
    citations = await fetch_pubmed_herb_drug(herb, drug, max_results=5, redis_client=redis_client)

    data_sources: List[str] = []
    if evidence:
        data_sources.append("curated_evidence")
    if citations:
        data_sources.append("pubmed")

    if evidence:
        severity = evidence["severity"]
        safety_level = _safety_level_from_severity(severity)
        curated_citations = []
        if evidence.get("citation_pmid") and evidence.get("citation_url"):
            curated_citations = [{
                "pmid": evidence["citation_pmid"],
                "title": f"Evidence from systematic review (PMID {evidence['citation_pmid']})",
                "url": evidence["citation_url"],
            }]
        all_citations = curated_citations + citations[:3]
        interaction = {
            "severity": severity,
            "evidence_level": evidence["evidence_level"],
            "mechanism": evidence["mechanism"],
            "citations": all_citations,
            "recommendation": evidence["recommendation"],
        }
        clinical_notes = evidence["recommendation"]
    else:
        # No curated match - use PubMed if available
        if citations:
            interaction = {
                "severity": "unknown",
                "evidence_level": "literature",
                "mechanism": "Literature suggests potential interaction. See citations.",
                "citations": citations[:5],
                "recommendation": "Limited evidence. Consult prescriber before combining.",
            }
            clinical_notes = "Literature review available. Consult a qualified practitioner."
            safety_level = "caution"
        else:
            interaction = {
                "severity": "none",
                "evidence_level": "none",
                "mechanism": "No evidence-based interaction found in curated database or PubMed.",
                "citations": [],
                "recommendation": "Limited data. Consult prescriber before combining herb with medication.",
            }
            clinical_notes = "No known interaction in our database. Always consult a qualified practitioner."
            safety_level = "caution"

    return {
        "herb": herb,
        "drug": drug,
        "herb_info": herb_info,
        "interaction": interaction,
        "safetyLevel": safety_level,
        "mechanism": interaction.get("mechanism", ""),
        "clinicalNotes": clinical_notes,
        "ayurvedicContext": herb_info.get("properties") or herb_info.get("indications"),
        "reference": interaction["citations"][0]["url"] if interaction.get("citations") else None,
        "data_sources": data_sources if data_sources else ["none"],
        "disclaimer": "Evidence from literature. Not a substitute for clinical judgment.",
    }
