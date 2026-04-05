# Manthana Frontend — End-to-End Architecture & Subscription Strategy (INR)

This document is derived from a read-through of the **oracle-2 / frontend-manthana / manthana** Next.js app: routing, API clients, auth, and how each product surface talks to backends. It ends with a **recommended INR subscription ladder**, **feature mapping**, and a **profit-margin framework** (with explicit assumptions).

---

## 1. High-level architecture

| Layer | Role |
|--------|------|
| **Next.js 14 (App Router)** | UI, middleware, Better Auth API route (`/api/auth/*`), Razorpay routes (`/api/razorpay/*`). |
| **Next.js rewrites** | Everything under `/api/*` **except** `/api/auth/*` is proxied to **`NEXT_PUBLIC_API_URL`** (default `http://localhost:8000`). So browser calls like `/api/...` can hit a unified gateway when configured that way. |
| **Direct browser `fetch` to microservices** | Oracle, Web, Research, Analysis, Clinical clients build full URLs from **`src/lib/api/config.ts`** (`ORACLE_BASE`, `WEB_BASE`, etc.). CSP `connect-src` allows those origins. |
| **Manthana Analyse (Labs)** | Uses **`NEXT_PUBLIC_GATEWAY_URL`** and a **separate gateway JWT** in `localStorage` (`manthana_access_token` via `auth-token.ts`) for multipart image analysis — **not** the same token path as `fetchWithAuth` for Oracle/Web/Research. **Product direction:** Labs now also expects a **Better Auth session** (middleware + `authClient.useSession` on `/analyse`). |

**Two authentication paths (important for billing and abuse prevention):**

1. **Better Auth session → JWT** (`authClient.token()`), attached by `fetchWithAuth` in `src/lib/api/core/client.ts` as `Authorization: Bearer …` for **Oracle, Web, Research, Clinical** section APIs.
2. **Gateway token** for **Analyse** (`getGatewayAuthToken()` in `src/lib/analyse/api.ts`) — Bearer on `GATEWAY_URL` for `analyzeImage`, multi-model flows, copilot, consent, etc.

*Operational note:* For consistent “one subscription gates everything,” you will eventually want **one server-side entitlement check** (or gateway exchange) so both token paths respect the same `subscriptionPlan` / usage counters.

---

## 2. Product surfaces — behaviour & backend wiring

### 2.1 Oracle (`/` — `src/app/page.tsx`)

- **Purpose:** Primary conversational “oracle” — streaming answers with optional web/trials enrichment, domain pills (allopathy + AYUSH traditions), intensity/persona/evidence controls.
- **Modes (URL-driven):** `mode=auto | m5 | search | deep-research | analysis`, `domain=…` for tradition or `m5`.
- **Backends:**
  - **`streamChat`** → `POST {ORACLE_BASE}/chat` (SSE), body includes `message`, `history`, `domain`, `lang`, `intensity`, `persona`, `evidence`, `enable_web`, `enable_trials`.
  - **`streamM5`** → `POST {ORACLE_BASE}/chat/m5` for five-domain answers + summary.
  - **`searchMedical` / `fetchSearchWithSources`** → **`WEB_BASE`** when user runs “MANTHANA WEB” style search from the same page.
- **Persistence:** Chat sessions saved to **`localStorage`** key `manthana_sessions`.
- **Deep link:** Inline banners can send users to **`/clinical-tools`** with query params for drug/herb tools.

**Cost driver:** LLM tokens + optional web/trial retrieval per message; bursty under concurrent users.

---

### 2.2 Web / Universal search (`/search` — `src/app/search/page.tsx`)

- **Purpose:** Rich medical web search UI (tabs, images, videos, papers, guidelines, trials, PDFs, autocomplete, trending, knowledge summary).
- **Backend:** `src/lib/api/web/client.ts` → **`WEB_BASE`** endpoints, e.g.:
  - `/search`, `/search/autocomplete`, `/search/images`, `/search/videos`, `/search/papers`, `/search/guidelines`, `/search/trials`, `/search/pdfs`, `/trending`, `/history`, `/feedback`, `/knowledge/summary`
