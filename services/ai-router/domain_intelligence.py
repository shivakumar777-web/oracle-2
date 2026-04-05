"""
domain_intelligence.py — Domain-Specific Medical Intelligence
===============================================================
Provides deep domain awareness for the five medical systems:
- Allopathy (Modern Medicine)
- Ayurveda (Traditional Indian Medicine)
- Homeopathy (Similia Similibus Curentur)
- Siddha (Ancient Tamil Medicine)
- Unani (Greco-Arabic Medicine)

Features:
  • Domain-specific query expansion (technical terms, synonyms)
  • Domain-specific source routing and prioritization
  • Domain-aware trust scoring boosts
  • Rich system prompts with medical philosophy
  • Domain evidence hierarchies
"""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from typing import Dict, List, Set, Tuple, Optional, Any


class MedicalDomain(str, Enum):
    """The five medical systems supported by Manthana."""
    
    ALLOPATHY = "allopathy"
    AYURVEDA = "ayurveda"
    HOMEOPATHY = "homeopathy"
    SIDDHA = "siddha"
    UNANI = "unani"


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN-SPECIFIC QUERY EXPANSION
# ═══════════════════════════════════════════════════════════════════════

# Allopathy: MeSH and modern medical terminology
ALLOPATHY_MESH_MAP: Dict[str, str] = {
    "diabetes": "diabetes mellitus",
    "heart attack": "myocardial infarction",
    "high blood pressure": "hypertension",
    "stroke": "cerebrovascular accident",
    "kidney": "renal",
    "liver": "hepatic",
    "cancer": "neoplasm",
    "depression": "major depressive disorder",
    "anxiety": "anxiety disorder",
    "alzheimer": "alzheimer disease",
    "parkinson": "parkinson disease",
    "chest pain": "angina pectoris",
    "shortness of breath": "dyspnea",
    "fever": "pyrexia",
    "cough": "tussis",
    "headache": "cephalalgia",
    "joint pain": "arthralgia",
    "stomach pain": "gastralgia",
    "skin rash": "dermatitis",
}

ALLOPATHY_SYNONYMS: List[Tuple[str, str]] = [
    ("treatment", "management"),
    ("treatment", "therapy"),
    ("drug", "medication"),
    ("medicine", "pharmaceutical"),
    ("pill", "tablet"),
    ("doctor", "physician"),
    ("surgery", "operation"),
    ("test", "diagnostic"),
    ("x-ray", "radiograph"),
    ("scan", "imaging"),
]

# Ayurveda: Sanskrit terms and classical concepts
AYURVEDA_TERM_MAP: Dict[str, str] = {
    "fever": "jwara",
    "cough": "kasa",
    "cold": "pratishyaya",
    "diabetes": "madhumeha",
    "digestion": "agni",
    "metabolism": "dhatwagni",
    "constipation": "vibandha",
    "diarrhea": "atisara",
    "joint pain": "sandhivata",
    "arthritis": "amavata",
    "obesity": "stholya",
    "insomnia": "anidra",
    "stress": "manasvikara",
    "anxiety": "chittodvega",
    "depression": "vishada",
    "skin disease": "kushtha",
    "acidity": "amlapitta",
    "gas": "adhmana",
    "bloating": "shoola",
    "headache": "shirashoola",
    "migraine": "ardhavabhedaka",
    "hypertension": "raktagatavata",
    "heart disease": "hridroga",
    "asthma": "shwasa",
    "breathing difficulty": "shwasa",
    "weakness": "dourbalya",
    "immunity": "ojas",
    "detox": "panchakarma",
    "rejuvenation": "rasayana",
    "hair fall": "khalitya",
    "hairfall": "khalitya",
    "hair loss": "khalitya",
    "alopecia": "indralupta",
    "baldness": "khalitya",
}

AYURVEDA_SYNONYMS: List[Tuple[str, str]] = [
    ("dosha", "tridosha"),
    ("vata", "vayu"),
    ("pitta", "agni"),
    ("kapha", "shleshma"),
    ("herb", "oushadhi"),
    ("medicine", "aushadha"),
    ("treatment", "chikitsa"),
    ("diet", "ahara"),
    ("lifestyle", "vihara"),
    ("oil", "taila"),
    ("powder", "churna"),
    ("decoction", "kadha"),
    ("tablet", "vati"),
    ("tonic", "asava"),
]

# Ayurveda: Classical Texts and Shloka Sources
AYURVEDA_CLASSICAL_TEXTS: List[str] = [
    "charaka samhita",
    "sushruta samhita", 
    "ashtanga hridaya",
    "ashtanga sangraha",
    "madhava nidana",
    "bhavaprakasha",
    "sharangdhara samhita",
    "bhela samhita",
    "kashyapa samhita",
    "agnivesha tantra",
    "hridaya dipaka",
    "vaidya jeevana",
    "chakradatta",
    "sushruta",
    "vagbhata",
]

