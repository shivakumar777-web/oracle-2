# Manthana Medical AI Engine — Upgrade Plan

**Project Root:** `/opt/manthana`  
**Deployment:** Kamatera Linux VPS, Docker Compose  
**Date:** March 2025

---

## CRITICAL: Read Before Touching Anything

Before implementing ANYTHING, audit the following files in this exact order:

1. services/radiology/main.py       — read fully
2. services/eye/main.py             — read fully
3. services/cancer/main.py          — read fully
4. services/pathology/main.py       — read fully
5. services/brain/main.py           — read fully
6. services/nlp/main.py             — read fully
7. services/ayurveda/main.py        — read fully
8. services/drug/main.py             — read fully
9. services/indexer/main.py         — read fully
10. services/segmentation/main.py    — read fully
11. api.py                          — read fully
12. litellm_config.yaml             — read fully

Summarise in your plan what is already implemented vs what is partial vs what is missing.
Do NOT implement anything you find is already complete.

---

## Architecture Rules (non-negotiable)

- **ALL LLM inference** (chat, synthesis, clinical questions) → **Groq via LiteLLM**
  (OLLAMA_URL=http://litellm:4000, model=meditron or llama3.2 which are Groq aliases)
- **Ollama is ONLY for embeddings** → nomic-embed-text via EMBED_URL=http://ollama:11434
- **NO** local LLM models, **NO** GPU dependencies, **NO** auth/JWT/OAuth
- All services are FastAPI Python microservices — do not change the framework
- Do not touch the frontend (Next.js), do NOT touch kamatera-upgrade/ folder
- All new dependencies must be pip-installable with no CUDA/GPU requirement

---

## TASK 1 — Replace Heuristic Vision Services with Real ML Models

### (Check first — implement only what isn't already done)

### 1A. services/eye/main.py — Real Diabetic Retinopathy Model

**CURRENT STATE:** intensity-based heuristic (pixel mean → DR grade). Replace with:

**Install:** efficientnet_pytorch or torchvision + a fine-tuned DR model from HuggingFace

**Model to use:** search HuggingFace for "diabetic retinopathy efficientnet" or use:
- `spaces/DucHaiten/Diabetic-Retinopathy-Classifier` (EfficientNet-B4, open weights)
- OR download weights from: https://github.com/BespreekKlaus/DRdetection

**Implementation requirements:**
- Load model once at startup (singleton, not per-request)
- Preprocess: resize to 224x224, normalize with ImageNet mean/std
- Output: DR grade 0-4 with confidence score per class
- Response must keep identical JSON schema as current (grade, severity, confidence, recommendation)
- Add: `"model": "EfficientNet-B4-DR"` field to response
- Cap confidence at 0.82 max (model is not validated on Indian population — disclose this)
- Add disclaimer: "Screening aid only. Validated on EyePACS dataset. Independent clinical validation required for Indian population."
- Fallback: if model load fails at startup, fall back to heuristic with confidence capped at 0.50

---

### 1B. services/cancer/main.py — Real Skin Lesion Classifier

**CURRENT STATE:** color_std heuristic. Replace with:

**Model:** hafidikhsan/EfficientNet-b0-Skin-Disease-Multiclass at HuggingFace  
  OR: marmal88/skin_disease (fine-tuned EfficientNet on HAM10000 — MIT license)

**Library:** transformers pipeline("image-classification") — CPU-runnable, ~80MB

**Implementation requirements:**
- Load with: pipeline("image-classification", model="marmal88/skin_disease")
- Map model output labels → your existing: oral, skin, pathology endpoints
- Skin endpoint: use model output directly for skin, melanoma probability
- Oral endpoint: keep heuristic (no oral cancer open model exists) but cap confidence at 0.60 + disclosure
- Pathology endpoint: delegate to services/pathology (do not duplicate)
- Response schema: identical to current + add "model_type": "EfficientNet" or "model_type": "heuristic"
- Disclaimer: "Trained on HAM10000 dataset. Not validated for oral pathology. Consult specialist."

---

### 1C. services/pathology/main.py — Real Histopathology Tile Classifier

**CURRENT STATE:** intensity heuristic on cell_density. Replace with:

**Model:** 1aurent/uni OR any histocartography patch classifier on HuggingFace  
**Lighter alternative:** mahmoodlab/conch (requires HF token) — use only if HF_TOKEN env is set

- If **HF_TOKEN is set:** use CONCH
- If **HF_TOKEN is empty:** use transformers pipeline with google/vit-base-patch16-224 fine-tuned on PathMNIST (search HuggingFace: "pathology patch classification pathmnist")

**Implementation:**
- Input: image tile (single patch or full slide at low magnification)
- Output: tissue_type (tumor/benign_like/normal/inflammatory), abnormality score 0-1
- Keep existing response schema + add "model" field
- Disclose: "Patch-level classifier. Not a whole-slide analysis system."

---

## TASK 2 — Add Grad-CAM Heatmaps to Radiology Service

### (Check first — if any heatmap code exists already, extend it, don't replace)

In services/radiology/main.py:

**Install:** grad-cam (pip install grad-cam) — the jacobgil/pytorch-grad-cam library

**Add a new endpoint:** `POST /analyze/xray/heatmap`
- Same input as /analyze/xray (file upload)
- Runs the existing TorchXRayVision DenseNet model
- Also runs GradCAM on the top pathology (highest confidence finding)
- Returns all existing fields PLUS:
  - `"heatmap_base64"`: base64-encoded PNG of the Grad-CAM overlay on the original image
  - `"heatmap_pathology"`: which pathology the heatmap highlights
  - `"heatmap_confidence"`: confidence of that pathology

**Grad-CAM implementation:**
```python
from pytorch_grad_cam import GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image
import base64, io

def generate_gradcam(model, img_tensor, target_class_idx, original_img_array):
    target_layers = [model.features[-1]]  # last conv layer of DenseNet
    cam = GradCAM(model=model, target_layers=target_layers, use_cuda=False)
    targets = [ClassifierOutputTarget(target_class_idx)]
    grayscale_cam = cam(input_tensor=img_tensor, targets=targets)[0]
    # Normalise original image to 0-1 for overlay
    rgb_img = np.stack([original_img_array[0]] * 3, axis=-1)
    rgb_img = (rgb_img - rgb_img.min()) / (rgb_img.max() - rgb_img.min() + 1e-8)
    overlay = show_cam_on_image(rgb_img.astype(np.float32), grayscale_cam, use_rgb=True)
    buf = io.BytesIO()
    Image.fromarray(overlay).save(buf, format='PNG')
    return base64.b64encode(buf.getvalue()).decode()
```

Also modify `/analyze/xray` to include a `"supports_heatmap": true` field in response so the frontend knows to offer the heatmap button.

---

## TASK 3 — Backend Clinical Report Enrichment Endpoint

### (Check api.py and services/ai-router/main.py first — this may partially exist)

The frontend (designed in MANTHANA_CLINICAL_REPORT_ENGINE_IMPLEMENTATION.md) expects a backend endpoint that returns enriched clinical analysis including:

- ICD-10 codes per finding
- RadLex ontology terms per finding
- RADS scoring (BI-RADS, LI-RADS, Lung-RADS, PI-RADS, TI-RADS)
- ACR reference links per finding

**Add to api.py OR services/ai-router/main.py:**

**`POST /report/enrich`**

**Input:**
```json
{
  "modality": "chest_xray",
  "findings": [
    {"label": "Pleural Effusion", "confidence": 0.82, "severity": "moderate"},
    {"label": "Cardiomegaly", "confidence": 0.71, "severity": "moderate"}
  ]
}
```

**Output:**
```json
{
  "enriched_findings": [
    {
      "label": "Pleural Effusion",
      "confidence": 0.82,
      "severity": "moderate",
      "icd10_code": "J90",
      "icd10_description": "Pleural effusion",
      "radlex_id": "RID34539",
      "radlex_label": "Pleural effusion",
      "radlex_url": "https://radlex.org/RID/RID34539",
      "reference_url": "https://radiopaedia.org/articles/pleural-effusion-1",
      "differential": ["Cardiac failure", "Malignancy", "Parapneumonic"]
    }
  ],
  "rads_score": {
    "system": "Lung-RADS",
    "score": "3",
    "meaning": "Probably benign",
    "action": "6-month CT follow-up",
    "reference": "https://www.acr.org/Clinical-Resources/Reporting-and-Data-Systems/Lung-Rads"
  },
  "triage_level": "URGENT",
  "impression": "Bilateral pleural effusion with cardiomegaly. Consider cardiac failure.",
  "report_standard": "ACR 2024"
}
```

**Implementation:**
- Implement the ICD-10 + RadLex lookup as in-memory Python dictionaries (no external API)
- Use the exact mappings defined in MANTHANA_CLINICAL_REPORT_ENGINE_IMPLEMENTATION.md
- **RADS auto-detection logic:** chest_xray + CT = Lung-RADS, mammogram = BI-RADS, etc.
- Use **Groq** (via settings.OLLAMA_URL + Redis cache) to generate:
  - The clinical impression sentence
  - Differential diagnosis list (up to 3 per finding)
- **Cache:** Redis TTL 3600s, key = SHA256(modality + sorted finding labels)

---

## TASK 4 — Groq Retry + Redis LLM Response Caching in orchestrator.py

### (Check current orchestrator.py first — if retry exists, skip)

In the `synthesize()` function:

**a) Redis cache:**
- key = hashlib.sha256((query + context[:500]).encode()).hexdigest()
- TTL = 3600 seconds
- Check cache before Groq call, store result after successful call
- Pass redis_client as optional param: synthesize(query, context, redis_client=None)