- **Auth:** Same `fetchWithAuth` (Better Auth JWT).

**Cost driver:** Search/index infrastructure + third-party data sources + summarisation LLM calls.

---

### 2.3 Med Deep Research (`/deep-research` — `src/app/deep-research/page.tsx`)

- **Purpose:** Structured, multi-step research across **five traditions** (Allopathy, Ayurveda, Homeopathy, Siddha, Unani), depth controls, templates, integrative mode when 2+ domains, plagiarism/originality panel.
- **Backends (`src/lib/api/research/`):**
  - **`deepResearchStream`** → `POST {RESEARCH_BASE}/deep-research/stream` (streaming).
  - **`deepResearch`** → non-stream path.
  - **`checkOriginality`** → `{RESEARCH_BASE}/plagiarism/check`.
  - **Threads:** `{RESEARCH_BASE}/research/threads` (list/create/delete).
  - **Domain sources config:** `{RESEARCH_BASE}/config/domain-sources`.
- **Client state:** `useDeepResearch` hook; local history key `manthana_deep_research_history`.

**Cost driver:** Highest variable cost per session — multiple retrieval passes + long-context synthesis; scales with “depth” and domain count.

---

### 2.4 Manthana Analyse / Labs (`/analyse/*` — `src/app/(analyse)/analyse/...`)

- **Purpose:** Radiologist-style workstation: modalities (X-ray, CT variants, MRI, USG, ECG, pathology, dermatology, multi-model, PACS placeholders, DICOM, heatmaps, reports, history).
- **Backend:** **`GATEWAY_URL`** (`NEXT_PUBLIC_GATEWAY_URL`), **not** the `*_BASE` split unless you point them to the same host.
- **Client:** `src/lib/analyse/api.ts` — `analyzeImage`, job polling, multi-model unify, `askCoPilot`, etc.; maps UI modality IDs to **backend modality strings** (e.g. `ct_abdomen` → `abdominal_ct`).
- **Auth / gates:** Better Auth session for app access; **ConsentGate** posts consent to gateway; previously separate **LoginGate** (gateway credentials); gateway JWT still used for API calls.
- **History:** `localStorage` / `manthana_history_v1` (see `lib/analyse/history.ts`).

**Cost driver:** GPU inference, storage egress, large uploads — **dominant COGS** for imaging-heavy users.

---

### 2.5 Clinical tools (`/clinical-tools` — `src/app/clinical-tools/page.tsx`)

- **Purpose:** Tabbed tools — **Drug interactions**, **Herb–drug**, **Clinical trials**, **ICD-10 suggest** (debounced). Query params prefill from Oracle banners.
- **Backends (`src/lib/api/clinical/client.ts`):**
  - **`CLINICAL_BASE`:** `/drug-interaction/check`, `/herb-drug/analyze`, `/clinical-trials/search`, `/icd10/suggest`, `/interaction/check/enriched`
  - **`ANALYSIS_BASE`:** `/snomed/lookup` (SNOMED lives under analysis gateway in this client split)

**Cost driver:** Mostly API/DB lookups; lower than Labs or Deep Research unless enriched interactions call LLMs.

---

### 2.6 Viewer (`/viewer` — `src/app/viewer/page.tsx`)

- **Purpose:** In-app viewing / iframe flows for external result pages (CSP allows `frame-src https:`).
- **Backend:** Depends on how you link in; often client-side navigation from search or reports.

---

### 2.7 Service health (sidebar — `src/components/ServiceHealth.tsx`)

- **Backend:** `getHealth()` → **`GET {API_ORIGIN}/health`** (unified origin), parses envelope; on failure falls back to **mock** health data.

---

## 3. Environment variables (operational map)