# Ayurveda: Shloka-specific search terms for classical verse retrieval
AYURVEDA_SHLOKA_SEARCH_MAP: Dict[str, List[str]] = {
    "fever": ["jwara chikitsa", "jwara nidana", "santata jwara", "satata jwara"],
    "cough": ["kasa chikitsa", "kasa nidana", "shwasa kasa"],
    "cold": ["pratishyaya chikitsa", "peenasa", "nasa roga"],
    "diabetes": ["madhumeha chikitsa", "prameha", "meha roga"],
    "digestion": ["agni mandya", "ajeerna", "amlapitta"],
    "constipation": ["vibandha chikitsa", "malabaddhata"],
    "diarrhea": ["atisara chikitsa", "grahani", "pravahika"],
    "joint pain": ["sandhivata chikitsa", "vata vyadhi", "sandhi shoola"],
    "arthritis": ["amavata chikitsa", "vata rakta", "sandhigata vata"],
    "obesity": ["stholya chikitsa", "medo roga", "atisthaulya"],
    "insomnia": ["anidra chikitsa", "nidranasha", "swapna dushti"],
    "stress": ["manas roga", "chittodvega", "unmada"],
    "anxiety": ["chittodvega chikitsa", "manas chikitsa"],
    "depression": ["vishada chikitsa", "mano avasada"],
    "skin disease": ["kushtha chikitsa", "twak roga", "dadru"],
    "hair": ["khalitya chikitsa", "indralupta chikitsa", "kesha roga", "romakupa"],
    "acidity": ["amlapitta chikitsa", "parinaama shoola", "annadrava shoola"],
    "gas": ["adhmana chikitsa", "gulma", "shoola"],
    "bloating": ["shoola chikitsa", "udavarta", "anaha"],
    "headache": ["shirashoola chikitsa", "shiro roga", "aradhita"],
    "migraine": ["ardhavabhedaka chikitsa", "suryavarta", "anantavata"],
    "hypertension": ["raktagata vata chikitsa", "vata rakta", "raktadimutrata"],
    "heart disease": ["hridroga chikitsa", "hridya roga", "hridaya shoola"],
    "asthma": ["shwasa chikitsa", "tamaka shwasa", "maha shwasa"],
    "breathing difficulty": ["shwasa roga", "pranavaha srota roga"],
    "weakness": ["dourbalya chikitsa", "shrama", "kshata ksheena"],
    "immunity": ["ojas", "vyadhikshamatva", "bala vardhana"],
    "women health": ["stree roga", "yoni vyapath", "prasuti tantra"],
    "pregnancy": ["garbhini paricharya", "prasuti tantra", "stri roga"],
    "menstrual": ["rajah pravritti", "artava vyapath", "yonivyapath"],
    "piles": ["arshas chikitsa", "arsho roga", "guda roga"],
    "fistula": ["bhagandara chikitsa", "parikartika"],
    "eye": ["netra roga chikitsa", "shalakya tantra", "drishti roga"],
    "ear": ["karna roga chikitsa", "shalakya tantra", "karna shoola"],
    "throat": ["gala roga", "kanta roga", "shalakya tantra"],
    "dental": ["danta roga", "mukha roga", "danta sharkara"],
    "urinary": ["prameha", "mutra roga", "ashmari"],
    "kidney": ["vrikka roga", "mutravaha srotas"],
    "liver": ["yakrit roga", "kamala", "halimaka"],
    "thyroid": ["galaganda", "apachi", "gandamala"],
}

# Homeopathy: Materia medica terms
HOMEOPATHY_TERM_MAP: Dict[str, str] = {
    "fever": "pyrexia",
    "cold": "coryza",
    "cough": "tussis",
    "diarrhea": "enteritis",
    "constipation": "obstipation",
    "headache": "cephalalgia",
    "migraine": "hemicrania",
    "joint pain": "arthralgia",
    "arthritis": "arthritic diathesis",
    "skin rash": "eruption",
    "eczema": "eczema",
    "acidity": "dyspepsia",
    "gas": "flatulence",
    "weakness": "asthenia",
    "anxiety": "nervousness",
    "depression": "melancholia",
    "insomnia": "sleeplessness",
    "allergy": "hypersensitivity",
    "asthma": "bronchial asthma",
}

HOMEOPATHY_SYNONYMS: List[Tuple[str, str]] = [
    ("medicine", "remedy"),
    ("treatment", "cure"),
    ("symptom", "indication"),
    ("disease", "morbid state"),
    ("patient", "prover"),
    ("doctor", "homeopath"),
    ("dose", "potency"),
    ("strong medicine", "high potency"),
    ("diluted", "potentized"),
    ("similar", "similimum"),
]

# Siddha: Tamil classical terms
SIDDHA_TERM_MAP: Dict[str, str] = {
    "fever": "suram",
    "cough": "irumal",
    "cold": "silai",
    "diabetes": "mootha noi",
    "joint pain": "vatha noi",
    "arthritis": "vatha rogam",
    "skin disease": "sedhi noi",
    "digestion": "jatharagni",
    "constipation": "malabadham",
    "diarrhea": "perumal noi",
    "headache": "thalaivali",
    "migraine": "thalaivali",
    "weakness": "sina mai",
    "immunity": "ooli",
    "longevity": "vaalvu",
    "rejuvenation": "kayakalpa",
    "detox": "purgation",
    "eye disease": "kan noi",
    "ear problem": "sevi noi",
    "throat": "thondai",
    "stomach": "amaivayiru",
    "heart": "hridayam",
    "lungs": "ilai",
    "kidney": "varatti",
    "liver": "karal",
}

SIDDHA_SYNONYMS: List[Tuple[str, str]] = [
    ("medicine", "marunthu"),
    ("herb", "mooligai"),
    ("treatment", "tharapathy"),
    ("doctor", "vaidyar"),
    ("patient", "rogia"),
    ("diagnosis", "noi nedum"),
    ("cure", "therpu"),
    ("powder", "choornam"),
    ("liquid", "kudineer"),
    ("oil", "thailam"),
    ("metal", "paashanam"),
    ("mineral", "dhatu"),
]

# Unani: Arabic/Persian medical terms
UNANI_TERM_MAP: Dict[str, str] = {
    "fever": "humma",
    "cough": "sual",
    "cold": "nazla",
    "diabetes": "ziabitus",
    "digestion": "hazm",
    "constipation": "qabz",
    "diarrhea": "ishal",
    "joint pain": "waja ul mafasil",
    "arthritis": "waja ul mafasil",
    "headache": "sudaq",
    "migraine": "shaqiqa",
    "skin disease": "amraz e jild",
    "heart disease": "amraz e qalb",
    "liver disease": "amraz e jigar",
    "stomach": "maeda",
    "acidity": "souda",
    "gas": "nafakh",
    "bloating": "intifakh",
    "weakness": "zof",
    "immunity": "quwat e mudafat",
    "energy": "quwat",
    "temperament": "mizaj",
    "humor": "khilt",
    "blood": "dam",
    "phlegm": "balgham",
    "yellow bile": "safra",
    "black bile": "sauda",
}

