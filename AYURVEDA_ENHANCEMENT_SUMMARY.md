# Ayurveda Enhancement Summary: Sanskrit Shloka Integration

**Date:** March 19, 2026  
**Status:** IMPLEMENTED  
**Scope:** Enhanced Ayurveda domain responses with authentic Sanskrit shlokas from classical texts

---

## What Was Enhanced

### 1. Sanskrit Shloka Citation Requirement (System Prompt)

**File:** `services/ai-router/domain_intelligence.py`

The Ayurveda system prompt now **mandates** Sanskrit shloka citations for every response:

- **MUST cite at least ONE authentic Sanskrit shloka** from classical texts
- **MUST identify the source text** (Charaka Samhita, Sushruta Samhita, Ashtanga Hridaya, Madhava Nidana, etc.)
- **MUST provide Sanskrit text** in Devanagari or IAST transliteration
- **MUST give faithful translation/explanation** of the shloka's meaning
- **MUST explain clinical application** to the present condition

**Example Format AI Must Follow:**
```
> **Sanskrit:** योजयेत्कफसम्मूढं मारुतं तीव्रवेदनम् ॥ च.सू.१५/१० ॥
> **Source:** Charaka Samhita, Sutrasthana 15.10
> **Translation:** When Vata is obstructed by Kapha causing severe pain...
> **Clinical Application:** This describes the pathogenesis of Sandhivata...
```

### 2. Classical Text Hierarchy Defined

**Brihat Trayi (The Great Three):**
1. **Charaka Samhita** - Internal medicine, general principles
2. **Sushruta Samhita** - Surgery, anatomy
3. **Ashtanga Hridaya** (Vagbhata) - Concise compilation

**Laghu Trayi (The Lesser Three):**
4. **Madhava Nidana** - Diagnostic excellence
5. **Bhavaprakasha** - Comprehensive materia medica
6. **Sharangdhara Samhita** - Pharmaceutics, formulations

**Other Important Texts:**
- Kashyapa Samhita (Pediatrics, gynecology)
- Bhela Samhita
- Agnivesha Tantra
- Chakradatta
- Vaidya Jeevana

### 3. Enhanced Query Expansion for Shloka Search

**File:** `services/ai-router/domain_intelligence.py`

New data structures added:

```python
AYURVEDA_CLASSICAL_TEXTS = [
    "charaka samhita", "sushruta samhita", "ashtanga hridaya",
    "madhava nidana", "bhavaprakasha", "sharangdhara samhita",
    # ... 11 more classical texts
]

AYURVEDA_SHLOKA_SEARCH_MAP = {
    "fever": ["jwara chikitsa", "jwara nidana", "santata jwara"],
    "diabetes": ["madhumeha chikitsa", "prameha", "meha roga"],
    "joint pain": ["sandhivata chikitsa", "vata vyadhi", "sandhi shoola"],
    # ... 30+ conditions with Sanskrit search terms
}
```

### 4. Intelligent Search Query Generation

**Functions Added:**

```python
def expand_ayurveda_shloka_query(query: str) -> List[str]:
    """Generate shloka-specific search queries for classical texts."""
    
def get_ayurveda_enhanced_queries(query: str) -> Dict[str, List[str]]:
    """Generate comprehensive query set with multiple strategies:
    - 'general': Standard expanded queries
    - 'shloka': Sanskrit/classical text focused queries
    - 'modern': Contemporary Ayurveda research  
    - 'clinical': Clinical/treatment focused queries
    """
```

### 5. Chat Router Integration

**File:** `services/oracle-service/routers/chat.py`

When `domain == "ayurveda"`:

1. **Uses shloka-focused query for RAG** (MeiliSearch, Qdrant)
   - Searches vector DB for classical text content
   - Query: `"madhumeha chikitsa sanskrit shloka charaka sushruta"`

2. **Uses shloka-focused query for SearXNG**
   - Web search targets classical Ayurveda repositories
   - Searches authentic digital libraries

3. **Enhanced source priority for Ayurveda:**
   - Classical text sources (charakasamhita.nic.in, etc.)
   - Government AYUSH sources (ayush.gov.in, ccras.nic.in)
   - Academic institutions (aiia.edu.in, niimh.nic.in)
   - Modern research (lower priority for traditional queries)

### 6. Ayurveda Response Structure Mandated

AI **MUST** follow this 6-section format:

```
## 1. Ayurvedic Pathogenesis (Samprapti)
- Doshic imbalance explanation with shlokas

## 2. Classical Sanskrit Shloka(s) with Interpretation
- Present Sanskrit verse with source
- Word-by-word meaning
- Clinical interpretation

## 3. Chikitsa Sutra (Treatment Principles)
- Shodhana (purification) if needed
- Shamana (palliative)
- Pathya (do's) and Apathya (don'ts)

## 4. Aushadhi (Medicinal Recommendations)
- Single herbs with Sanskrit/Latin names
- Classical formulations (Yogas)
- Anupana (vehicle/administration)

## 5. Ahara & Vihara (Diet & Lifestyle)
- Specific dietary recommendations
- Dinacharya, ritucharya
- Yoga/pranayama if applicable

## 6. Sources & References
- Classical texts cited (Chapter.Verse)
- Modern research if available
```

