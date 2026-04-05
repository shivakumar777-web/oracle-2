"""
Part 2 — rich metadata, ranking, and research-oriented helpers for source pills.

Complements ``domain_sources.py`` (Part 1: pill lists and site fragments).
Oracle uses ranking + SOURCE_META for OpenRouter ``allowed_domains`` ordering and prompts.
"""

from __future__ import annotations

import math
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, FrozenSet, List, Optional, Set, Tuple

# Part 1 — read-only; domain_sources_meta must not be imported by domain_sources (no cycle).
# Functions that need Part 1 import it lazily inside the function body.


# ---------------------------------------------------------------------------
# 1. ENUMERATIONS
# ---------------------------------------------------------------------------


class AccessTier(Enum):
    OPEN = "open"
    RESTRICTED = "restricted"
    HYBRID = "hybrid"
    REGISTRY = "registry"


class ContentDepth(Enum):
    ABSTRACT_ONLY = "abstract_only"
    FULL_TEXT = "full_text"
    FORMULARY = "formulary"
    TRIAL_RECORD = "trial_record"
    THESIS = "thesis"
    BOOK_CHAPTER = "book_chapter"
    GUIDELINE = "guideline"
    DATABASE_ENTRY = "database_entry"


class EvidenceTier(Enum):
    SYSTEMATIC_REVIEW = 5
    RCT = 4
    OBSERVATIONAL = 3
    EXPERT_CONSENSUS = 2
    TRADITIONAL_RECORD = 1
    UNKNOWN = 0


class GeographicScope(Enum):
    GLOBAL = "global"
    INDIA = "india"
    SOUTH_ASIA = "south_asia"
    MIDDLE_EAST = "middle_east"
    EUROPE = "europe"


class SearchEngine(Enum):
    EXA = "exa"
    SEARXNG = "searxng"
    PUBMED_API = "pubmed_api"
    CT_API = "clinicaltrials_api"
    AUTO = "auto"


# ---------------------------------------------------------------------------
# 2. SOURCE METADATA REGISTRY
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class SourceMeta:
    id: str
    display_name: str
    short_name: str
    description: str
    access: AccessTier
    depth: ContentDepth
    evidence_tier: EvidenceTier
    scope: GeographicScope
    engine: SearchEngine
    update_cadence_days: int
    cache_ttl_hours: int
    languages: Tuple[str, ...]
    domains: FrozenSet[str]
    paywalled_full_text: bool = False
    supports_mesh_terms: bool = False
    supports_boolean: bool = True
    index_size_estimate: str = "unknown"