UNANI_SYNONYMS: List[Tuple[str, str]] = [
    ("medicine", "dawa"),
    ("treatment", "ilaj"),
    ("doctor", "tabib"),
    ("hospital", "bimarestan"),
    ("patient", "mareez"),
    ("diagnosis", "tashkhees"),
    ("cure", "shifa"),
    ("herb", "hashish"),
    ("diet", "ghiza"),
    ("lifestyle", "tadabeer"),
    ("massage", "dalk"),
    ("cupping", "hijama"),
    ("sweating", "taareeq"),
    ("purging", "ishaal"),
]


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN-SPECIFIC SOURCE PRIORITIES
# ═══════════════════════════════════════════════════════════════════════

DOMAIN_SOURCE_PRIORITY: Dict[MedicalDomain, List[str]] = {
    MedicalDomain.ALLOPATHY: [
        "pubmed.ncbi.nlm.nih.gov",
        "ncbi.nlm.nih.gov",
        "cochranelibrary.com",
        "who.int",
        "icmr.gov.in",
        "mohfw.gov.in",
        "clinicaltrials.gov",
        "thelancet.com",
        "nejm.org",
        "bmj.com",
        "jamanetwork.com",
        "aiims.edu",
        "nimhans.ac.in",
    ],
    MedicalDomain.AYURVEDA: [
        # Classical Ayurvedic Text Sources (Highest Priority)
        "charakasamhita.nic.in",
        "sushrutasamhita.org",
        "ashtangahridaya.com",
        "ayurveda.com",
        "niimh.nic.in",  # National Institute of Indian Medical Heritage
        "niam.nic.in",   # National Institute of Ayurveda
        # Government AYUSH Sources
        "ayush.gov.in",
        "ccras.nic.in",
        "nmpb.nic.in",
        "aiia.edu.in",   # All India Institute of Ayurveda
        "rastrotthana.org",  # Rashtriya Ayurveda Vidyapeeth
        # Academic & Research Institutions
        "giriayurveda.com",
        "ayurvedicperspective.com",
        "easyayurveda.com",
        "ayurvedam.com",
        "dabur.com",
        "himalayahealthcare.com",
        # Modern research (lower priority for traditional queries)
        "pubmed.ncbi.nlm.nih.gov",
        "ncbi.nlm.nih.gov",
    ],
    MedicalDomain.HOMEOPATHY: [
        "ccrh.gov.in",
        "ayush.gov.in",
        "pubmed.ncbi.nlm.nih.gov",  # For clinical trials
        "clinicaltrials.gov",
    ],
    MedicalDomain.SIDDHA: [
        "ccsiddha.nic.in",
        "ayush.gov.in",
        "ccras.nic.in",
        "nmpb.nic.in",
    ],
    MedicalDomain.UNANI: [
        "ccrum.net",
        "ayush.gov.in",
        "who.int",  # EMRO for traditional medicine
        "emro.who.int",
    ],
}

# Domain-specific trust score boosts
DOMAIN_TRUST_BOOST: Dict[MedicalDomain, Dict[str, int]] = {
    MedicalDomain.AYURVEDA: {
        "ayush.gov.in": 10,
        "ccras.nic.in": 10,
        "nmpb.nic.in": 8,
        "niimh.nic.in": 8,
    },
    MedicalDomain.HOMEOPATHY: {
        "ccrh.gov.in": 10,
        "ayush.gov.in": 8,
    },
    MedicalDomain.SIDDHA: {
        "ccsiddha.nic.in": 10,
        "ayush.gov.in": 8,
        "nmpb.nic.in": 8,
    },
    MedicalDomain.UNANI: {
        "ccrum.net": 10,
        "ayush.gov.in": 8,
        "emro.who.int": 5,
    },
}


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN PROMPTS (Enhanced System Instructions)
# ═══════════════════════════════════════════════════════════════════════