**b) Retry with backoff:**
- Import: from groq import RateLimitError
- Retry up to 3 times on RateLimitError: sleep 2s, 4s, 8s
- After 3 failures: return "" (graceful — web results still shown)
- Log each retry attempt

---

## TASK 5 — SNOMED + OpenFDA Knowledge Enrichment

### (Check if any SNOMED or OpenFDA integration exists first)

**Add to services/drug/main.py:**

**New endpoint:** `POST /interaction/check/enriched`

- Takes drug_a + drug_b (SMILES or drug name)
- **Step 1:** existing interaction check (keep it)
- **Step 2:** Query OpenFDA drug interaction API:  
  `https://api.fda.gov/drug/event.json?search=patient.drug.drugcharacterization:1+AND+patient.drug.medicinalproduct:{drug_name}&limit=3`
- **Step 3:** Return merged result with FDA adverse event evidence + your existing RDKit analysis
- **Cache:** Redis TTL 86400s (24h — FDA data is stable)

**Add to services/nlp/main.py:**

**New endpoint:** `GET /snomed/lookup?term={term}`

- Query: https://browser.ihtsdotools.org/snowstorm/snomed-ct/browser/MAIN/concepts?term={term}&limit=5
- Return top 5 SNOMED concept IDs + preferred terms
- Cache with Redis TTL 86400s
- No API key required (SNOMED Browser API is public)

