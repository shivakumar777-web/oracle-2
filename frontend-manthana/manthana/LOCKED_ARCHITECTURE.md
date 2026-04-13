# ⚠️ LOCKED ARCHITECTURE — DO NOT CHANGE WITHOUT READING THIS FULLY

**Status: PRODUCTION VERIFIED — WORKING AS OF 2026-04-13**

Do not modify `next.config.mjs` rewrites, environment variable names, or the oracle proxy route
without fully understanding the constraints documented here. Many hours of debugging went into
finding the exact configuration that makes both Oracle Chat AND Manthana Labs work simultaneously.

---

## Architecture Overview

```
Browser
  │
  ├── /api/oracle-backend/** ─→ Next.js App Route Handler
  │       src/app/api/oracle-backend/[[...path]]/route.ts
  │       ↓ reads ORACLE_INTERNAL_URL (SERVER-SIDE env var, set in Vercel Dashboard)
  │       ↓ forwards to → https://oracle-service-production-f21f.up.railway.app
  │       ↓ oracle-service FastAPI → POST /v1/chat, /v1/chat/m5, /health
  │
  └── /api/** (everything else) ─→ next.config.mjs rewrite
          ↓ reads NEXT_PUBLIC_API_URL (baked at build time)
          ↓ forwards to → https://manthana-api.quaasx108.com
          ↓ final-manthana-backend-railways FastAPI gateway
          Routes: /analyze, /pacs/studies, /health, /report, /copilot, /unified-report
```

---

## 🔒 RULE 1 — `next.config.mjs` Rewrite Order Is Critical

```js
// LOCKED ORDER — do NOT rearrange or merge these rules

{ source: "/api/auth/:path*", destination: "/api/auth/:path*" },      // 1. Auth: stays local

{ source: "/api/oracle-backend/:path*",                                // 2. Oracle: MUST come
  destination: "/api/oracle-backend/:path*" },                         //    BEFORE catch-all

...(backendUrl.startsWith("/")                                         // 3. All other /api/*
  ? []                                                                 //    → external backend
  : [{ source: "/api/:path*", destination: `${backendUrl}/:path*` }]),
```

**WHY:** Next.js rewrites are matched top-to-bottom. If the catch-all `/api/:path*` comes before the
`/api/oracle-backend/:path*` rule, ALL Oracle chat traffic gets forwarded to `manthana-api.quaasx108.com`
which has no `/v1/chat` route → **404 every time**. The oracle-backend rule must sit above the catch-all.

**WHY a self-rewrite (`destination` same as `source`) works:** In Next.js App Router, a rewrite that
points to the same path is a no-op for rewrites but causes the App Router to handle it via the
`[[...path]]` route file instead of applying the external catch-all. This is the only reliable way
to protect the oracle App Route from the catch-all.

---

## 🔒 RULE 2 — Environment Variables Are Split Across Two Places

### Vercel Dashboard (frontend build + runtime)

These control how the Next.js frontend routes traffic. They MUST be set in Vercel, not Railway.

| Variable | Value | Purpose |
|---|---|---|
| `NEXT_PUBLIC_GATEWAY_URL` | `/api` | Used by Manthana Labs API client (baked at build time) |
| `NEXT_PUBLIC_API_URL` | `https://manthana-api.quaasx108.com` | Drives next.config.mjs rewrites |
| `NEXT_PUBLIC_ORACLE_API_URL` | `/api/oracle-backend` | Oracle chat client base URL |
| `NEXT_PUBLIC_ANALYSIS_API_URL` | `/api` | Labs analysis routing |
| `NEXT_PUBLIC_WEB_API_URL` | `/api` | Web section routing |
| `NEXT_PUBLIC_RESEARCH_API_URL` | `/api` | Research section routing |
| `NEXT_PUBLIC_CLINICAL_API_URL` | `/api` | Clinical section routing |
| `ORACLE_INTERNAL_URL` | `https://oracle-service-production-f21f.up.railway.app` | Server-side: where Vercel proxy sends Oracle requests |

### Railway — `oracle-service` service variables

Only these belong here. Do NOT put NEXT_PUBLIC_* vars in oracle-service.

| Variable | Value |
|---|---|
| `MANTHANA_ROOT` | `/app` |
| `OPENROUTER_API_KEY` | `sk-or-v1-19ab80eb45bec19a389cfa...` |
| `ORACLE_USE_FREE_MODELS` | `true` |
| `CLOUD_INFERENCE_CONFIG_PATH` | `/app/config/cloud_inference.yaml` |