DOMAIN_SYSTEM_PROMPTS: Dict[MedicalDomain, str] = {
    MedicalDomain.ALLOPATHY: """You are providing evidence-based modern medical information.

Core Principles:
- Base answers on peer-reviewed research, clinical trials, and established guidelines
- Reference specific studies when possible ( randomized controlled trials, meta-analyses)
- Use medical terminology appropriately for the persona (patient vs clinician)
- Acknowledge uncertainties and evidence gaps
- Prioritize safety-critical information

Evidence Hierarchy (highest to lowest):
1. Systematic reviews and meta-analyses (Cochrane, PubMed)
2. Randomized controlled trials (RCTs)
3. Cohort and case-control studies
4. Expert consensus and clinical guidelines (WHO, NIH, ICMR)
5. Case reports and clinical experience

When discussing treatments:
- Mention standard of care first
- Note contraindications and side effects
- Include dosing where appropriate
- Reference specific guidelines (e.g., ADA for diabetes, AHA for heart disease)""",

    MedicalDomain.AYURVEDA: """You are a classical Ayurvedic vaidya (physician) providing authentic wisdom from the Brihat Trayi and Laghu Trayi texts. Your answers must be rooted in Samhita scriptures with proper Sanskrit shlokas.

═══════════════════════════════════════════════════════════════
MANDATORY: SANSKRIT SHLOKA CITATION REQUIREMENT (1–4 VERSES)
═══════════════════════════════════════════════════════════════

For EVERY answer about a condition, nidana, chikitsa, or dravya, you MUST include **between 1 and 4** of the **most relevant, authenticated** Sanskrit shlokas to the user's question—not filler verses. Prefer fewer, highly pertinent citations over many weak ones.

For **each** shloka (repeat this block per verse, numbered **Shloka 1** … **Shloka 4** as needed):

1. **Sanskrit:** Verse in Devanagari (preferred) or precise IAST—only if you are confident it is from the cited source; do not invent or paraphrase as if it were a direct quote.
2. **Reference:** Full bibliographic pointer: Samhita name, **sthana/adhyaya** (section), and **verse number / shloka index** where known (e.g. "Charaka Samhita, Chikitsasthana 28.45" or standard abbreviation + ref such as च.चि.२८/४५).
3. **Translation:** Faithful meaning of the verse in clear English (or the user's language if appropriate).
4. **Clinical application:** One short paragraph linking this verse to the user's specific query (dosha, dhatu, roga, or aushadha).

**Rules:**
- Minimum **1** shloka; maximum **4** per reply unless the user explicitly asks for more.
- Choose verses that **directly** address the topic asked; skip loosely related quotations.
- If you cannot verify a verse, state uncertainty and give a **summary paraphrase** of the classical teaching without fake Devanagari.

Example Format (one verse; replicate up to four times):
> **Shloka 1**
> **Sanskrit:** योजयेत्कफसम्मूढं मारुतं तीव्रवेदनम् ॥ च.सू.१५/१० ॥
> **Reference:** Charaka Samhita, Sutrasthana 15.10
> **Translation:** When Vata is obstructed by Kapha causing severe pain...
> **Clinical application:** This describes the pathogenesis of Sandhivata (osteoarthritis) where Kapha accumulation blocks Vata movement in joints.

═══════════════════════════════════════════════════════════════
PRIMARY CLASSICAL TEXTS (Brihat Trayi & Laghu Trayi)
═══════════════════════════════════════════════════════════════

**Brihat Trayi (The Great Three):**
1. **Charaka Samhita** (चरकसंहिता) - Internal medicine, general principles
   - Sutrasthana (Fundamentals)
   - Nidanasthana (Diagnosis)
   - Vimanasthana (Specific pathology)
   - Sharirasthana (Anatomy)
   - Indriyasthana (Signs of death)
   - Chikitsasthana (Treatment)
   - Kalpasthana (Toxicology)
   - Siddhisthana (Pharmaceutical preparations)

2. **Sushruta Samhita** (सुश्रुतसंहिता) - Surgery, anatomy
   - Sutrasthana
   - Nidanasthana
   - Sharirasthana (Detailed anatomy)
   - Chikitsasthana
   - Kalpasthana
   - Uttaratantra (ENT, eye, pediatrics)

3. **Ashtanga Hridaya** (अष्टाङ्गहृदय) of Vagbhata - Concise compilation
   - Sutrasthana
   - Sarirasthana
   - Nidanasthana
   - Chikitsasthana
   - Kalpasthana
   - Uttarasthana

**Laghu Trayi (The Lesser Three):**
4. **Madhava Nidana** (माधवनिदान) - Diagnostic excellence (Roga Vinischaya)
5. **Bhavaprakasha** (भावप्रकाश) - Comprehensive materia medica
6. **Sharangdhara Samhita** (शार्ङ्गधरसंहिता) - Pharmaceutics, formulations

**Other Important Texts:**
- Kashyapa Samhita (Pediatrics, gynecology)
- Bhela Samhita
- Agnivesha Tantra (original Charaka redaction)
- Vagbhata's Ashtanga Sangraha
- Chakradatta (Chikitsa manual)
- Vaidya Jeevana
- Hridaya Dipaka

═══════════════════════════════════════════════════════════════
AYURVEDIC DIAGNOSTIC FRAMEWORKS
═══════════════════════════════════════════════════════════════

**Tridosha Theory (त्रिदोषसिद्धान्त):**
- Vata (वात) - Air/Ether elements: Movement, circulation, nervous system
- Pitta (पित्त) - Fire/Water elements: Digestion, metabolism, heat
- Kapha (कफ) - Earth/Water elements: Structure, lubrication, immunity

**Saptdhatu (Seven Tissues):**
1. Rasa (plasma) 2. Rakta (blood) 3. Mamsa (muscle) 4. Meda (fat)
5. Asthi (bone) 6. Majja (marrow) 7. Shukra (reproductive tissue)

**Trayodasha Agni (13 Digestive Fires):**
- Jatharagni (gastric), 5 Bhutagni (elemental), 7 Dhatwagni (tissue)

**Srotas (Channel Systems):**
- Pranavaha (respiratory), Annavaha (digestive), Udakavaha (water),
- Rasavaha (plasma), Raktavaha (blood), Mamsavaha (muscle),
- Medovaha (fat), Asthivaha (bone), Majjavaha (marrow),
- Shukravaha (reproductive), Mutravaha (urine), Purishavaha (feces),
- Artavavaha (menstrual), Stanyavaha (lactation), etc.

**Prakriti (Constitutional Typing):**
- Vataja, Pittaja, Kaphaja types and combinations
- Vikriti (current imbalance) vs Prakriti (innate nature)

**Panchakarma (Five Bio-Purification Procedures):**
1. Vamana (therapeutic emesis) 2. Virechana (purgation)
3. Basti (medicated enema) 4. Nasya (nasal administration)
5. Raktamokshana (bloodletting)

**Rasayana (Rejuvenation) & Vajikarana (Aphrodisiac/Vitality):**
- Ojas (vital immunity essence) enhancement
- Medhya rasayana (cognitive enhancers): Brahmi, Mandukaparni, Shankhapushpi

═══════════════════════════════════════════════════════════════
CLASSICAL AYURVEDIC PHARMACOPOEIA
═══════════════════════════════════════════════════════════════

**Mahakashayas (10 Great Groups of Herbs):** Reference Charaka Samhita Sutrasthana 4

**Single Herbs (Oushadhi/Oushadha):**
- Medhya (Brain/Memory): Brahmi, Shankhapushpi, Vacha, Jyotishmati, Mandukaparni, Yastimadhu
- Balya (Strength): Ashwagandha, Bala, Atibala, Kapikacchu, Shatavari
- Rasayana (Rejuvenation): Amalaki, Haritaki, Guduchi, Ashwagandha, Shatavari, Pippali
- Jwarahara (Antipyretic): Guduchi, Tulasi, Shunthi, Vasa, Kiratatikta
- Shwasahara (Respiratory): Vasa, Pushkaramoola, Shunthi, Bharangi, Kantakari
- Kanthya (Throat): Vacha, Yashtimadhu, Kataka, Brahmi
- Chakushya (Eye): Triphala, Shatavari, Amla, Punarnava
- Hridya (Cardiac): Arjuna, Pushkaramoola, Hridaya herbs
- Deepaniya (Appetizers): Chitraka, Shunthi, Pippali, Maricha
- Shoolaprashamana (Analgesic): Shunthi, Pippali, Maricha, Hingu
- Arshoghna (Piles): Haritaki, Aragvadha, Jimikand
- Kushtaghna (Skin): Khadira, Aragvadha, Manjishta, Sariva
- Vranaropana (Wound healing): Jatyadi taila, Karanja, Nimba, Haridra

**Classical Formulations (Yogas):**
- Chyawanprash (Rasayana)
- Triphala (Three fruits: Amalaki, Haritaki, Bibhitaki)
- Maharasanadi Kashaya (Neurological)
- Dashamoola (Ten roots - respiratory, inflammatory)
- Panchakola (Five pungents - digestive)
- Agastyaharitaki (Respiratory)
- Brahma Rasayana (Cognitive)
- Manasamitra Vataka (Psychiatric)
- Kalyanaka Ghrita (Psychiatric, neurological)
- Mahanarayana Taila (Musculoskeletal)
- Kumaryasava (Female reproductive)
- Ashokarishta (Female reproductive)
- Lodhrasava (Female reproductive)

**Bhasmas (Calcined Preparations):**
- Suvarna (Gold), Rajata (Silver), Tamra (Copper), Loha (Iron)
- Properly processed as per Rasa Shastra texts

═══════════════════════════════════════════════════════════════
RESPONSE STRUCTURE FOR AYURVEDA QUERIES
═══════════════════════════════════════════════════════════════

Your response MUST follow this structure:

## 1. Ayurvedic Pathogenesis (Samprapti)
- Explain the doshic imbalance causing the condition
- Reference relevant shlokas from Nidanasthana or Madhava Nidana
- Use Sanskrit terminology with explanations

## 2. Classical Sanskrit Shloka(s) with Interpretation
> Present the Sanskrit verse (in IAST/Devanagari if possible)
> Cite: Text Name, Chapter.Verse
> Provide word-by-word meaning
> Give clinical interpretation applicable to the patient's condition

## 3. Chikitsa Sutra (Treatment Principles)
- Shodhana (purification) if needed - which Panchakarma procedures
- Shamana (palliative) - diet, herbs, lifestyle
- Pathya (do's) and Apathya (don'ts)
- Reference specific shlokas on treatment

## 4. Aushadhi (Medicinal Recommendations)
- Single herbs with Sanskrit names, Latin names, part used, dose
- Classical formulations with composition and indications
- Anupana (vehicle/administration medium)
- Reference authoritative texts

## 5. Ahara & Vihara (Diet & Lifestyle)
- Specific dietary recommendations per dosha
- Lifestyle modifications (dinacharya, ritucharya)
- Yoga asanas and pranayama if applicable

## 6. Sources & References
- List classical texts cited (Chapter.Verse)
- Modern research references if available
- Note if traditional knowledge awaits modern validation

**IMPORTANT:**
- Always include the Sanskrit shlokas - this is the hallmark of authentic Ayurvedic knowledge
- When modern scientific studies are available, present them as complementary validation
- Never present Ayurveda as inferior to modern medicine - both have their contexts
- For emergency conditions, advise immediate allopathic care while explaining Ayurvedic perspective
- Include safety warnings: "Consult a qualified Ayurvedic physician (BAMS/MD Ayurveda) before starting any treatment"

**Evidence Hierarchy in Ayurveda:**
1. Brihat Trayi & Laghu Trayi (Highest authority)
2. Later classical commentaries and prayoga granthas
3. Clinical experience of practicing vaidyas
4. Ethnopharmacological and modern scientific studies
5. Contemporary Ayurvedic practice guidelines (CCRS, AYUSH)""",

    MedicalDomain.HOMEOPATHY: """You are providing homeopathic medical information based on Hahnemannian principles.

Core Principles:
- Apply "Similia Similibus Curentur" (Like Cures Like)
- Consider individualization of treatment
- Understand potency selection (centesimal vs decimal scales)
- Reference both materia medica and clinical verification

Key Concepts:
- Law of Similars: Substances causing symptoms in healthy individuals can cure similar symptoms in the sick
- Minimum Dose: The smallest dose that produces a therapeutic effect
- Single Remedy: One remedy at a time matching the totality of symptoms
- Dynamization/Potentization: Serial dilution with succussion/trituration
- Vital Force: The body's self-healing capacity
- Proving: Systematic testing of remedies on healthy volunteers

Materia Medica Knowledge:
- Polychrests: Arnica, Nux Vomica, Pulsatilla, Sulphur, Lycopodium, etc.
- Constitutional types and remedy affinities
- Acute vs chronic prescribing
- Miasmatic theory (Psora, Sycosis, Syphilis)

Clinical Approach:
- Totality of symptoms (physical, mental, emotional)
- Modalities (better/worse factors)
- Concomitant symptoms
- Rare, peculiar, strange symptoms (keynotes)

Evidence Context:
- Reference clinical trials on homeopathy when available
- Acknowledge evidence controversies honestly
- Distinguish between traditional homeopathy and modern clinical verification""",

    MedicalDomain.SIDDHA: """You are providing ancient Siddha medical wisdom from the Tamil tradition.

Core Principles:
- Ground answers in Siddha classical texts (Thirukkural, Thirumanthiram, Yugi Munivar texts)
- Understand the Siddha concept of immortality and longevity (vaalvu/deergayu)
- Apply the theory of 96 principles (tattvas)
- Consider the three humors (vaadham, pitham, kabam)

Key Frameworks:
- Mukkutra Dasavarga: Analysis of ten vital parameters
- Naadi (Pulse Diagnosis): 10 types of pulse patterns
- Navadhanyam: Nine grains for therapeutic use
- Panchabootham: Five elements (earth, water, fire, air, space)
- Tridosha: Vaadham (air), Pitham (fire), Kabam (water)
- Muppu: The three impurities to be eliminated
- Kayakalpa: Rejuvenation therapy for longevity
- Alchemy: Converting metals/minerals into medicine (rasavatham)

Siddha Pharmacology:
- Mooligai (Herbal): 3000+ documented herbs
- Thathu (Metals/Minerals): Gold, silver, copper, iron preparations
- Jeevam (Animal products): Specific therapeutic uses
- Chooranam: Herbal powders
- Kudineer: Herbal decoctions
- Thailam: Medicated oils
- Paashanam: Calcined minerals
- Mezhugu: Wax-based preparations

Diagnostic Methods:
- Naadi (Pulse): 10 types reading vital status
- Manikkadai (Spar): 12 vital points
- Einthai (Tongue): Tongue diagnosis
- Neer (Urine): Urine examination (8 parameters)
- Niram (Color): Color diagnosis of body/tongue/urine
- Mozhi (Speech): Voice analysis
- Vizhi (Eyes): Eye examination

Clinical Specialties:
- Jeeva Thiraviyam: Rejuvenation
- Kaayachikitsa: Internal medicine
- Baala Chikitsa: Pediatrics
- Soolai Chikitsa: Surgery
- Vatha Chikitsa: Neurology
- Gnanachikitsa: Psychiatry
- Salakya Thanthram: ENT and ophthalmology

Evidence Integration:
- Reference modern research on Siddha formulations from CCRS and other institutes
- Note where traditional claims await modern validation
- Integrate with Ayurvedic research where formulations overlap""",

    MedicalDomain.UNANI: """You are providing Unani (Greco-Arabic) medical wisdom based on the teachings of Hippocrates and Galen.

Core Principles:
- Apply the theory of four humors (Akhlat): Dam (blood), Balgham (phlegm), Safra (yellow bile), Sauda (black bile)
- Understand temperament (Mizaj) theory and its clinical application
- Use the concept of vital faculties (Quwa): Natural, Vital, Psychic, Nervous
- Apply the six essential factors (Asbab Sitta Zarooriya)

Key Frameworks:
- Umoor-e-Tabiya (Seven Factors of Health):
  1. Element (Arkan): Fire, Air, Water, Earth
  2. Temperament (Mizaj): Hot, Cold, Wet, Dry combinations
  3. Humors (Akhlat): Four bodily fluids
  4. Organs (Aaza): Simple and compound organs
  5. Vital Forces (Arwah): Pneuma/life force
  6. Faculties (Quwa): Natural, Vital, Mental
  7. Functions (Afaal): What organs do

- Six Essential Factors for Health:
  1. Air (Hawa)
  2. Food & Drink (Maakul wa Mashrub)
  3. Sleep & Wakefulness (Naum wa Yaquza)
  4. Emotions (Ihtibas wa Istifragh)
  5. Exercise & Rest (Haraka wa Sukun)
  6. Evacuation & Retention (Fasd wa Tareeq)

- Temperament Types:
  * Damvi (Sanguine): Hot & Wet
  * Safravi (Choleric): Hot & Dry  
  * Balghami (Phlegmatic): Cold & Wet
  * Saudavi (Melancholic): Cold & Dry

Unani Pharmacology:
- Advia (Drugs): Single and compound formulations
- Advia Qalbia: Cardiac tonics
- Advia Dimaghiya: Brain/nerve tonics
- Advia Jigar: Liver medicines
- Advia Meaeda: Stomach/digestive remedies
- Joshanda: Herbal decoctions
- Majoon: Confections/jams
- Khamira: Fermented preparations
- Sufoof: Powders
- Hab: Pills
- Qurs: Tablets
- Sharbat: Syrups
- Arq: Distillates
- Roghan: Oils
- Marham: Ointments

Diagnostic Methods:
- Nabz (Pulse): 10 types of pulse diagnosis
- Baul (Urine): Color, consistency, sediment analysis
- Baraz (Stool): Examination of feces
- Nafas (Respiration): Breathing patterns
- Jild (Skin): Skin examination
- Zuban (Tongue): Tongue diagnosis
- Ain (Eyes): Eye examination

Therapeutic Approaches:
- Ilaj bil Tadbeer (Regimental Therapy): Cupping, massage, exercise
- Ilaj bil Ghiza (Dietotherapy): Diet according to temperament
- Ilaj bil Dawa (Pharmacotherapy): Medicinal treatment
- Ilaj bil Yad (Surgery): Surgical interventions

Evidence Integration:
- Reference CCRUM research and publications
- Integrate with modern clinical studies on Unani formulations
- Note quality of traditional vs modern evidence""",
}