SOURCE_META: Dict[str, SourceMeta] = {
    "pubmed": SourceMeta(
        id="pubmed",
        display_name="PubMed / MEDLINE",
        short_name="PubMed",
        description="NLM's primary index of biomedical literature.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.UNKNOWN,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.PUBMED_API,
        update_cadence_days=1,
        cache_ttl_hours=12,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy", "siddha", "unani"}),
        supports_mesh_terms=True,
        index_size_estimate="large",
    ),
    "clinicaltrials": SourceMeta(
        id="clinicaltrials",
        display_name="ClinicalTrials.gov",
        short_name="CT.gov",
        description="US registry of clinical studies.",
        access=AccessTier.OPEN,
        depth=ContentDepth.TRIAL_RECORD,
        evidence_tier=EvidenceTier.RCT,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.CT_API,
        update_cadence_days=1,
        cache_ttl_hours=24,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="large",
    ),
    "cochrane": SourceMeta(
        id="cochrane",
        display_name="Cochrane Library",
        short_name="Cochrane",
        description="Systematic reviews and meta-analyses.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.SYSTEMATIC_REVIEW,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=48,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy"}),
        paywalled_full_text=True,
        supports_mesh_terms=True,
        index_size_estimate="medium",
    ),
    "embase": SourceMeta(
        id="embase",
        display_name="Embase",
        short_name="Embase",
        description="Elsevier biomedical and pharmacological database.",
        access=AccessTier.RESTRICTED,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=1,
        cache_ttl_hours=24,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        paywalled_full_text=True,
        supports_mesh_terms=True,
        index_size_estimate="large",
    ),
    "uptodate": SourceMeta(
        id="uptodate",
        display_name="UpToDate",
        short_name="UpToDate",
        description="Evidence-based clinical decision support.",
        access=AccessTier.RESTRICTED,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=7,
        cache_ttl_hours=72,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        paywalled_full_text=True,
        supports_boolean=False,
        index_size_estimate="medium",
    ),
    "nice": SourceMeta(
        id="nice",
        display_name="NICE Guidelines",
        short_name="NICE",
        description="UK NICE clinical guidelines.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.EUROPE,
        engine=SearchEngine.EXA,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        index_size_estimate="medium",
    ),
    "radiopaedia": SourceMeta(
        id="radiopaedia",
        display_name="Radiopaedia",
        short_name="Radiopaedia",
        description="Collaborative radiology reference.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=7,
        cache_ttl_hours=72,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        index_size_estimate="medium",
    ),
    "europe-pmc": SourceMeta(
        id="europe-pmc",
        display_name="Europe PMC",
        short_name="EuropePMC",
        description="Open-access biomedical literature repository.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.UNKNOWN,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=1,
        cache_ttl_hours=12,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy", "siddha", "unani"}),
        supports_mesh_terms=True,
        index_size_estimate="large",
    ),
    "who": SourceMeta(
        id="who",
        display_name="World Health Organization",
        short_name="WHO",
        description="WHO technical reports and guidelines.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en", "fr", "es", "ar", "zh", "ru"),
        domains=frozenset({"allopathy"}),
        index_size_estimate="medium",
    ),
    "who-iris": SourceMeta(
        id="who-iris",
        display_name="WHO IRIS Repository",
        short_name="WHO IRIS",
        description="WHO institutional publications repository.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en", "fr", "es", "ar"),
        domains=frozenset({"allopathy"}),
        index_size_estimate="medium",
    ),
    "who-gim": SourceMeta(
        id="who-gim",
        display_name="WHO Global Index Medicus",
        short_name="GIM",
        description="Health research index for LMICs.",
        access=AccessTier.OPEN,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=72,
        languages=("en", "fr", "es", "pt", "ar"),
        domains=frozenset({"allopathy"}),
        index_size_estimate="medium",
    ),
    "nccih": SourceMeta(
        id="nccih",
        display_name="NCCIH (NIH)",
        short_name="NCCIH",
        description="NIH complementary and integrative health.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="small",
    ),
    "doaj": SourceMeta(
        id="doaj",
        display_name="DOAJ",
        short_name="DOAJ",
        description="Directory of Open Access Journals.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=7,
        cache_ttl_hours=48,
        languages=("en",),
        domains=frozenset({"ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="large",
    ),
    "indmed": SourceMeta(
        id="indmed",
        display_name="IndMED",
        short_name="IndMED",
        description="Indian biomedical journals index (NIC).",
        access=AccessTier.OPEN,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        index_size_estimate="small",
    ),
    "ctri-india": SourceMeta(
        id="ctri-india",
        display_name="CTRI India",
        short_name="CTRI",
        description="Clinical Trials Registry – India.",
        access=AccessTier.OPEN,
        depth=ContentDepth.TRIAL_RECORD,
        evidence_tier=EvidenceTier.RCT,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=7,
        cache_ttl_hours=48,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="medium",
    ),
    "cdsco": SourceMeta(
        id="cdsco",
        display_name="CDSCO",
        short_name="CDSCO",
        description="Indian drug regulatory authority.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        index_size_estimate="small",
    ),
    "icmr": SourceMeta(
        id="icmr",
        display_name="ICMR",
        short_name="ICMR",
        description="Indian Council of Medical Research.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy"}),
        index_size_estimate="small",
    ),
    "ccras": SourceMeta(
        id="ccras",
        display_name="CCRAS",
        short_name="CCRAS",
        description="Central Council for Research in Ayurvedic Sciences.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en", "hi"),
        domains=frozenset({"ayurveda"}),
        index_size_estimate="small",
    ),
    "ayush-formulary": SourceMeta(
        id="ayush-formulary",
        display_name="AYUSH Formulary",
        short_name="AYUSH Form.",
        description="Official AYUSH government formularies.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FORMULARY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=180,
        cache_ttl_hours=720,
        languages=("en", "hi", "sa"),
        domains=frozenset({"ayurveda", "siddha"}),
        supports_boolean=False,
        index_size_estimate="small",
    ),
    "ayush-portal": SourceMeta(
        id="ayush-portal",
        display_name="AYUSH Research Portal",
        short_name="AYUSH Portal",
        description="Ministry of AYUSH research gateway.",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "hi"),
        domains=frozenset({"ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="medium",
    ),
    "pcimh": SourceMeta(
        id="pcimh",
        display_name="PCIMH",
        short_name="PCIMH",
        description="Pharmacopoeia Commission for Indian Medicine and Homeopathy.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FORMULARY,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=365,
        cache_ttl_hours=720,
        languages=("en",),
        domains=frozenset({"ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="small",
    ),
    "pharmacopoeia-ayush": SourceMeta(
        id="pharmacopoeia-ayush",
        display_name="AYUSH Pharmacopoeia",
        short_name="AYUSH Pharm.",
        description="Official pharmacopoeia for ASU medicines.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FORMULARY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=365,
        cache_ttl_hours=720,
        languages=("en", "hi"),
        domains=frozenset({"ayurveda", "siddha", "unani"}),
        supports_boolean=False,
        index_size_estimate="small",
    ),
    "shodhganga": SourceMeta(
        id="shodhganga",
        display_name="Shodhganga",
        short_name="Shodhganga",
        description="Indian theses and dissertations repository.",
        access=AccessTier.OPEN,
        depth=ContentDepth.THESIS,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.EXA,
        update_cadence_days=7,
        cache_ttl_hours=168,
        languages=("en", "hi"),
        domains=frozenset({"ayurveda", "siddha", "unani"}),
        index_size_estimate="large",
    ),
    "niimh": SourceMeta(
        id="niimh",
        display_name="NIIMH",
        short_name="NIIMH",
        description="National Institute of Indian Medical Heritage.",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=365,
        cache_ttl_hours=720,
        languages=("en", "sa", "hi"),
        domains=frozenset({"ayurveda", "siddha"}),
        supports_boolean=False,
        index_size_estimate="small",
    ),
    "tkdl": SourceMeta(
        id="tkdl",
        display_name="TKDL",
        short_name="TKDL",
        description="Traditional Knowledge Digital Library.",
        access=AccessTier.RESTRICTED,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=365,
        cache_ttl_hours=720,
        languages=("en", "sa", "hi", "ar", "ta"),
        domains=frozenset({"ayurveda", "unani", "siddha"}),
        supports_boolean=False,
        index_size_estimate="medium",
    ),
    "imppat": SourceMeta(
        id="imppat",
        display_name="IMPPAT",
        short_name="IMPPAT",
        description="Indian medicinal plants and phytochemistry database.",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.EXA,
        update_cadence_days=180,
        cache_ttl_hours=720,
        languages=("en",),
        domains=frozenset({"ayurveda"}),
        index_size_estimate="medium",
    ),
    "nmpb": SourceMeta(
        id="nmpb",
        display_name="NMPB",
        short_name="NMPB",
        description="National Medicinal Plants Board.",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=180,
        cache_ttl_hours=720,
        languages=("en", "hi"),
        domains=frozenset({"ayurveda"}),
        supports_boolean=False,
        index_size_estimate="small",
    ),
    "frlht-medplant": SourceMeta(
        id="frlht-medplant",
        display_name="FRLHT Medicinal Plants",
        short_name="FRLHT",
        description="FRLHT medicinal plant database.",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.TRADITIONAL_RECORD,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=365,
        cache_ttl_hours=720,
        languages=("en",),
        domains=frozenset({"ayurveda"}),
        supports_boolean=False,
        index_size_estimate="small",
    ),
    "jaim": SourceMeta(
        id="jaim",
        display_name="Journal of Ayurveda and Integrative Medicine",
        short_name="JAIM",
        description="Peer-reviewed OA journal (Ayurveda / integrative).",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=72,
        languages=("en",),
        domains=frozenset({"ayurveda"}),
        index_size_estimate="small",
    ),
    "indian-journals": SourceMeta(
        id="indian-journals",
        display_name="Indian AYUSH Journals",
        short_name="Indian J.",
        description="IJAM / AYU and related Indian journals.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.EXA,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"ayurveda", "siddha", "unani"}),
        index_size_estimate="small",
    ),
    "ncbi-books": SourceMeta(
        id="ncbi-books",
        display_name="NCBI Bookshelf",
        short_name="NCBI Books",
        description="Free full-text biomedical books from NCBI.",
        access=AccessTier.OPEN,
        depth=ContentDepth.BOOK_CHAPTER,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"allopathy", "ayurveda"}),
        index_size_estimate="medium",
    ),
    "ccrh": SourceMeta(
        id="ccrh",
        display_name="CCRH",
        short_name="CCRH",
        description="Central Council for Research in Homoeopathy.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"homeopathy"}),
        index_size_estimate="small",
    ),
    "core-hom": SourceMeta(
        id="core-hom",
        display_name="CORE-Hom",
        short_name="CORE-Hom",
        description="Clinical homeopathy studies database (Carstens).",
        access=AccessTier.OPEN,
        depth=ContentDepth.DATABASE_ENTRY,
        evidence_tier=EvidenceTier.RCT,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "de"),
        domains=frozenset({"homeopathy"}),
        index_size_estimate="small",
    ),
    "homeopathy-research": SourceMeta(
        id="homeopathy-research",
        display_name="HRI Research",
        short_name="HRI",
        description="Homeopathy Research Institute evidence resources.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.SYSTEMATIC_REVIEW,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en",),
        domains=frozenset({"homeopathy"}),
        index_size_estimate="small",
    ),
    "ccrs": SourceMeta(
        id="ccrs",
        display_name="CCRS",
        short_name="CCRS",
        description="Central Council for Research in Siddha.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en", "ta"),
        domains=frozenset({"siddha"}),
        index_size_estimate="small",
    ),
    "nis-chennai": SourceMeta(
        id="nis-chennai",
        display_name="NIS Chennai",
        short_name="NIS Chennai",
        description="National Institute of Siddha.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "ta"),
        domains=frozenset({"siddha"}),
        index_size_estimate="small",
    ),
    "tnmgrmu": SourceMeta(
        id="tnmgrmu",
        display_name="TNMGRMU",
        short_name="TNMGRMU",
        description="Tamil Nadu medical university research and theses.",
        access=AccessTier.OPEN,
        depth=ContentDepth.THESIS,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=180,
        cache_ttl_hours=720,
        languages=("en", "ta"),
        domains=frozenset({"siddha"}),
        index_size_estimate="small",
    ),
    "ccrum": SourceMeta(
        id="ccrum",
        display_name="CCRUM",
        short_name="CCRUM",
        description="Central Council for Research in Unani Medicine.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=30,
        cache_ttl_hours=168,
        languages=("en", "ur", "hi"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "nium": SourceMeta(
        id="nium",
        display_name="NIUM Bangalore",
        short_name="NIUM",
        description="National Institute of Unani Medicine.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "ur"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "hamdard-medicus": SourceMeta(
        id="hamdard-medicus",
        display_name="Hamdard Medicus",
        short_name="Hamdard",
        description="Hamdard University Unani medicine journal.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.SOUTH_ASIA,
        engine=SearchEngine.EXA,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "ur"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "who-emro": SourceMeta(
        id="who-emro",
        display_name="WHO EMRO",
        short_name="WHO EMRO",
        description="WHO Eastern Mediterranean regional office.",
        access=AccessTier.OPEN,
        depth=ContentDepth.GUIDELINE,
        evidence_tier=EvidenceTier.EXPERT_CONSENSUS,
        scope=GeographicScope.MIDDLE_EAST,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "ar"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "imemr": SourceMeta(
        id="imemr",
        display_name="IMEMR",
        short_name="IMEMR",
        description="Index Medicus for the Eastern Mediterranean Region.",
        access=AccessTier.OPEN,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.MIDDLE_EAST,
        engine=SearchEngine.SEARXNG,
        update_cadence_days=90,
        cache_ttl_hours=168,
        languages=("en", "ar"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "jamia-hamdard": SourceMeta(
        id="jamia-hamdard",
        display_name="Jamia Hamdard",
        short_name="J. Hamdard",
        description="Jamia Hamdard University Unani research.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.ABSTRACT_ONLY,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.EXA,
        update_cadence_days=180,
        cache_ttl_hours=168,
        languages=("en", "ur"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "amu-unani": SourceMeta(
        id="amu-unani",
        display_name="AMU Unani",
        short_name="AMU",
        description="Aligarh Muslim University Unani faculty research.",
        access=AccessTier.HYBRID,
        depth=ContentDepth.THESIS,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.INDIA,
        engine=SearchEngine.EXA,
        update_cadence_days=180,
        cache_ttl_hours=168,
        languages=("en", "ur"),
        domains=frozenset({"unani"}),
        index_size_estimate="small",
    ),
    "ecam": SourceMeta(
        id="ecam",
        display_name="eCAM (Hindawi)",
        short_name="eCAM",
        description="Evidence-Based Complementary and Alternative Medicine journal.",
        access=AccessTier.OPEN,
        depth=ContentDepth.FULL_TEXT,
        evidence_tier=EvidenceTier.OBSERVATIONAL,
        scope=GeographicScope.GLOBAL,
        engine=SearchEngine.EXA,
        update_cadence_days=30,
        cache_ttl_hours=72,
        languages=("en",),
        domains=frozenset({"ayurveda", "homeopathy", "siddha", "unani"}),
        index_size_estimate="medium",
    ),
}


EVIDENCE_WEIGHT: Dict[EvidenceTier, float] = {
    EvidenceTier.SYSTEMATIC_REVIEW: 1.0,
    EvidenceTier.RCT: 0.85,
    EvidenceTier.OBSERVATIONAL: 0.65,
    EvidenceTier.EXPERT_CONSENSUS: 0.5,
    EvidenceTier.TRADITIONAL_RECORD: 0.35,
    EvidenceTier.UNKNOWN: 0.45,
}

ACCESS_WEIGHT: Dict[AccessTier, float] = {
    AccessTier.OPEN: 1.0,
    AccessTier.HYBRID: 0.8,
    AccessTier.RESTRICTED: 0.55,
    AccessTier.REGISTRY: 0.9,
}

# Keywords → domain (research / universal-search hinting; Oracle keeps domain_intelligence as authority for chat).
_DOMAIN_KEYWORDS: Dict[str, List[str]] = {
    "ayurveda": [
        "ayurveda", "ayurvedic", "dosha", "vata", "pitta", "kapha",
        "panchakarma", "rasayana", "charaka", "sushruta", "ashtanga hridayam",
        "triphala", "ashwagandha", "brahmi", "shatavari",
    ],
    "homeopathy": [
        "homeopathy", "homeopathic", "potency", "succussion", "materia medica",
        "repertory", "arnica", "belladonna", "organon",
    ],
    "siddha": [
        "siddha", "thokkanam", "varma", "agasthiyar", "kudineer", "siddha pharmacopoeia",
    ],
    "unani": [
        "unani", "tibb", "hakeem", "mizaj", "tabiyat", "avicenna", "unani formulary",
    ],
    "allopathy": [
        "clinical trial", "rct", "fda", "pharmacokinetics", "chemotherapy", "mri", "diabetes",
    ],
}

_DOMAIN_PATTERNS: Dict[str, re.Pattern] = {
    domain: re.compile(
        r"\b(?:" + "|".join(re.escape(k) for k in sorted(kws, key=len, reverse=True)) + r")\b",
        re.IGNORECASE,
    )
    for domain, kws in _DOMAIN_KEYWORDS.items()
}

QUERY_SYNONYMS: Dict[str, List[str]] = {
    "ashwagandha": ["withania somnifera", "winter cherry"],
    "brahmi": ["bacopa monnieri", "mandukparni"],
    "triphala": ["terminalia chebula", "emblica officinalis"],
    "turmeric": ["curcuma longa", "haridra"],
    "diabetes": ["prameha", "madhumeha"],
    "arthritis": ["sandhivata", "amavata"],
    "hypertension": ["raktagata vata", "high blood pressure"],
    "asthma": ["tamaka shwasa", "shwasa"],
}


def infer_domains_from_query(query: str, threshold: int = 1) -> List[str]:
    hits: Dict[str, int] = {}
    for domain, pattern in _DOMAIN_PATTERNS.items():
        matches = pattern.findall(query)
        if matches:
            hits[domain] = len(matches)
    return [d for d, _ in sorted(hits.items(), key=lambda x: x[1], reverse=True) if hits[d] >= threshold]


def expand_query_with_synonyms(
    query: str,
    domains: Optional[List[str]] = None,
    max_expansions: int = 3,
) -> str:
    _ = domains
    expanded = query
    expansions_done = 0
    for term, synonyms in QUERY_SYNONYMS.items():
        if expansions_done >= max_expansions:
            break
        if re.search(r"\b" + re.escape(term) + r"\b", expanded, re.IGNORECASE):
            alt_str = " OR ".join(synonyms[:3])
            expanded = re.sub(
                r"\b" + re.escape(term) + r"\b",
                f"{term} ({alt_str})",
                expanded,
                flags=re.IGNORECASE,
                count=1,
            )
            expansions_done += 1
    return expanded


def build_searxng_query(
    user_query: str,
    source_ids: List[str],
    *,
    expand_synonyms: bool = True,
    domains: Optional[List[str]] = None,
    max_expansions: int = 3,
) -> str:
    from services.shared.domain_sources import SOURCE_SITE_FRAGMENT

    core_query = (
        expand_query_with_synonyms(user_query, domains, max_expansions)
        if expand_synonyms
        else user_query
    )
    frags: List[str] = []
    seen_frags: Set[str] = set()
    for sid in source_ids:
        frag = SOURCE_SITE_FRAGMENT.get(sid)
        if frag and frag not in seen_frags:
            frags.append(frag)
            seen_frags.add(frag)
    if not frags:
        return core_query
    if len(frags) == 1:
        site_clause = frags[0]
    else:
        parts = [f"({f})" if " OR " in f else f for f in frags]
        site_clause = "(" + " OR ".join(parts) + ")"
    return f"{core_query} {site_clause}"


def build_pubmed_query(user_query: str, *, expand_synonyms: bool = True) -> str:
    query = expand_query_with_synonyms(user_query, max_expansions=2) if expand_synonyms else user_query
    words = query.strip().split()
    if len(words) == 1:
        return f"{query}[All Fields]"
    return f"({query})[All Fields]"


def score_source_for_query(
    source_id: str,
    query: str,
    active_domains: List[str],
    *,
    prefer_open: bool = True,
    prefer_fresh: bool = True,
) -> float:
    meta = SOURCE_META.get(source_id)
    if meta is None:
        # Unknown pill id from Part 1: neutral-low so ranked list stays deterministic.
        return 0.35

    ev_w = EVIDENCE_WEIGHT[meta.evidence_tier]
    access_w = ACCESS_WEIGHT[meta.access] if prefer_open else 1.0
    domain_match = 1.0 if any(d in meta.domains for d in active_domains) else 0.55

    if prefer_fresh and meta.update_cadence_days > 0:
        fresh_w = 1.0 - (math.log1p(meta.update_cadence_days) / math.log1p(730))
        fresh_w = max(0.4, min(1.0, fresh_w))
    else:
        fresh_w = 0.75

    q_bonus = 1.0
    ql = query.lower()
    for token in (meta.short_name.lower(), meta.display_name.lower().split()[0]):
        if len(token) >= 3 and token in ql:
            q_bonus = 1.05
            break

    score = ev_w * access_w * domain_match * fresh_w * q_bonus
    return round(min(1.0, max(0.0, score)), 4)


def rank_sources(
    source_ids: List[str],
    query: str,
    active_domains: List[str],
    **score_kwargs: Any,
) -> List[Tuple[str, float]]:
    scored = [
        (sid, score_source_for_query(sid, query, active_domains, **score_kwargs))
        for sid in source_ids
    ]
    scored.sort(key=lambda x: (-x[1], x[0]))
    return scored


def ordered_pills_for_ui(
    source_ids: List[str],
    query: str,
    active_domains: List[str],
    *,
    max_pills: int = 16,
    pin_ids: Optional[List[str]] = None,
) -> List[str]:
    pin_ids = pin_ids or []
    pinned = [sid for sid in pin_ids if sid in source_ids]
    rest = [sid for sid in source_ids if sid not in pinned]
    ranked = [sid for sid, _ in rank_sources(rest, query, active_domains)]
    return (pinned + ranked)[:max_pills]


def split_by_access(source_ids: List[str]) -> Dict[str, List[str]]:
    buckets: Dict[str, List[str]] = {"open": [], "hybrid": [], "restricted": []}
    for sid in source_ids:
        meta = SOURCE_META.get(sid)
        if meta is None:
            buckets["open"].append(sid)
            continue
        tier = meta.access.value
        if tier in buckets:
            buckets[tier].append(sid)
        else:
            buckets["open"].append(sid)
    return buckets


def open_sources_only(source_ids: List[str]) -> List[str]:
    return [
        sid
        for sid in source_ids
        if SOURCE_META.get(sid) is not None
        and SOURCE_META[sid].access in (AccessTier.OPEN, AccessTier.HYBRID)
    ]


DEDUP_SOURCE_PRIORITY: List[str] = [
    "pubmed",
    "europe-pmc",
    "cochrane",
    "clinicaltrials",
    "ctri-india",
    "embase",
    "doaj",
    "core-hom",
    "homeopathy-research",
    "jaim",
    "ecam",
    "indian-journals",
    "shodhganga",
    "ccras",
    "ccrum",
    "ccrs",
    "ccrh",
    "niimh",
    "tkdl",
    "imppat",
]

_DEDUP_RANK: Dict[str, int] = {sid: i for i, sid in enumerate(DEDUP_SOURCE_PRIORITY)}


def dedup_results(
    results: List[Dict[str, Any]],
    *,
    id_field: str = "doi",
    title_field: str = "title",
    source_field: str = "source_id",
) -> List[Dict[str, Any]]:
    seen: Dict[str, Dict[str, Any]] = {}

    def _key(r: Dict[str, Any]) -> str:
        doi = str(r.get(id_field, "")).strip().lower()
        if doi:
            return doi
        title = str(r.get(title_field, ""))
        return re.sub(r"[^\w\s]", "", title.lower().strip())

    for result in results:
        k = _key(result)
        if not k:
            continue
        if k not in seen:
            seen[k] = result
        else:
            existing_src = seen[k].get(source_field, "")
            new_src = result.get(source_field, "")
            if _DEDUP_RANK.get(str(new_src), 999) < _DEDUP_RANK.get(str(existing_src), 999):
                seen[k] = result
    return list(seen.values())


INTEGRATIVE_PRECEDENCE: Dict[str, List[str]] = {
    "efficacy": ["allopathy", "ayurveda", "unani", "siddha", "homeopathy"],
    "safety": ["allopathy", "ayurveda", "unani", "siddha", "homeopathy"],
    "formulation": ["ayurveda", "unani", "siddha", "homeopathy", "allopathy"],
    "mechanism": ["allopathy", "ayurveda", "unani", "siddha", "homeopathy"],
    "history": ["ayurveda", "unani", "siddha", "homeopathy", "allopathy"],
}


def resolve_integrative_precedence(claim_type: str, available_domains: List[str]) -> List[str]:
    precedence = INTEGRATIVE_PRECEDENCE.get(claim_type, list(INTEGRATIVE_PRECEDENCE["efficacy"]))
    prec_rank = {d: i for i, d in enumerate(precedence)}
    return sorted(available_domains, key=lambda d: prec_rank.get(d, len(precedence)))


def cache_ttl_for_sources(source_ids: List[str]) -> int:
    ttls = [SOURCE_META[sid].cache_ttl_hours for sid in source_ids if sid in SOURCE_META]
    return min(ttls) if ttls else 24


def group_sources_by_engine(source_ids: List[str]) -> Dict[str, List[str]]:
    groups: Dict[str, List[str]] = {}
    for sid in source_ids:
        meta = SOURCE_META.get(sid)
        engine = meta.engine.value if meta else SearchEngine.AUTO.value
        groups.setdefault(engine, []).append(sid)
    return groups


def rank_source_ids_for_domain(
    domain_key: str,
    query: str = "",
    *,
    max_scan: int = 24,
) -> List[str]:
    """Ordered source pill ids for ``domain_key`` (Part 1 list), metadata-ranked."""
    from services.shared.domain_sources import DOMAIN_AUTO_SOURCES

    candidates = DOMAIN_AUTO_SOURCES.get(domain_key, [])[:max_scan]
    return [sid for sid, _ in rank_sources(candidates, query or "", [domain_key])]


def source_meta_for_api() -> List[Dict[str, Any]]:
    """Serializable subset for GET /config/domain-sources."""
    out: List[Dict[str, Any]] = []
    for sid in sorted(SOURCE_META.keys()):
        m = SOURCE_META[sid]
        out.append(
            {
                "id": m.id,
                "short_name": m.short_name,
                "display_name": m.display_name,
                "description": m.description,
                "access": m.access.value,
                "evidence_tier": m.evidence_tier.name,
                "depth": m.depth.value,
                "scope": m.scope.value,
                "preferred_engine": m.engine.value,
            }
        )
    return out