---

## TASK 6 — Disclaimer + Confidence Hardening

### (Apply to ALL heuristic services)

**For services/eye, services/cancer, services/pathology, services/segmentation:**

If `model_type == "heuristic"` in the response:
- Cap confidence at **0.65** (never claim higher)
- Add to every response:
  - `"disclaimer"`: "This analysis uses statistical image features, not a validated clinical AI model. Results must be interpreted by a qualified medical professional."
  - `"model_type"`: "heuristic"
  - `"validated"`: false

**For services using real ML models (radiology, indexer):**
- Add: `"model_type"`: "ml_validated"
- Add: `"validated"`: true
- Add: `"validation_dataset"`: "CheXpert + MIMIC-CXR (377,110 studies)" for radiology

---

## TASK 7 — PDF Report Generation Endpoint

### (Check api.py — if /report/pdf exists, extend it, don't replace)

**Add to api.py:**

**`POST /report/pdf`**

- **Input:** Full ClinicalAnalysisResponse JSON (same schema as /report/enrich output)
- **Output:** PDF file download (Content-Type: application/pdf)

**Library:** weasyprint (pip install weasyprint) OR reportlab (pip install reportlab)  
Prefer weasyprint — takes HTML template, renders to PDF.

**Implementation:**
- Define HTML template string with Manthana branding
- Sections: Study Info, Triage Banner, Findings (with ICD-10 + RadLex), Impression, Recommendations, Models Used, Disclaimer
- Use Times New Roman / serif font for clinical feel
- Filename: `Manthana_Report_{modality}{date}{report_id}.pdf`
- Return as StreamingResponse with application/pdf content type