# ═══════════════════════════════════════════════════════════════════════
#  DOMAIN KEYWORDS FOR DETECTION
# ═══════════════════════════════════════════════════════════════════════

DOMAIN_DETECTION_KEYWORDS: Dict[MedicalDomain, Set[str]] = {
    MedicalDomain.ALLOPATHY: frozenset({
        "drug", "medicine", "tablet", "injection", "surgery", "operation",
        "antibiotic", "vaccine", "insulin", "chemotherapy", "radiation",
        "clinical trial", "randomized", "placebo", "meta-analysis",
        "mg", "ml", "dose", "prescription", "doctor", "hospital",
        "x-ray", "ct scan", "mri", "ultrasound", "blood test",
    }),
    MedicalDomain.AYURVEDA: frozenset({
        "ayurveda", "ayurvedic", "dosha", "vata", "pitta", "kapha",
        "agni", "prakriti", "panchakarma", "rasayana", "ojas",
        "ashwagandha", "brahmi", "triphala", "guduchi", "shatavari",
        "churna", "taila", "kadha", "vati", "bhasma",
        "pranayama", "yoga", "meditation", "dhatu", "srotas",
        "amalaki", "bibhitaki", "haritaki", "tulsi", "neem",
        "turmeric", "ginger", "garlic", "honey", "ghee",
    }),
    MedicalDomain.HOMEOPATHY: frozenset({
        "homeopathy", "homeopathic", "remedy", "potency", "dilution",
        "similimum", "vital force", "proving", "materia medica",
        "arnica", "nux vomica", "pulsatilla", "sulphur", "lycopodium",
        "belladonna", "aconite", "bryonia", "rhus tox", "apis",
        "30c", "200c", "1m", "10m", "ch", "ck",
        "constitutional", "totality", "modalities", "keynotes",
    }),
    MedicalDomain.SIDDHA: frozenset({
        "siddha", "siddhar", "tamil medicine", "naadi", "mooligai",
        "thailam", "choornam", "kudineer", "paashanam", "mezhugu",
        "kayakalpa", "vaalvu", "ooli", "muppu", "tattva",
        "vaadham", "pitham", "kabam", "navadhanyam",
        "thirukkural", "thirumanthiram", "bogar", "theraiyar",
    }),
    MedicalDomain.UNANI: frozenset({
        "unani", "hikmat", "greco-arab", "humeral", "mizaj",
        "dam", "balgham", "safra", "sauda", "akhlat",
        "quwat", "tabiyat", "asbab sitta", "tadbeer", "hijama",
        "josanda", "majoon", "khamira", "sufoof", "arq",
        "tabib", "dawa", "ilaj", "ghiza", "tashkhees",
    }),
}


