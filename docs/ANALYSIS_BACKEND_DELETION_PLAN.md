# Plan: Remove Manthana Analysis Backend (Backend Only)

**Goal:** Remove backend components dedicated to the **Analysis** vertical (image/radiology gateway) **without** breaking Oracle, Web search, Deep Research, Clinical Tools (non-imaging), or other services.

**Constraint:** **Do not modify frontend source code.** Any required change is **deployment / environment only** (see §6).

**Critical distinction — three different “analysis” concepts in this repo:**

| Layer | What it is | Safe to delete in “Tier A”? |
|-------|------------|-----------------------------|
| **A. `services/analysis-service/`** | Standalone FastAPI on **8003** (host **8202**). Proxies uploads to radiology/ecg/eye/… + `/report/enrich`, `/snomed/lookup`. | **Yes** — nothing else **depends on this container** in `docker-compose.yml` except `analysis-db`. |
| **B. `services/radiology/` + other clinical microservices** | Real inference (e.g. chest X-ray on **8101**). Used by **ai-router** `/v1/analyze/*`, not only by analysis-service. | **No** (Tier A). Removing breaks **all** imaging analysis via the **unified** API. See §4 “Do not delete”. |
| **C. `services/ai-router` routes** `/v1/analyze/auto`, `/v1/analyze/xray`, `/v1/analyze/xray/heatmap` | Main path when frontend uses **`NEXT_PUBLIC_API_URL`** (same host as chat/search). | **No** (Tier A). Stripping these **breaks** the Analysis UI when it calls the unified gateway. See §5 optional “Tier B”. |

---

## 1. What Tier A removes (recommended “delete analysis backend” = duplicate gateway)

### 1.1 Code

- Entire directory **`services/analysis-service/`**  
  - `main.py`, `config.py`, `routers/analyze.py`, `routers/report.py`, `routers/health.py`, `Dockerfile`, `requirements.txt`

### 1.2 Docker Compose (`docker-compose.yml`)

- **Service** `analysis-service` (container `manthana-analysis`), including:
  - Port map `127.0.0.1:8202:8003`
  - `depends_on` chain that exists **only** for this service
- **Service** `analysis-db` (container `analysis-db`) — **only** referenced by `analysis-service` (`DATABASE_URL` + `depends_on`). The Python app does not implement persistent DB usage in a way other services rely on; the volume is for future/optional use.
- **Volume** `analysis-db-data` (top-level `volumes:` and the `analysis-db` service `volumes:` section)

### 1.3 Environment / secrets (optional cleanup)

- Remove **`ANALYSIS_DB_PASSWORD`** / **`DATABASE_URL`** for analysis from `.env` examples **only if** no other doc references them for a different purpose (grep first).
- **`frontend-manthana/manthana/.env.example`** mentions Analysis port — user asked **not** to touch frontend; skip or update only **non-frontend** deployment docs.

### 1.4 Documentation (optional)

- Update **`BACKEND_COUPLING_CAUTIONS.md`**, **`ORACLE_ISOLATION_VERIFICATION.md`**, **`SECTION_SEPARATION_FIX_PLAN.md`** references to `analysis-service` to state it was removed — **optional**, no runtime impact.

---

## 2. Verification before deletion (must run)

```bash
# Confirm nothing depends on analysis-service container name or hostname
grep -R "manthana-analysis\|analysis-service\|8202" --include="*.yml" --include="*.yaml" --include="*.py" .

# Confirm analysis-db is only for analysis-service
grep -R "analysis-db\|analysis_service" docker-compose.yml .env.example 2>/dev/null
```

**Expected:** No `depends_on: analysis-service` from `ai-router`, `manthana-api`, `oracle-service`, `web-service`, or `research-service`.

---

## 3. Execution order (safe)

1. **Backup** (if `analysis-db` ever stored anything you care about — likely empty/minimal):  
   `docker exec analysis-db pg_dump -U analysis analysis_service > analysis_backup.sql` (optional).
2. **Stop and remove** containers: `docker compose stop analysis-service` then remove service + db + volume in compose file, then `docker compose up -d` (or `docker compose rm` after stop).
3. **Delete** `services/analysis-service/` from the repo.
4. **Run tests** that do **not** target analysis-service (ai-router tests for `/v1/analyze/auto` **should still pass** — they mock **radiology:8101**, not analysis-service).

---

## 4. Do **not** delete (unless you intentionally kill all imaging analysis)

These are **not** the standalone “analysis-service” and are shared with other flows:

