"""
query_intelligence.py — Basic Query Classifier for Oracle Chat
================================================================
Lightweight, keyword-based classifier for routing queries to optimal sources.
No LLM calls. Used by Phase 1 hybrid RAG to inform source selection.

Query types:
  - clinical_trial: best served by ClinicalTrials.gov, PubMed trials
  - drug: drug interactions, dosing, pharmacology
  - emergency: urgent/acute care — fast-track, disclaimers
  - general: broad medical questions — web + internal RAG
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Set, Tuple


class QueryType(str, Enum):
    """Classification of user query intent."""

    CLINICAL_TRIAL = "clinical_trial"
    DRUG = "drug"
    EMERGENCY = "emergency"
    GENERAL = "general"


# Keyword sets for classification (lowercase)
_CLINICAL_TRIAL_KEYWORDS: Set[str] = frozenset({
    "trial", "trials", "clinical trial", "phase 1", "phase 2", "phase 3",
    "phase 4", "nct", "ctri", "registered", "recruiting", "enrollment",
    "randomized", "placebo", "double-blind", "rct", "cohort study",
})

_DRUG_KEYWORDS: Set[str] = frozenset({
    "drug", "drugs", "medication", "medicine", "dose", "dosing",
    "interaction", "interactions", "contraindication", "side effect",
    "adverse", "pharmacology", "pharmacokinetic", "metabolism",
    "prescription", "otc", "generic", "brand", "mg", "tablet",
})

_EMERGENCY_KEYWORDS: Set[str] = frozenset({
    "emergency", "urgent", "acute", "immediate", "right now",
    "chest pain", "stroke", "heart attack", "bleeding", "unconscious",
    "poisoning", "overdose", "anaphylaxis", "seizure", "seizing",
})


@dataclass
class QueryClassification:
    """Result of query classification."""

    query_type: QueryType
    confidence: float  # 0.0–1.0
    matched_keywords: List[str]


def _tokenize(text: str) -> List[str]:
    """Extract lowercase tokens (words and bigrams) from text."""
    text = text.lower().strip()
    # Remove punctuation for word boundaries
    cleaned = re.sub(r"[^\w\s]", " ", text)
    words = cleaned.split()
    tokens: List[str] = list(words)
    # Add bigrams for phrases like "clinical trial"
    for i in range(len(words) - 1):
        tokens.append(f"{words[i]} {words[i+1]}")
    return tokens


def classify_query(query: str) -> QueryClassification:
    """Classify a medical query into one of QueryType.

    Uses simple keyword matching. First match wins in priority order:
    emergency > clinical_trial > drug > general.
    """
    if not query or not query.strip():
        return QueryClassification(
            query_type=QueryType.GENERAL,
            confidence=0.0,
            matched_keywords=[],
        )

    tokens = _tokenize(query)
    token_set = set(tokens)

    # Priority 1: Emergency (safety-critical)
    emergency_matches = token_set & _EMERGENCY_KEYWORDS
    if emergency_matches:
        return QueryClassification(
            query_type=QueryType.EMERGENCY,
            confidence=min(0.95, 0.6 + 0.1 * len(emergency_matches)),
            matched_keywords=sorted(emergency_matches),
        )

    # Priority 2: Clinical trial
    trial_matches = token_set & _CLINICAL_TRIAL_KEYWORDS
    if trial_matches:
        return QueryClassification(
            query_type=QueryType.CLINICAL_TRIAL,
            confidence=min(0.9, 0.5 + 0.1 * len(trial_matches)),
            matched_keywords=sorted(trial_matches),
        )

    # Priority 3: Drug-related
    drug_matches = token_set & _DRUG_KEYWORDS
    if drug_matches:
        return QueryClassification(
            query_type=QueryType.DRUG,
            confidence=min(0.85, 0.45 + 0.1 * len(drug_matches)),
            matched_keywords=sorted(drug_matches),
        )

    # Default: General medical query
    return QueryClassification(
        query_type=QueryType.GENERAL,
        confidence=0.5,
        matched_keywords=[],
    )


# ═══════════════════════════════════════════════════════════════════════
#  QUERY EXPANSION (Phase 2)
# ═══════════════════════════════════════════════════════════════════════

# Common term → MeSH / formal equivalents for better PubMed/Meilisearch recall
_MESH_MAP: Dict[str, str] = {
    "diabetes": "diabetes mellitus",
    "heart attack": "myocardial infarction",
    "high blood pressure": "hypertension",
    "bp": "blood pressure",
    "stroke": "cerebrovascular accident",
    "kidney": "renal",
    "liver": "hepatic",
    "cancer": "neoplasm",
    "depression": "depressive disorder",
    "anxiety": "anxiety disorder",
    "alzheimer": "alzheimer disease",
    "parkinson": "parkinson disease",
}

# Synonym expansion for treatment-related queries
_TREATMENT_SYNONYMS: List[Tuple[str, str]] = [
    ("treatment", "management"),
    ("treatment", "therapy"),
    ("treatment", "intervention"),
    ("management", "therapy"),
    ("drug", "medication"),
    ("medicine", "medication"),
]


def expand_query(query: str, domain: str = "allopathy", max_variations: int = 3) -> List[str]:
    """Generate query variations for better retrieval coverage.

    Uses MeSH term mapping, synonym expansion, and related-term substitution.
    Returns [original, ...variations] up to max_variations total.
    """
    if not query or not query.strip():
        return [query]

    q_lower = query.lower().strip()
    variations: List[str] = [query]

    # MeSH term expansion (allopathy domain)
    if domain == "allopathy":
        for common, mesh in _MESH_MAP.items():
            if common in q_lower:
                expanded = query + f" OR {mesh}"
                if expanded not in variations:
                    variations.append(expanded)
                break  # One MeSH expansion per query

    # Synonym expansion for treatment/therapy queries
    for term_a, term_b in _TREATMENT_SYNONYMS:
        if term_a in q_lower and term_b not in q_lower:
            variant = q_lower.replace(term_a, term_b)
            if variant != q_lower and variant not in variations:
                variations.append(variant)
            if len(variations) >= max_variations:
                break

    return variations[:max_variations]