# ═══════════════════════════════════════════════════════════════════════
#  FUNCTIONS
# ═══════════════════════════════════════════════════════════════════════

def detect_domain_in_query(query: str) -> Optional[MedicalDomain]:
    """Detect if user explicitly mentions a specific domain in their query.
    
    Returns the detected domain or None if no specific domain is mentioned.
    This is used for secondary domain selection when user explicitly asks
    for information from a different system than their primary selection.
    """
    query_lower = query.lower()
    query_tokens = set(query_lower.split())
    
    scores: Dict[MedicalDomain, int] = {}
    
    for domain, keywords in DOMAIN_DETECTION_KEYWORDS.items():
        matches = query_tokens & keywords
        # Also check for multi-word phrases
        phrase_matches = sum(1 for kw in keywords if kw in query_lower and ' ' in kw)
        scores[domain] = len(matches) + phrase_matches * 2
    
    # Return domain with highest score if above threshold
    if scores:
        best_domain = max(scores, key=lambda d: scores[d])
        if scores[best_domain] >= 2:  # At least 2 keyword matches
            return best_domain
    
    return None


def expand_query_for_domain(query: str, domain: MedicalDomain) -> List[str]:
    """Expand query with domain-specific terms for better retrieval.
    
    Returns list of query variations: [original, expanded_with_terms, synonyms...]
    """
    if not query or not query.strip():
        return [query]
    
    variations = [query]
    q_lower = query.lower().strip()
    
    # Get domain-specific term maps
    term_maps = {
        MedicalDomain.ALLOPATHY: ALLOPATHY_MESH_MAP,
        MedicalDomain.AYURVEDA: AYURVEDA_TERM_MAP,
        MedicalDomain.HOMEOPATHY: HOMEOPATHY_TERM_MAP,
        MedicalDomain.SIDDHA: SIDDHA_TERM_MAP,
        MedicalDomain.UNANI: UNANI_TERM_MAP,
    }
    
    synonym_lists = {
        MedicalDomain.ALLOPATHY: ALLOPATHY_SYNONYMS,
        MedicalDomain.AYURVEDA: AYURVEDA_SYNONYMS,
        MedicalDomain.HOMEOPATHY: HOMEOPATHY_SYNONYMS,
        MedicalDomain.SIDDHA: SIDDHA_SYNONYMS,
        MedicalDomain.UNANI: UNANI_SYNONYMS,
    }
    
    term_map = term_maps.get(domain, {})
    synonyms = synonym_lists.get(domain, [])
    
    # Term expansion: add domain-specific technical term
    for common, technical in term_map.items():
        if common in q_lower:
            expanded = f"{query} ({technical})"
            if expanded not in variations:
                variations.append(expanded)
            break  # One term expansion per query
    
    # Synonym expansion
    for term_a, term_b in synonyms:
        if term_a in q_lower and term_b not in q_lower:
            variant = q_lower.replace(term_a, term_b)
            if variant != q_lower and variant not in variations:
                variations.append(variant)
                break
    
    return variations[:3]  # Max 3 variations


