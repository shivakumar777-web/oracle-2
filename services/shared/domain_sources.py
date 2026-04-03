"""
Single source of truth for Universal Search domain → source pills and SearXNG site fragments.
Mirrors legacy orchestrator definitions; imported by research-service and exposed via GET /v1/config/domain-sources.
"""

from __future__ import annotations

from typing import Dict, List

# Site-scoped SearXNG helpers (source pill id → query fragment).
SOURCE_SITE_FRAGMENT: Dict[str, str] = {
    "cochrane": "site:cochranelibrary.com",
    "who": "site:who.int",
    "ayush-formulary": "(site:ccras.nic.in OR site:ayush.gov.in)",
    "ccrum": "(site:ccrum.net OR site:ccrum.res.in)",
    "ccrs": "site:ccrs.gov.in",
    "homeopathy-research": "site:hri-research.org",
    "embase": "site:embase.com",
    "radiopaedia": "site:radiopaedia.org",
    "uptodate": "site:uptodate.com",
    "doaj": "site:doaj.org",
    "indian-journals": "(site:ijam.co.in OR site:ayujournal.org)",
    "ncbi-books": "site:ncbi.nlm.nih.gov/books",
    "ctri-india": "site:ctri.nic.in",
    "who-iris": "site:iris.who.int",
    "europe-pmc": "site:europepmc.org",
    "who-gim": "site:globalindexmedicus.net",
    "indmed": "site:indmed.nic.in",
    "cdsco": "site:cdsco.gov.in",
    "icmr": "site:icmr.gov.in",
    "nice": "site:nice.org.uk",
    "nccih": "site:nccih.nih.gov",
    "ecam": "site:hindawi.com/journals/ecam",
    "ccras": "site:ccras.nic.in",
    "ayush-portal": "site:ayushresearch.gov.in",
    "pcimh": "site:pcimh.gov.in",
    "pharmacopoeia-ayush": "(site:pharmacopoeia.ayush.gov.in OR site:pcimh.gov.in)",
    "shodhganga": "site:shodhganga.inflibnet.ac.in",
    "niimh": "site:niimh.nic.in",
    "tkdl": "site:tkdl.res.in",
    "imppat": "site:cb.imsc.res.in",
    "nmpb": "site:nmpb.nic.in",
    "frlht-medplant": "site:frlht.org",
    "jaim": "site:jaim.in",
    "ccrh": "site:ccrhindia.nic.in",
    "core-hom": "site:carstens-stiftung.de",
    "nis-chennai": "site:nischennai.org",
    "tnmgrmu": "site:tnmgrmu.ac.in",
    "nium": "site:nium.in",
    "hamdard-medicus": "site:hamdard.edu.pk",
    "who-emro": "(site:emro.who.int OR site:applications.emro.who.int)",
    "imemr": "site:applications.emro.who.int/imemr",
    "jamia-hamdard": "site:jhamdard.edu",
    "amu-unani": "site:amu.ac.in",
}

DOMAIN_AUTO_SOURCES: Dict[str, List[str]] = {
    "allopathy": [
        "pubmed",
        "clinicaltrials",
        "cochrane",
        "who",
        "embase",
        "radiopaedia",
        "uptodate",
        "ctri-india",
        "who-iris",
        "europe-pmc",
        "who-gim",
        "indmed",
        "cdsco",
        "icmr",
        "nice",
        "nccih",
    ],
    "ayurveda": [
        "ccras",
        "ayush-formulary",
        "ayush-portal",
        "pcimh",
        "pharmacopoeia-ayush",
        "shodhganga",
        "niimh",
        "tkdl",
        "imppat",
        "nmpb",
        "frlht-medplant",
        "jaim",
        "pubmed",
        "cochrane",
        "doaj",
        "indian-journals",
        "nccih",
    ],
    "homeopathy": [
        "ccrh",
        "pcimh",
        "core-hom",
        "homeopathy-research",
        "pubmed",
        "cochrane",
        "doaj",
        "nccih",
    ],
    "siddha": [
        "ccrs",
        "pcimh",
        "shodhganga",
        "nis-chennai",
        "tnmgrmu",
        "pubmed",
        "doaj",
        "indian-journals",
        "ayush-formulary",
        "niimh",
    ],
    "unani": [
        "ccrum",
        "pcimh",
        "shodhganga",
        "nium",
        "hamdard-medicus",
        "who-emro",
        "imemr",
        "jamia-hamdard",
        "amu-unani",
        "pubmed",
        "doaj",
        "indian-journals",
    ],
}

INTEGRATIVE_CROSS_DOMAIN_CORE: List[str] = [
    "europe-pmc",
    "ctri-india",
    "who-iris",
    "ayush-portal",
    "shodhganga",
    "pcimh",
    "nccih",
    "who-gim",
    "ecam",
    "pubmed",
    "doaj",
    "cochrane",
]


def get_sources_for_domains(domains: List[str]) -> List[str]:
    """Auto-select all relevant source pill ids for chosen medical traditions."""
    sources: set[str] = set()
    for d in domains:
        for s in DOMAIN_AUTO_SOURCES.get(d, []):
            sources.add(s)
    if len(domains) >= 2:
        for s in INTEGRATIVE_CROSS_DOMAIN_CORE:
            sources.add(s)
    return sorted(sources)