| Asset | Why keep |
|-------|----------|
| **`services/radiology/`** | Implements `/analyze/xray`, `/analyze/dicom`, heatmap. **ai-router** calls it directly. |
| **`services/ecg/`, `eye/`, `brain/`, `cancer/`, `pathology/`, …** | Same: downstream targets for **`/v1/analyze/auto`** in **ai-router**. |
| **`services/ai-router/main.py`** — `analyze_auto`, `_forward_to_clinical_service`, `_normalize_analyze_response`, xray/heatmap proxies | **Primary** implementation of analysis when using unified API. |
| **`services/shared/config.py`** — `RADIOLOGY_URL` etc. | Used by ai-router and possibly others. |
| **`services/shared/models.py`** — `FileAnalysisRequest` (and related) | Used by ai-router file-analysis flow. |
| **`services/shared/audit.py`** | Generic; may log `/analyze/xray` — keep. |
| **`services/ai-router/.../herb_drug` — `POST /v1/herb-drug/analyze`** | **Different feature** (Ayurveda herb–drug). **Not** radiology imaging. |
| **`services/drug/.../analyze/smiles`** | **Different feature** (chemistry). |
| **`orchestrator.py`** / **Elasticsearch** `"analyzer": "standard"` | **Not** the Analysis product; text search analyzer. |

### 4.1 Shared “analysis” names — do not confuse

- **`services/shared/circuit_breaker.py`** — `analysis_clinical_circuit`: may be unused or used by router; **do not delete** without grep proving zero imports.
- **`services/shared/redis_keys.py`** — `analysis_keys`: same.
- **`services/shared/envelopes.py`** — `AnalysisResponse`, `create_analysis_response`: used for typing/docs; **analysis-service** may not import them — **leave** unless full cleanup pass with tests.

---

## 5. Optional Tier B (nuclear) — **not recommended** with “frontend unchanged”

If the goal is **zero** image analysis anywhere:

1. Remove **`services/radiology/`** and radiology service from compose.
2. Remove **`/v1/analyze/*`** (and helpers) from **`services/ai-router/main.py`**.
3. Remove or repoint **tests** in `tests/test_router.py`, `tests/test_e2e_and_errors.py`, `tests/test_radiology.py`, `tests/test_router_helpers.py`.

**Impact:** Frontend **will** receive **404/501** on `POST /v1/analyze/auto` and related calls unless you also change the frontend (forbidden by constraint) or put a stub API in front. **Do not do Tier B** if the product must still show Analysis UI working against the **unified** API.

---

## 6. Frontend unchanged — **runtime** implication (not code)

If production uses **`NEXT_PUBLIC_ANALYSIS_API_URL=http://<host>:8202`** (dedicated analysis-service):

- After Tier A, **8202** is gone → **all requests to that base fail**.
- **Mitigation without frontend code changes:** Set **`NEXT_PUBLIC_ANALYSIS_API_URL`** to the **same origin as** **`NEXT_PUBLIC_API_URL`** (the ai-router / unified gateway), so `/v1/analyze/auto` hits **ai-router** instead of the removed service.

If the frontend already uses **only** the unified API for analysis (no separate analysis URL), **no env change** is required.

---

## 7. Tests and CI after Tier A

- **Keep** tests that exercise **ai-router** → **radiology** mocks.
- **Remove or skip** any test that only targets **`http://localhost:8202`** or **`analysis-service`** image (if such tests exist — current suite appears router-centric).

---

## 8. Doubt / “do not delete” summary

| Item | Action |
|------|--------|
| **`services/analysis-service/`** + **compose** + **`analysis-db`** | **Safe to remove** in Tier A after verification grep. |
| **`services/radiology/`** + **clinical microservices** | **Do not delete** for Tier A. |
| **`ai-router` `/v1/analyze/*`** | **Do not delete** for Tier A if Analysis must keep working via unified API. |
| **Shared modules** (`shared/*`) | **Do not delete** without audit — used broadly. |
| **`herb-drug/analyze`**, **drug `analyze/smiles`** | **Do not delete** — unrelated features. |
| **Tier B** full removal | **High risk** to Analysis UX; treat as separate product decision. |

---

## 9. Checklist (Tier A)

- [ ] Grep confirms no orchestration depends on `manthana-analysis` / `8202`.
- [ ] Stop/remove `analysis-service` and `analysis-db` + volume from compose.
- [ ] Delete `services/analysis-service/` tree.
- [ ] Adjust **deployment env** if clients pointed `NEXT_PUBLIC_ANALYSIS_API_URL` at **8202** (see §6).
- [ ] `docker compose config` validates.
- [ ] Run `pytest` for router + radiology (downstream still present).
- [ ] Smoke: unified `POST /v1/analyze/auto` still works (ai-router → radiology).

---

**Document owner:** Engineering  
**Last updated:** 2026-03-20