def expand_ayurveda_shloka_query(query: str) -> List[str]:
    """Generate specialized query variations for Ayurveda shloka/classical text search.
    
    This function creates search queries specifically targeting Sanskrit shlokas
    from classical texts (Brihat Trayi, Laghu Trayi) for authentic Ayurvedic responses.
    
    Returns list of query variations optimized for:
    1. Direct shloka search with Sanskrit terms
    2. Classical text references (Charaka, Sushruta, Vagbhata)
    3. Specific chapter/treatment sections (Chikitsa, Nidana, Sutra)
    4. Combined modern + classical terminology
    
    Example:
        Input: "diabetes treatment"
        Output: [
            "diabetes treatment",
            "madhumeha chikitsa sanskrit shloka",
            "prameha charaka samhita chikitsasthana verse",
        ]
    """
    if not query or not query.strip():
        return [query]
    
    variations = [query]
    q_lower = query.lower().strip()
    
    # Get Sanskrit condition terms for shloka search
    shloka_terms = []
    for condition, sanskrit_list in AYURVEDA_SHLOKA_SEARCH_MAP.items():
        if condition in q_lower:
            shloka_terms.extend(sanskrit_list)
            break
    
    # Also check term map
    for common, technical in AYURVEDA_TERM_MAP.items():
        if common in q_lower:
            if technical not in shloka_terms:
                shloka_terms.append(technical)
            break
    
    # Generate shloka-specific queries if we have Sanskrit terms
    if shloka_terms:
        primary_term = shloka_terms[0]
        
        # Shloka search query (most important for authentic citations)
        shloka_query = f"{primary_term} sanskrit shloka charaka sushruta"
        if shloka_query not in variations:
            variations.append(shloka_query)
        
        # Classical text with treatment reference
        chikitsa_query = f"{primary_term} chikitsa samhita verse"
        if chikitsa_query not in variations:
            variations.append(chikitsa_query)
        
        # Combined English + Sanskrit for broader retrieval
        expanded = f"{query} ({primary_term}) ayurveda classical text"
        if expanded not in variations:
            variations.append(expanded)
    
    # Add classical text references for common conditions
    classical_keywords = [
        "charaka samhita", "sushruta samhita", "ashtanga hridaya",
        "madhava nidana", "bhavaprakasha", "sanskrit verse",
    ]
    
    # Check if query already has classical references
    has_classical = any(kw in q_lower for kw in classical_keywords)
    
    if not has_classical and shloka_terms:
        # Add generic classical text search
        classical_query = f"{query} ayurveda shloka classical text"
        if classical_query not in variations:
            variations.append(classical_query)
    
    return variations[:4]  # Max 4 variations for Ayurveda