| Variable | Typical use |
|----------|-------------|
| `NEXT_PUBLIC_API_URL` | Unified API origin + Next rewrite target for `/api/*`. |
| `NEXT_PUBLIC_ORACLE_API_URL` | Oracle chat service (default port **8100** in examples). |
| `NEXT_PUBLIC_WEB_API_URL` | Web search service (**8200**). |
| `NEXT_PUBLIC_RESEARCH_API_URL` | Deep research + plagiarism (**8201**). |
| `NEXT_PUBLIC_ANALYSIS_API_URL` | Analysis/SNOMED etc. (**8202**). |
| `NEXT_PUBLIC_CLINICAL_API_URL` | Clinical tools (**8203**). |
| `NEXT_PUBLIC_GATEWAY_URL` | **Manthana Analyse** image AI gateway. |
| `NEXT_PUBLIC_API_VERSION` | Suffix such as `/v1` appended to each `*_BASE`. |

If unset, section clients **collapse to `NEXT_PUBLIC_API_URL`**, so a single monolithic gateway is still supported.

---

## 4. Middleware vs routes (sanity check)

`src/middleware.ts` treats **`/`, `/sign-in`, …** as public and redirects unauthenticated users on other paths. It defines `PREMIUM_ROUTES` including **`/oracle`**, but the Oracle UI actually lives at **`/`**. If you intend subscription gating per route, align path constants with real routes (`/`, `/search`, `/deep-research`, `/analyse`, `/clinical-tools`, `/viewer`).

---

## 5. Recommended subscription plan (INR) — aligned to this product

Design goals: **India-first pricing**, clear upgrade path, **protect margin on Labs and Deep Research**, keep **Oracle + light clinical** usable for acquisition.

### 5.1 Tiers (monthly, excl. GST)

| Tier | Price (₹/mo) | Who it’s for |
|------|----------------|--------------|
| **Free** | ₹0 | Trials, students, top-of-funnel. |
| **Clinician** | **₹799** | Working doctors: regular Oracle + Web + Clinical + light Labs. |
| **Radiology Labs** | **₹2,499** | Heavy **Manthana Analyse** / imaging workflows. |
| **Institutional / Pro** | **₹7,999+** (seat-based negotiation) | Teams, higher limits, SLA, custom onboarding. |

*Razorpay subscriptions bill in INR; you can add **annual** plans at ~**10 months price** (≈17% effective discount) to improve LTV.*

### 5.2 What each tier should include (mapped to real modules)

| Capability | Free | Clinician (799) | Radiology Labs (2499) | Institutional |
|------------|------|-----------------|-------------------------|---------------|
| **Oracle** (`/`) | 20 msgs / day | **Soft cap 150 msgs / day** (fair use) | Same as Clinician | Custom |
| **Web search** (`/search`) | 30 queries / day | **200 queries / day** | Same | Custom |
| **Deep Research** (`/deep-research`) | 1 shallow run / week | **4 standard runs / mo** | **15 runs / mo** + deeper depth | Negotiated |
| **Clinical tools** | 20 actions / day | **Included** | Included | Included |
| **Manthana Analyse** (`/analyse`) | **10 scans / mo** (matches current app stub) | **40 scans / mo** | **200 scans / mo** or fair-use GB | Custom + VPC option |
| **Multi-model + Copilot** in Labs | Not included | Limited (e.g. 5 unified / mo) | **Included** | Included |
| **History / export** | Local only | PDF export basic | Full report export | SSO + audit logs |
| **Support** | Email | Email + chat (business hours) | Priority | Dedicated |

*Numbers are **policy targets** for product and margin — enforce in **gateway + research service + rate limiter**, not only in UI.*

### 5.3 Relation to current Razorpay UI (`SubscriptionCard.tsx`)

The codebase currently exposes **Free / Basic ₹499 / Pro ₹1999** with scan-centric copy. The table above **better matches actual cost structure** (Labs + Deep Research vs text chat). Recommended migration:

