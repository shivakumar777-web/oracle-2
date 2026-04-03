# Better Auth Implementation Plan for Manthana

**Goal:** Integrate Better Auth into the Manthana medical AI platform with **zero ongoing cost** (except existing VPS storage/RAM). No per-user fees, no managed services.

**Reference:** Better Auth repo cloned at `better-auth-reference/` (can be removed after implementation).

---

## Phase 1 — DONE

- [x] `better-auth`, `better-sqlite3`, `@types/better-sqlite3` installed
- [x] `src/lib/auth.ts` — server config with JWT plugin
- [x] `src/app/api/auth/[...all]/route.ts` — catch-all handler
- [x] `src/lib/auth-client.ts` — React client
- [x] `next.config.mjs` — rewrites exclude `/api/auth/*`
- [x] `.env.example` — env var template
- [x] `auth.db` — SQLite DB created via `npx auth@latest migrate --yes`
- [x] `auth.db` added to `.gitignore`

**Quick start:** Create `.env.local` with `BETTER_AUTH_SECRET` (e.g. `openssl rand -base64 32`) and `BETTER_AUTH_URL=http://localhost:3001`, then run `npm run dev`.

---

## Phase 2 — DONE

- [x] `src/app/(auth)/sign-in/page.tsx` — Sign-in form
- [x] `src/app/(auth)/sign-up/page.tsx` — Sign-up form
- [x] `src/app/(auth)/layout.tsx` — Auth layout (centered card)
- [x] Sidebar auth UI — Sign in link when logged out; user + Sign out when logged in
- [x] Settings overlay — Account section with Sign in / Sign out

---

## Phase 3 — DONE

- [x] `services/ai-router/auth.py` — `get_current_user`, `get_current_user_optional`
- [x] `PyJWT[crypto]` in ai-router requirements
- [x] `BETTER_AUTH_URL` in config and docker-compose
- [x] `GET /me` — returns current user from JWT (optional auth)

---

## Phase 4 — DONE

