"""
m5_engine.py — M5 Five Domain Intelligence Engine
===================================================
Provides parallel answers from all 5 medical systems:
- Allopathy (Modern Medicine)
- Ayurveda (Traditional Indian Medicine)
- Homeopathy (Similia Similibus Curentur)
- Siddha (Ancient Tamil Medicine)
- Unani (Greco-Arabic Medicine)

The M5 engine queries each domain in parallel, applies domain-specific
intelligence, and synthesizes a comparative response showing how each
system approaches the same medical question.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Any, AsyncGenerator
import json

from domain_intelligence import (
    MedicalDomain,
    expand_query_for_domain,
    get_domain_system_prompt,
    get_domain_trust_boost,
    should_prioritize_domain_sources,
)
from query_intelligence import classify_query, QueryType
from source_router import route_sources, SourceStrategy


@dataclass
class DomainAnswer:
    """Answer from a single medical domain."""
    domain: MedicalDomain
    domain_name: str
    content: str
    sources: List[Dict[str, Any]] = field(default_factory=list)
    confidence: int = 85
    key_concepts: List[str] = field(default_factory=list)
    treatment_approach: str = ""
    evidence_level: str = ""


@dataclass
class M5Response:
    """Complete M5 response with all 5 domain answers."""
    query: str
    allopathy: DomainAnswer
    ayurveda: DomainAnswer
    homeopathy: DomainAnswer
    siddha: DomainAnswer
    unani: DomainAnswer
    integrative_summary: str = ""
    cross_domain_insights: List[str] = field(default_factory=list)
    
    def get_all_answers(self) -> List[DomainAnswer]:
        """Return all 5 domain answers in standard order."""
        return [self.allopathy, self.ayurveda, self.homeopathy, self.siddha, self.unani]


# Domain display info for M5
DOMAIN_INFO: Dict[MedicalDomain, Dict[str, str]] = {
    MedicalDomain.ALLOPATHY: {
        "name": "Allopathy",
        "sanskrit": "आधुनिक चिकित्सा",
        "icon": "🩺",
        "color": "blue",
        "tagline": "Evidence-Based Modern Medicine",
    },
    MedicalDomain.AYURVEDA: {
        "name": "Ayurveda",
        "sanskrit": "आयुर्वेद",
        "icon": "🌿",
        "color": "gold",
        "tagline": "Science of Life & Longevity",
    },
    MedicalDomain.HOMEOPATHY: {
        "name": "Homeopathy",
        "sanskrit": "होमियोपैथी",
        "icon": "💧",
        "color": "teal",
        "tagline": "Like Cures Like",
    },
    MedicalDomain.SIDDHA: {
        "name": "Siddha",
        "sanskrit": "सिद्ध",
        "icon": "🔥",
        "color": "orange",
        "tagline": "Perfection Through Alchemy",
    },
    MedicalDomain.UNANI: {
        "name": "Unani",
        "sanskrit": "यूनानी",
        "icon": "⚗️",
        "color": "purple",
        "tagline": "Greco-Arabic Wisdom",
    },
}


def get_domain_badge_color(domain: MedicalDomain) -> str:
    """Get badge color class for a domain."""
    colors = {
        MedicalDomain.ALLOPATHY: "bg-blue-500/10 text-blue-300 border-blue-500/25",
        MedicalDomain.AYURVEDA: "bg-gold/10 text-gold-h border-gold/25",
        MedicalDomain.HOMEOPATHY: "bg-teal/10 text-teal-h border-teal/25",
        MedicalDomain.SIDDHA: "bg-orange-500/10 text-orange-300 border-orange-500/25",
        MedicalDomain.UNANI: "bg-purple-500/10 text-purple-300 border-purple-500/25",
    }
    return colors.get(domain, "bg-white/5 text-cream/40 border-white/10")


def generate_integrative_summary(answers: List[DomainAnswer], query: str) -> str:
    """Generate cross-domain integrative insights."""
    insights = []
    
    # Check for common approaches
    all_treatments = [a.treatment_approach.lower() for a in answers if a.treatment_approach]
    
    # Evidence comparison
    modern_evidence = answers[0].evidence_level if answers else ""
    traditional_evidence = [a.evidence_level for a in answers[1:] if a.evidence_level]
    
    insights.append(
        "Each system offers a unique lens: Allopathy focuses on biochemical pathways and RCT evidence; "
        "Ayurveda emphasizes dosha balance and digestive fire (agni); Homeopathy applies the law of similars; "
        "Siddha works with alchemical preparations and pulse diagnosis; Unani balances the four humors."
    )
    
    # Safety note
    insights.append(
        "⚕️ Integrative approaches combining these systems are growing in research. "
        "Always consult qualified practitioners from each system before combining treatments."
    )
    
    return "\n\n".join(insights)


def extract_key_concepts(content: str, domain: MedicalDomain) -> List[str]:
    """Extract key concepts from domain answer."""
    concepts = []
    content_lower = content.lower()
    
    # Domain-specific concept extraction
    if domain == MedicalDomain.ALLOPATHY:
        concept_keywords = [
            "clinical trial", "randomized", "placebo", "efficacy", "safety",
            "mechanism", "dosage", "contraindication", "side effect",
            "guideline", "meta-analysis", "systematic review"
        ]
    elif domain == MedicalDomain.AYURVEDA:
        concept_keywords = [
            "dosha", "vata", "pitta", "kapha", "agni", "prakriti",
            "panchakarma", "rasayana", "ojas", "dhatu", "srotas",
            "taste", "quality", "potency", "post-digestive"
        ]
    elif domain == MedicalDomain.HOMEOPATHY:
        concept_keywords = [
            "similimum", "potency", "dilution", "proving", "totality",
            "vital force", "constitutional", "keynote", "modalities",
            "miasm", "chronic disease", "acute"
        ]
    elif domain == MedicalDomain.SIDDHA:
        concept_keywords = [
            "tattva", "naadi", "mooligai", "thathu", "paashanam",
            "kayakalpa", "vaalvu", "muppu", "ooli", "vatha noi",
            "choornam", "thailam", "kudineer"
        ]
    elif domain == MedicalDomain.UNANI:
        concept_keywords = [
            "mizaj", "akhlat", "dam", "balgham", "safra", "sauda",
            "quwat", "tabiyat", "asbab sitta", "tadbeer", "hijama",
            "ilaj", "dawa", "ghiza"
        ]
    else:
        concept_keywords = []
    
    for kw in concept_keywords:
        if kw in content_lower:
            concepts.append(kw.title() if kw != kw.lower() else kw)
    
    return concepts[:5]  # Top 5 concepts


def extract_treatment_approach(content: str, domain: MedicalDomain) -> str:
    """Extract treatment approach summary from domain answer."""
    # Look for treatment/management section
    treatment_indicators = [
        "treatment", "management", "therapy", "approach",
        "chikitsa", "ilaj", "cure", "remedy", "intervention"
    ]
    
    lines = content.split("\n")
    for line in lines:
        line_lower = line.lower()
        if any(ind in line_lower for ind in treatment_indicators):
            # Clean up the line
            cleaned = line.strip().replace("**", "").replace("##", "").strip()
            if len(cleaned) > 20 and len(cleaned) < 200:
                return cleaned
    
    return "See full response for detailed approach"


def determine_evidence_level(content: str, domain: MedicalDomain) -> str:
    """Determine evidence quality level for domain."""
    content_lower = content.lower()
    
    if domain == MedicalDomain.ALLOPATHY:
        if "systematic review" in content_lower or "meta-analysis" in content_lower:
            return "High (Systematic Review)"
        elif "rct" in content_lower or "randomized" in content_lower:
            return "High (RCT)"
        elif "clinical trial" in content_lower:
            return "Moderate (Clinical Trial)"
        elif "observational" in content_lower:
            return "Moderate (Observational)"
        elif "expert opinion" in content_lower or "consensus" in content_lower:
            return "Low-Moderate (Expert)"
        else:
            return "Standard Practice"
    else:
        # Traditional systems
        if "clinical trial" in content_lower or "study" in content_lower:
            return "Emerging (Modern Research)"
        elif "classical text" in content_lower or "samhita" in content_lower:
            return "Traditional (Classical)"
        elif "thousands of years" in content_lower or "ancient" in content_lower:
            return "Traditional (Historical)"
        else:
            return "Traditional Practice"


# ═══════════════════════════════════════════════════════════════════════
#  M5 STREAMING FORMAT
# ═══════════════════════════════════════════════════════════════════════

async def stream_m5_response(
    query: str,
    domain_answers: List[DomainAnswer],
    integrative_summary: str,
) -> AsyncGenerator[str, None]:
    """Stream M5 response as SSE events.
    
    Yields structured events for frontend to build the M5 display.
    """
    # Start event
    yield 'data: {"type": "m5_start", "query": "' + json.dumps(query)[1:-1] + '"}\n\n'
    
    # Stream each domain answer
    for answer in domain_answers:
        domain_info = DOMAIN_INFO.get(answer.domain, {})
        payload = {
            "type": "m5_domain",
            "domain": answer.domain.value,
            "domain_name": answer.domain_name,
            "icon": domain_info.get("icon", ""),
            "color": domain_info.get("color", ""),
            "tagline": domain_info.get("tagline", ""),
            "content": answer.content,
            "sources": answer.sources,
            "confidence": answer.confidence,
            "key_concepts": answer.key_concepts,
            "treatment_approach": answer.treatment_approach,
            "evidence_level": answer.evidence_level,
        }
        yield f'data: {json.dumps(payload)}\n\n'
        # Small delay for streaming effect
        await asyncio.sleep(0.05)
    
    # Integrative summary
    yield f'data: {json.dumps({"type": "m5_summary", "content": integrative_summary})}\n\n'
    
    # Done event
    yield 'data: {"type": "done"}\n\n'


# ═══════════════════════════════════════════════════════════════════════
#  BUILD M5 RESPONSE (Post-processing)
# ═══════════════════════════════════════════════════════════════════════

def build_m5_response_from_parts(
    query: str,
    domain_contents: Dict[MedicalDomain, str],
    domain_sources: Dict[MedicalDomain, List[Dict[str, Any]]],
) -> M5Response:
    """Build complete M5 response from individual domain contents."""
    
    answers = []
    for domain in MedicalDomain:
        content = domain_contents.get(domain, "")
        sources = domain_sources.get(domain, [])
        
        # Extract metadata
        key_concepts = extract_key_concepts(content, domain)
        treatment_approach = extract_treatment_approach(content, domain)
        evidence_level = determine_evidence_level(content, domain)
        
        # Calculate average confidence from sources
        if sources:
            avg_confidence = sum(s.get("trustScore", 85) for s in sources) // len(sources)
        else:
            avg_confidence = 85
        
        answer = DomainAnswer(
            domain=domain,
            domain_name=DOMAIN_INFO[domain]["name"],
            content=content,
            sources=sources,
            confidence=avg_confidence,
            key_concepts=key_concepts,
            treatment_approach=treatment_approach,
            evidence_level=evidence_level,
        )
        answers.append(answer)
    
    # Generate integrative summary
    integrative_summary = generate_integrative_summary(answers, query)
    
    return M5Response(
        query=query,
        allopathy=answers[0],   # ALLOPATHY
        ayurveda=answers[1],    # AYURVEDA
        homeopathy=answers[2],  # HOMEOPATHY
        siddha=answers[3],      # SIDDHA
        unani=answers[4],       # UNANI
        integrative_summary=integrative_summary,
        cross_domain_insights=[
            "Each system has unique diagnostic methods",
            "Treatment philosophies differ fundamentally",
            "Evidence types vary across systems",
            "Integrative approaches require expert guidance",
        ],
    )


# ═══════════════════════════════════════════════════════════════════════
#  M5 REQUEST MODEL
# ═══════════════════════════════════════════════════════════════════════

def create_m5_system_appendix() -> str:
    """Create system appendix explaining M5 mode to LLM."""
    return """
You are answering in M5 (Five Domain) mode. The user will see your response alongside answers from 4 other medical systems. 

Your task:
1. Provide a comprehensive answer from YOUR assigned domain perspective
2. Emphasize what makes your domain unique (diagnostics, treatments, philosophy)
3. Use domain-appropriate terminology and concepts
4. Cite sources when available
5. Include practical guidance where appropriate

Structure your answer with:
- Brief domain philosophy/context (1-2 sentences)
- Main answer addressing the user's question
- Key concepts/terms specific to your system
- Treatment/management approach
- Evidence basis (what type of evidence supports this)

Keep answers informative but concise (300-500 words) so users can compare across all 5 systems.
"""