- Rename **Basic → Clinician (799)** and **Pro → Radiology Labs (2499)** (or keep SKU IDs in Razorpay and only change marketing copy + entitlements).
- Keep **Free** as acquisition funnel with strict Deep Research + Labs caps.

---

## 6. Profit margin — detailed framework (not a promise)

Margins depend on **your real COGS** (GPU hours, LLM invoices, data licences, support headcount). Below is a **transparent model** you can paste into a spreadsheet.

### 6.1 Revenue after payment gateway

- **Razorpay:** commonly quoted **~2% + GST** on card/UPI/netbanking for domestic merchants (confirm on your tariff).
- Example: ₹799 sale → fee ≈ ₹16–25 including GST envelope → **net ~₹774–783** before COGS.

### 6.2 Variable cost buckets (order of magnitude)

| Bucket | Typical magnitude | Notes |
|--------|-------------------|--------|
| **Labs inference** | ₹15–80 per heavy study | Highly variable (GPU class, model count, DICOM series size). |
| **Oracle / Web** | ₹0.5–5 per active user / day | Mostly LLM + search infra; cache cuts this. |
| **Deep Research run** | ₹40–300 per run | Multi-domain + depth = multiple LLM + retrieval calls. |
| **Email (SES)** | &lt;₹1 per user / mo at your scale | Negligible vs AI. |
| **Auth / DB** | Fixed-dominated | SQLite self-host cheap; Postgres managed ~₹500–3000+ / mo. |

### 6.3 Illustrative contribution margin (single month, one user)

Assume **Clinician ₹799**, payment fee **3%** → **~₹775 net**.

| If user’s usage is… | Implied variable cost | Approx. contribution |
|---------------------|----------------------|------------------------|
| Light (chat + search only) | ₹50–150 | **₹625–725** |
| Medium + 4 Deep Research runs | ₹200–600 | **₹175–575** |
| Wrong tier: Labs power-user on Clinician | ₹800–2000+ | **Negative** → **needs upgrade or hard caps** |

**Radiology Labs ₹2499** net ~₹2420 after fees: if **COGS ₹800–1500** for heavy imaging + research, **gross margin ~38–67%** — realistic **if** caps and queueing prevent abuse.

### 6.4 Fixed costs (must be covered by contribution)

- Engineering + clinical oversight + compliance (DPDP, clinical disclaimers).
- Infra baseline (VPC, monitoring, backups).
- Customer support.

**Rule of thumb:** target **≥60% gross margin on paid tiers** after **average** (not best-case) usage — achieved by **strict metering** on Labs and Deep Research.

---

## 7. Implementation checklist (entitlements)

1. **Single source of truth** for `subscriptionPlan`, `scansThisMonth`, Deep Research credits — already partially in SQLite user row; extend schema for **oracle_daily**, **search_daily**, **research_credits**.
2. **Enforce on server:** Next.js API routes or each microservice validates JWT and returns **402/429** when over limit.
3. **Align gateway** token issuance with Better Auth user id so audit trails match.
4. **Fix middleware route names** if you add paywalls (`/` vs `/oracle`).

---

## 8. Summary

- The app is a **multi-surface clinical intelligence client**: **Oracle** and **Web** and **Research** and **Clinical** share **Better Auth + `fetchWithAuth`**; **Manthana Analyse** is a **separate GPU gateway** with its own JWT and the highest marginal cost.
- A **scan-only** ₹499/₹1999 ladder under-prices **Deep Research** and over-constrains messaging; the recommended **₹799 / ₹2,499** ladder aligns price with **where COGS actually accrue**.
- **Profit** is healthy only with **server-side metering** and **tier-appropriate caps** — the numbers in §6 are illustrations until you plug in your actual GPU/LLM bills.

---

*Document generated from codebase paths under `oracle-2/frontend-manthana/manthana` (Next.js app). Update when backends or routes change.*