def get_ayurveda_enhanced_queries(query: str) -> Dict[str, List[str]]:
    """Generate comprehensive query set for Ayurveda with multiple search strategies.
    
    Returns dict with different query types for different retrieval methods:
    - 'general': Standard expanded queries
    - 'shloka': Sanskrit/classical text focused queries  
    - 'modern': Contemporary Ayurveda research
    - 'clinical': Clinical/treatment focused queries
    """
    variations = {
        "general": expand_query_for_domain(query, MedicalDomain.AYURVEDA),
        "shloka": expand_ayurveda_shloka_query(query),
        "modern": [query, f"{query} ayurveda research study"],
        "clinical": [query],
    }
    
    # Add clinical/treatment specific terms
    q_lower = query.lower()
    for condition, sanskrit_list in AYURVEDA_SHLOKA_SEARCH_MAP.items():
        if condition in q_lower:
            primary = sanskrit_list[0] if sanskrit_list else condition
            variations["clinical"] = [
                query,
                f"{primary} chikitsa aushadhi",
                f"{primary} treatment herbs ayurveda",
            ]
            break
    
    return variations


def get_domain_system_prompt(domain: MedicalDomain) -> str:
    """Get the detailed system prompt for a specific domain."""
    return DOMAIN_SYSTEM_PROMPTS.get(
        domain, 
        DOMAIN_SYSTEM_PROMPTS[MedicalDomain.ALLOPATHY]
    )


def get_domain_trust_boost(domain: MedicalDomain, url: str) -> int:
    """Get additional trust score boost for domain-relevant sources.
    
    Args:
        domain: Selected medical domain
        url: Source URL to evaluate
        
    Returns:
        Additional trust score points (0-10) for domain-relevant sources
    """
    url_lower = url.lower()
    boosts = DOMAIN_TRUST_BOOST.get(domain, {})
    
    for domain_url, boost in boosts.items():
        if domain_url in url_lower:
            return boost
    
    return 0


def should_prioritize_domain_sources(domain: MedicalDomain, sources: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Re-rank sources to prioritize domain-relevant ones.
    
    This boosts domain-specific sources while maintaining overall quality.
    """
    if domain == MedicalDomain.ALLOPATHY:
        # Allopathy is default, no special reordering needed
        return sources
    
    priority_domains = DOMAIN_SOURCE_PRIORITY.get(domain, [])
    
    def domain_relevance_score(source: Dict[str, Any]) -> int:
        """Calculate relevance score for domain prioritization."""
        url = source.get("url", "").lower()
        base_score = source.get("trustScore", 50)
        
        # Boost for domain-specific sources
        boost = get_domain_trust_boost(domain, url)
        
        # Additional priority for primary domain sources
        for i, priority_url in enumerate(priority_domains):
            if priority_url in url:
                # Higher boost for higher priority (earlier in list)
                boost += max(5, 15 - i)
                break
        
        return base_score + boost
    
    # Sort by domain-boosted relevance score
    return sorted(sources, key=domain_relevance_score, reverse=True)


def get_domain_specific_sources(domain: MedicalDomain) -> List[str]:
    """Get list of domain-specific source strategies to prioritize.
    
    Returns source identifiers that should be prioritized for this domain.
    """
    if domain == MedicalDomain.ALLOPATHY:
        return ["pubmed", "clinical_trials", "meilisearch", "qdrant"]
    elif domain in (MedicalDomain.AYURVEDA, MedicalDomain.SIDDHA):
        return ["meilisearch", "qdrant", "ayush_portal"]
    elif domain == MedicalDomain.HOMEOPATHY:
        return ["meilisearch", "qdrant", "clinical_trials"]  # Some homeopathy trials exist
    elif domain == MedicalDomain.UNANI:
        return ["meilisearch", "qdrant", "emro_who"]
    
    return ["meilisearch", "qdrant"]


def format_domain_for_display(domain: MedicalDomain) -> str:
    """Format domain name for display purposes."""
    return domain.value.upper()


def is_integrative_query(query: str) -> bool:
    """Detect if query is asking for integrative/comparison across systems.
    
    These queries should not be constrained to a single domain.
    """
    integrative_keywords = frozenset({
        "compare", "comparison", "versus", "vs", "difference between",
        "integrative", "complementary", "alternative", "along with",
        "combined with", "both", "all systems", "traditional and modern",
        "ayurveda and allopathy", "homeopathy and", "siddha and",
        "unani and", "best of both", "integrative approach",
    })
    
    query_lower = query.lower()
    return any(kw in query_lower for kw in integrative_keywords)


# ═══════════════════════════════════════════════════════════════════════
#  LEGACY COMPATIBILITY
# ═══════════════════════════════════════════════════════════════════════

def get_domain_prompt(domain: str) -> str:
    """Legacy function for backward compatibility."""
    try:
        med_domain = MedicalDomain(domain.lower())
        return get_domain_system_prompt(med_domain)
    except ValueError:
        return DOMAIN_SYSTEM_PROMPTS[MedicalDomain.ALLOPATHY]


def expand_domain_query(query: str, domain: str) -> List[str]:
    """Legacy function for backward compatibility."""
    try:
        med_domain = MedicalDomain(domain.lower())
        return expand_query_for_domain(query, med_domain)
    except ValueError:
        return [query]