---

## Implementation Order

1. Read ALL 12 service files first (do not skip this step)
2. Write audit summary: what's already built / partial / missing per task
3. Implement **Task 4** (Groq retry + Redis) — lowest risk, highest reliability impact
4. Implement **Task 6** (disclaimer hardening) — 30 min change, immediate safety improvement
5. Implement **Task 3** (/report/enrich) — unlocks clinical report engine frontend
6. Implement **Task 5** (OpenFDA + SNOMED) — enriches drug + NLP services
7. Implement **Task 1A** (Eye DR model) — replace most dangerous heuristic first
8. Implement **Task 1B** (Cancer skin model)
9. Implement **Task 1C** (Pathology model)
10. Implement **Task 2** (Grad-CAM heatmaps) — radiology upgrade, highest visual impact
11. Implement **Task 7** (PDF reports) — final layer

---

## What NOT to Do

- Do NOT add authentication or JWT anywhere
- Do NOT add Ollama LLM models (not meditron, not llama3) — Groq only
- Do NOT touch the frontend Next.js code
- Do NOT touch kamatera-upgrade/ folder (those are reference files)
- Do NOT change any existing endpoint URL or response schema shape
- Do NOT add CUDA/GPU dependencies
- Do NOT use paid APIs (all APIs used must be free)
- Do NOT implement anything you find is already working

---

## Verification After Each Task

After each task implementation:

1. Run: `docker compose build {service_name} 2>&1 | tail -20`
2. Run: `docker compose up -d {service_name}`
3. Run: `curl -s http://localhost:{port}/health | python3 -m json.tool`
4. For radiology after Task 2: `curl -X POST http://localhost:8101/analyze/xray/heatmap -F "file=@test.jpg" | python3 -m json.tool`
5. Report: what was found already built, what was added, what tests passed

---

## Audit Summary (as of initial read)

| Task | Status | Notes |
|------|--------|-------|
| **1A (Eye DR)** | MISSING | Heuristic only; no EfficientNet-B4-DR |
| **1B (Cancer skin)** | MISSING | Heuristic only; no marmal88/skin_disease |
| **1C (Pathology)** | MISSING | Heuristic only; no histopathology model |
| **2 (Grad-CAM)** | MISSING | No heatmap endpoint; no pytorch-grad-cam |
| **3 (Report enrich)** | MISSING | No /report/enrich; ICD10_DB exists for /icd10/suggest only |
| **4 (Groq retry + Redis)** | COMPLETE | orchestrator.py has Redis cache + RateLimitError retry (2s, 4s, 8s) |
| **5 (OpenFDA + SNOMED)** | MISSING | No /interaction/check/enriched; no /snomed/lookup |
| **6 (Disclaimer hardening)** | PARTIAL | Heuristic services have model_type + disclaimer; confidence cap 0.75 (plan says 0.65); radiology/indexer lack ml_validated |
| **7 (PDF report)** | MISSING | No /report/pdf in api.py |