- [x] `api.ts` — `fetchWithAuth()` attaches Bearer token to all API requests
- [x] `getAuthHeaders()` — fetches token from `authClient.token()` when signed in

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│  Next.js Frontend (port 3001)                                            │
│  ┌─────────────────────┐  ┌─────────────────────────────────────────┐ │
│  │ /api/auth/*         │  │ /api/* (search, chat, etc.)               │ │
│  │ → Better Auth       │  │ → Rewrite to ai-router:8000                │ │
│  │   (local handler)   │  │                                           │ │
│  └─────────────────────┘  └─────────────────────────────────────────┘ │
│           │                                    │                         │
│           │ SQLite (auth.db)                   │ Bearer JWT               │
│           ▼                                    ▼                         │
└───────────┼────────────────────────────────────┼────────────────────────┘
            │                                    │
            │                                    │  FastAPI validates JWT
            │                                    │  via JWKS from frontend
            │                                    ▼
            │                    ┌───────────────────────────────────────┐
            │                    │  ai-router (Python FastAPI :8000)      │
            │                    │  - get_current_user() dependency        │
            │                    │  - Optional auth on protected routes   │
            │                    └───────────────────────────────────────┘
            │
            ▼
┌─────────────────────────────────────────────────────────────────────────┐
│  SQLite file: ./data/auth.db (or frontend-manthana/manthana/auth.db)   │
│  No extra container. ~1–5 MB typical.                                   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Critical: API Rewrite Conflict

**Current state:** `next.config.mjs` rewrites **all** `/api/:path*` to the backend. That would send `/api/auth/sign-in` to ai-router, breaking auth.

**Fix:** Add a rewrite rule **before** the backend proxy so `/api/auth/*` stays on Next.js. Rewrites are applied in order; the first match wins.

```javascript
// next.config.mjs - rewrites() - ORDER MATTERS
async rewrites() {
  const backendUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
  return [
    // 1. Auth stays local — internal rewrite, handled by Next.js API route
    { source: "/api/auth/:path*", destination: "/api/auth/:path*" },
    // 2. All other /api/* → backend (search, chat, etc.)
    { source: "/api/:path*", destination: `${backendUrl}/:path*` },
  ];
}
```

**Note:** Replace hardcoded `45.130.165.198:8000` with `NEXT_PUBLIC_API_URL` for portability. If `NEXT_PUBLIC_API_URL` is unset, it falls back to `http://localhost:8000`.

---

## 3. Implementation Phases

### Phase 1: Frontend — Better Auth Setup (Non-Breaking)

| Step | Action | Files |
|------|--------|-------|
| 1.1 | Install package | `cd frontend-manthana/manthana && npm install better-auth` |
| 1.2 | Add env vars | `.env.local`: `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| 1.3 | Create auth config | `src/lib/auth.ts` |
| 1.4 | Create API route | `src/app/api/auth/[...all]/route.ts` |
| 1.5 | Create auth client | `src/lib/auth-client.ts` |
| 1.6 | Fix rewrites | `next.config.mjs` — exclude `/api/auth` |
| 1.7 | Run migrations | `npx auth@latest migrate` (creates SQLite tables) |

**Database:** SQLite (zero cost, file-based). Path: `./auth.db` or `./data/auth.db`.

```typescript
// src/lib/auth.ts
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import Database from "better-sqlite3";

export const auth = betterAuth({
  database: new Database("./auth.db"),
  secret: process.env.BETTER_AUTH_SECRET!,
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  emailAndPassword: { enabled: true },
  plugins: [jwt()],
});
```

---

### Phase 2: Auth UI (Optional Initially)

| Step | Action | Notes |
|------|--------|-------|
| 2.1 | Sign-in page | `src/app/(auth)/sign-in/page.tsx` |
| 2.2 | Sign-up page | `src/app/(auth)/sign-up/page.tsx` |
| 2.3 | Session provider | Wrap `LayoutShell` with auth context |
| 2.4 | Auth UI in Sidebar | Show "Sign in" or user avatar |

**Strategy:** Start with **optional auth** — app works without login. Add protected features later.

---

### Phase 3: Python Backend — JWT Validation (When Needed)

| Step | Action | Files |
|------|--------|-------|
| 3.1 | Add deps | `requirements.txt`: `python-jose[cryptography]`, `httpx` |
| 3.2 | Create auth module | `services/ai-router/auth.py` — `get_current_user()` |
| 3.3 | Add env | `BETTER_AUTH_URL` (e.g. `http://frontend:3001` or public URL) |
| 3.4 | Protect routes | Add `Depends(get_current_user)` to routes that need auth |

**JWT flow:**
1. Frontend calls `authClient.token()` after sign-in.
2. Frontend sends `Authorization: Bearer <jwt>` to ai-router.
3. ai-router fetches JWKS from `{BETTER_AUTH_URL}/api/auth/jwks`, validates JWT, returns user.

---

### Phase 4: Frontend API Client — Attach Token

| Step | Action | File |
|------|--------|------|
| 4.1 | Modify `api.ts` | Before each fetch, get token via `authClient.token()` and add `Authorization` header |
| 4.2 | Or use fetch wrapper | Central `fetchWithAuth()` that injects token |

---

## 4. File Checklist

### New Files

| File | Purpose |
|------|---------|
| `frontend-manthana/manthana/src/lib/auth.ts` | Better Auth server config |
| `frontend-manthana/manthana/src/lib/auth-client.ts` | Client for React components |
| `frontend-manthana/manthana/src/app/api/auth/[...all]/route.ts` | Catch-all auth handler |
| `frontend-manthana/manthana/auth.db` | SQLite DB (gitignored) |
| `frontend-manthana/manthana/src/app/(auth)/sign-in/page.tsx` | Sign-in UI |
| `frontend-manthana/manthana/src/app/(auth)/sign-up/page.tsx` | Sign-up UI |
| `services/ai-router/auth.py` | JWT validation + `get_current_user` |

### Modified Files

| File | Change |
|------|--------|
| `frontend-manthana/manthana/next.config.mjs` | Rewrite order; use env for backend URL |
| `frontend-manthana/manthana/package.json` | Add `better-auth`, `better-sqlite3` |
| `frontend-manthana/manthana/.env.local` | `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| `frontend-manthana/manthana/src/lib/api.ts` | Optional: attach Bearer token |
| `frontend-manthana/manthana/src/components/LayoutShell.tsx` | Optional: auth UI |
| `services/ai-router/main.py` | Optional: `Depends(get_current_user)` on protected routes |
| `services/ai-router/requirements.txt` | Add `python-jose[cryptography]` |
| `docker-compose.yml` | If frontend is containerized: add `BETTER_AUTH_URL`, volume for auth.db |

---

## 5. Environment Variables

### Frontend (`.env.local`)

```env
# Better Auth
BETTER_AUTH_SECRET=<32+ char secret, e.g. openssl rand -base64 32>
BETTER_AUTH_URL=http://localhost:3001

# Backend (existing)
NEXT_PUBLIC_API_URL=http://localhost:8000
```

### Production

```env
BETTER_AUTH_URL=https://manthana.ai
NEXT_PUBLIC_API_URL=https://api.manthana.ai
```

### ai-router (when using JWT)

```env
BETTER_AUTH_URL=https://manthana.ai
```

---

## 6. Zero-Cost Guarantee

| Item | Cost |
|------|------|
| Better Auth | MIT license, free |
| SQLite | File-based, no extra service |
| JWT validation | Stateless, no external calls after JWKS cache |
| No managed auth | No Auth0/Clerk/etc. |
| **Total** | **$0** (only VPS RAM/storage) |

**Storage:** SQLite ~1–5 MB for thousands of users. JWKS cached in memory.

---

## 7. Rollback Plan

If issues arise:

1. Remove `/api/auth` rewrite rule → all `/api/*` goes to backend again.
2. Delete `src/app/api/auth/` route.
3. Remove `better-auth` from `package.json` and run `npm install`.
4. Auth UI becomes inert; app behaves as before.

---

## 8. Testing Checklist

- [ ] Sign up with email/password
- [ ] Sign in
- [ ] Sign out
- [ ] Session persists across refresh
- [ ] `/api/auth/jwks` returns valid JWKS
- [ ] JWT from `authClient.token()` validates in Python
- [ ] Existing `/api/search`, `/api/chat` still work (no regression)
- [ ] Rewrite: `/api/auth/sign-in` hits Next.js, not backend

---

## 9. Optional: Remove Reference Repo

After implementation:

```bash
rm -rf /opt/manthana/better-auth-reference
```

The `better-auth` npm package is used at runtime; the cloned repo is only for reference.

---

## 10. Implementation Order (Recommended)

1. **Phase 1** — Auth server + API route + rewrites (no UI yet).
2. Verify `/api/auth/get-session` works, `/api/auth/jwks` returns keys.
3. **Phase 2** — Add sign-in/sign-up pages and session UI.
4. **Phase 3** — Add Python JWT validation when you need protected backend routes.
5. **Phase 4** — Attach token to API client for authenticated requests.

Start with Phase 1 only to avoid breaking existing behavior. Auth will be available but unused until you add UI and protection.