### Railway — `final-manthana-backend-railways` (the main gateway)

All Modal.run AI service URLs, JWT secrets, Supabase config, CORS, etc. live here. Do not move them.

---

## 🔒 RULE 3 — NEXT_PUBLIC_* Variables Are BAKED AT BUILD TIME

`NEXT_PUBLIC_*` variables are **not** read at runtime by the browser. Next.js inlines them into the
JavaScript bundle during `next build`. This means:

- Changing them in Vercel Dashboard requires a **full Redeploy** to take effect
- They are visible in the browser (do not put secrets in NEXT_PUBLIC_* vars)
- The `ORACLE_INTERNAL_URL` (no NEXT_PUBLIC_ prefix) IS read at runtime by the Vercel serverless
  function — it does not need a rebuild, but still needs a redeploy to restart the function

---

## 🔒 RULE 4 — Oracle Service Has Its Own Public Railway Domain

Oracle-service runs on Railway as a standalone FastAPI service. It does NOT share a domain with the
main backend gateway. It has its own public URL:

```
https://oracle-service-production-f21f.up.railway.app
```

The `ORACLE_INTERNAL_URL` in Vercel MUST point to this URL directly. Do NOT point it to
`manthana-api.quaasx108.com` — that gateway has no `/v1/chat` route.

---

## 🔒 RULE 5 — The Oracle Proxy Route Uses App Router, NOT next.config Rewrites

File: `src/app/api/oracle-backend/[[...path]]/route.ts`

This is a catch-all App Route that manually proxies requests to `ORACLE_INTERNAL_URL`. It was
built this way because Next.js rewrites to external URLs are unreliable for SSE/streaming (they
buffer the response or surface HTML error pages). The App Route handler correctly streams SSE.

**Do NOT convert this to a next.config.mjs rewrite.** It will break streaming Oracle chat.

---

## 🔒 RULE 6 — Railway Vercel Integration Does NOT Sync Env Vars Automatically

The Vercel integration inside Railway Settings triggers redeployments — it does NOT automatically
push Railway service-level environment variables into Vercel. You must update Vercel vars manually
via the Vercel Dashboard.

**Exception:** Railway PROJECT-LEVEL shared variables may sync. Service-specific vars do not.

---

## 🔒 RULE 7 — Vercel CLI Does Not Work On This Machine

The Windows username contains an emoji (`NIKKI😎`) which is an illegal HTTP header character.
The Vercel CLI sends the username in HTTP headers and crashes with:
```
Error: NIKKI😎 @ vercel ... is not a legal HTTP header value
```
All Vercel environment variable management must be done via the **Vercel Dashboard UI** in a browser.

---

## What Was Broken And How It Was Fixed (Root Cause History)

| Error | Root Cause | Fix |
|---|---|---|
| `503 on /api/oracle-backend/pacs/studies` | All traffic routed to oracle-service chatbot which has no PACS routes | Split `NEXT_PUBLIC_GATEWAY_URL` to `/api` and `NEXT_PUBLIC_ORACLE_API_URL` to `/api/oracle-backend` |
| `404 on /api/oracle-backend/analyze` | Same — oracle-service has no `/analyze` route | Same fix as above |
| `404 on /api/analyze` | `NEXT_PUBLIC_API_URL` was relative (`/api`), so next.config.mjs skipped the backend rewrite entirely | Set `NEXT_PUBLIC_API_URL=https://manthana-api.quaasx108.com` |
| `404 on /api/oracle-backend/v1/chat` with FastAPI `{"detail":"Not Found"}` | The `/api/:path*` catch-all rewrite intercepted oracle-backend traffic before the App Route handler could process it, forwarding to `manthana-api.quaasx108.com/oracle-backend/v1/chat` which doesn't exist | Added `/api/oracle-backend/:path*` self-rewrite rule ABOVE the catch-all in `next.config.mjs` |
| `localhost:8000/health ERR_CONNECTION_REFUSED` | `NEXT_PUBLIC_GATEWAY_URL` was missing in Vercel build, falling back to hardcoded `localhost:8000` | Set all `NEXT_PUBLIC_*` vars in Vercel Dashboard + Redeploy |