---

## How It Works (End-to-End)

### User Query: "piles treatment in Ayurveda"

1. **Domain Detection:** `domain="ayurveda"` selected
2. **Query Expansion:**
   - General: `["piles treatment", "piles treatment (arshas)"]`
   - Shloka: `["piles treatment", "arshas chikitsa sanskrit shloka charaka sushruta"]`
   - Clinical: `["piles treatment", "arshas chikitsa aushadhi"]`
3. **RAG Search:** Uses `"arshas chikitsa sanskrit shloka"` → finds vector embeddings of Charaka Samhita Chikitsasthana chapters
4. **SearXNG Search:** Uses shloka query → finds authentic sources like ayush.gov.in, niimh.nic.in
5. **System Prompt:** AI receives enhanced prompt with MANDATORY shloka requirements
6. **AI Response:** Structured 6-section output with authentic Sanskrit verses

### Expected Output Example:

```markdown
## 1. Ayurvedic Pathogenesis (Samprapti)
Arshas (piles) result from Manda Agni (diminished digestive fire) leading to 
accumulation of vitiated Vata and Kapha in the anal region.

## 2. Classical Sanskrit Shloka
> **Sanskrit:** अर्शांसि पित्तात् रक्ताद् वाताद् कफात् तथैव च ॥ च.चि.१४/३ ॥
> **Source:** Charaka Samhita, Chikitsasthana 14.3
> **Translation:** Arshas (hemorrhoids) originate from vitiated Pitta, Rakta 
> (blood), Vata, and Kapha respectively...
> **Clinical Application:** This verse explains the four types of arshas based 
> on dosha dominance, guiding treatment selection.

## 3. Chikitsa Sutra
**Shodhana:** Arshoghna Vasti (medicated enema with Arshoghna drugs)
**Shamana:** 
- Haritaki (Terminalia chebula) - 3-6g at night
- Aragvadha (Cassia fistula) - decoction
**Pathya:** Warm water, Takra (buttermilk), old rice
**Apathya:** Heavy meals, excess spices, daytime sleep

## 4. Aushadhi
**Single Herbs:**
- Haritaki (Terminalia chebula) - Rechana (purgative), Vata-anulomana
- Aragvadha (Cassia fistula) - Arshoghna (anti-hemorrhoidal)

**Classical Formulations:**
- Arshoghni Vati (2 tablets BD with buttermilk)
- Triphala Churna (3g at bedtime with warm water)
- Kankayan Vati (for bleeding piles)

## 5. Ahara & Vihara
- **Diet:** Takra (buttermilk), Yava (barley), Mudga (green gram)
- **Avoid:** Guru (heavy), Snigdha (oily), Ushna (hot spicy) foods
- **Lifestyle:** Regular bowel habits, avoid straining, Sitz bath

## 6. Sources
- Charaka Samhita, Chikitsasthana 14 (Arshas Chikitsa)
- Sushruta Samhita, Nidanasthana 2
- Bhavaprakasha, Madhyakhanda
- CCRAS Clinical Practice Guidelines
```

---

## Files Modified

| File | Changes |
|------|---------|
| `services/ai-router/domain_intelligence.py` | Added AYURVEDA_SHLOKA_SEARCH_MAP, AYURVEDA_CLASSICAL_TEXTS, enhanced system prompt with shloka mandate, expand_ayurveda_shloka_query(), get_ayurveda_enhanced_queries(), updated DOMAIN_SOURCE_PRIORITY |
| `services/oracle-service/routers/chat.py` | Added get_ayurveda_enhanced_queries import, enhanced query expansion for Ayurveda domain, shloka-focused RAG and SearXNG queries |

---

## Verification Test

```bash
# Test Ayurveda endpoint
curl -s -X POST http://localhost:8100/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"message":"piles treatment","domain":"ayurveda","intensity":"clinical"}'

# Expected: Response contains Sanskrit shloka, classical text citations, 6-section structure
```

---

## Benefits

1. **Authenticity:** Responses grounded in Brihat Trayi and Laghu Trayi texts
2. **Precision:** Sanskrit terminology (Jwara, Kasa, Madhumeha) ensures exact meaning
3. **Trust:** Classical shloka citations establish credibility
4. **Structure:** Consistent 6-section format for all Ayurveda responses
5. **Enriched Content:** AI can retrieve and cite specific verses from Samhitas
6. **Domain-Specific:** No allopathy-only sources (PubMed/ClinicalTrials filtered out)

---

## Notes

- AI is instructed to present shlokas in IAST transliteration/Devanagari when possible
- Modern research is cited as complementary, not primary
- Safety warnings always included: "Consult qualified Ayurvedic physician (BAMS/MD Ayurveda)"
- For emergencies, AI advises immediate allopathic care while explaining Ayurvedic perspective
