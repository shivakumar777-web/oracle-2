# Manthana — Full Post-Launch Testing on Kamatera

Complete commands to run the full Manthana stack on a Kamatera VPS and access the app in your browser.

---

## Readiness Checklist — Is the App Ready to Test?

| Check | Status |
|-------|--------|
| Backend (ai-router, clinical services, Ollama, Qdrant, Meilisearch, etc.) | ✅ Ready — use `docker-compose` or `docker compose` |
| Frontend (Next.js) | ✅ Ready — runs separately via `npm run start` |
| API URL config | ⚠️ Must set `NEXT_PUBLIC_API_URL` to reachable URL (e.g. `http://YOUR_IP:8000`) |
| CORS | ✅ Backend uses `FRONTEND_URL` — set to your frontend origin |
| Port exposure | ⚠️ Use `docker-compose.dev-ports.yml` to expose API on `0.0.0.0:8000` for browser access |
| Firewall | ⚠️ Open ports 3001 (frontend), 8000 (API) |

**Known gotchas:**
- **`docker compose` vs `docker-compose`**: If you get "unknown command: docker compose", use `docker-compose` (hyphen) instead. The Makefile uses `make build` / `make up` which calls `docker-compose`.
- **Frontend port**: The `start` script uses `-p 3001` by default.
- **First run**: Ollama pulls `nomic-embed-text` (~274MB) on first start — wait 5–10 min before health passes.

---

## Prerequisites

- **Kamatera VPS** with Docker and Docker Compose installed
- **Domain** (optional but recommended): Point `manthana.ai` or a subdomain to your Kamatera IP for TLS
- **API keys**: `GROQ_API_KEY` (required for LLM), `HF_TOKEN` (optional, for some models)

---

## 1. SSH into Kamatera

```bash
ssh root@YOUR_KAMATERA_IP
# or: ssh your_user@YOUR_KAMATERA_IP
```

---

## 2. Clone / Pull the Repo

```bash
cd /opt
git clone https://github.com/YOUR_ORG/manthana.git
# or if already cloned:
cd /opt/manthana && git pull
```

---

## 3. Configure Environment

```bash
cd /opt/manthana

# Copy example env
cp .env.example .env

# Edit .env — set these at minimum:
nano .env
```

**Required variables (minimum for testing):**

| Variable | Example | Notes |
|----------|---------|-------|
| `MEILI_MASTER_KEY` | `openssl rand -hex 32` | **Never use default** in production |
| `GROQ_API_KEY` | Your Groq key | Required for LLM |
| `DOMAIN` | `manthana.ai` or `45.130.165.198` | Use your Kamatera IP for IP-only testing |
| `ACME_EMAIL` | `admin@manthana.ai` | For Let's Encrypt (can be dummy if using IP) |
| `SEARXNG_SECRET` | `openssl rand -hex 16` | SearXNG needs a secret |
| `TRAEFIK_AUTH` | `admin:$$apr1$$...` | Optional; use `htpasswd -nb admin pass` for Traefik dashboard |
| `N8N_USER` / `N8N_PASSWORD` / `N8N_ENCRYPTION_KEY` | — | Optional; n8n may fail without them |
| `GRAFANA_USER` / `GRAFANA_PASSWORD` | — | Optional; Grafana defaults |
| `HF_TOKEN` | Optional | For Hugging Face models |

**Generate secure keys:**

```bash
# Meilisearch key
openssl rand -hex 32

# Add to .env (replace existing MEILI_MASTER_KEY)
```

**For IP-only testing** (no domain): Set `DOMAIN=YOUR_KAMATERA_IP`. Traefik will try ACME; it may fail without a real domain. Use the dev-ports override to access services directly (see step 5).

---

## 4. Start the Backend Stack

```bash
cd /opt/manthana

# Build all images (first time or after code changes)
# Use docker-compose (hyphen) if "docker compose" fails on your system
docker-compose build
# or: make build

# Start all services (crawlers/perplexica excluded by default — they need separate setup)
# For IP-based access (expose API on 0.0.0.0:8000 so browser can reach it):
docker-compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d
# or: docker compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d
```

**Wait for health** (Ollama pulls models on first run — can take 5–10 min):

```bash
# Check status
docker-compose ps

# Watch logs
docker-compose logs -f

# Health check when ready
curl http://localhost:8000/health
```

Expected: `{"status":"success",...}`

---

## 5. Start the Frontend

```bash
cd /opt/manthana/frontend-manthana/manthana

# Install deps (first time)
npm install

# Configure API URL for your setup
# For same-server: http://localhost:8000
# For browser from another machine: http://YOUR_KAMATERA_IP:8000
echo 'NEXT_PUBLIC_API_URL=http://YOUR_KAMATERA_IP:8000' >> .env.local
echo 'BETTER_AUTH_URL=http://YOUR_KAMATERA_IP:3001' >> .env.local
echo 'BETTER_AUTH_SECRET='$(openssl rand -base64 32) >> .env.local

# Build
npm run build

# Start (binds to 0.0.0.0:3001)
npm run start
# Or run in background: nohup npm run start > frontend.log 2>&1 &
```

---

## 6. Open in Browser

| URL | Purpose |
|-----|---------|
| `http://YOUR_KAMATERA_IP:3001` | **Main app** — Manthana UI |
| `http://YOUR_KAMATERA_IP:8000/health` | API health |
| `http://YOUR_KAMATERA_IP:8000/docs` | API docs (Swagger) |

**If using a domain with Traefik:**

| URL | Purpose |
|-----|---------|
| `https://manthana.ai` | Main app (if frontend is behind Traefik) |
| `https://api.manthana.ai` | API |
| `https://api.manthana.ai/docs` | API docs |

---

## 7. Verify Full Stack

```bash
# Backend health
curl http://localhost:8000/health

# Individual services (from host)
curl http://localhost:8101/health   # Radiology
curl http://localhost:8001/health   # Manthana API (reports, ICD-10)
curl http://localhost:7700/health   # Meilisearch
```

**In the browser:**

1. Open `http://YOUR_KAMATERA_IP:3001`
2. Try a search query
3. Try an image upload (radiology/eye/cancer/pathology)
4. Check API docs at `http://YOUR_KAMATERA_IP:8000/docs`

---

## 8. Known Limitations (Verified from Codebase)

### Clinical Trials — ✅ **Fully working**

- **Implementation:** `services/ai-router/clinical_trials.py` — real ClinicalTrials.gov API v2
- **Endpoint:** `POST /v1/clinical-trials/search`
- **Features:** Condition search, India filter, status/phase filters, Redis cache
- **Not a limitation** — returns real trials from ClinicalTrials.gov

### Perplexica — ⚠️ **Optional RAG source**

- **Location:** `backend/search-engine/perplexica/` — **empty** (no Dockerfile/source)
- **Used by:** ai-router `_query_perplexica()` for `/chat` and `/deep-research` RAG
- **When not running:** Returns `[]` (empty list) — graceful degradation
- **Impact:** Chat and Deep Research still work; you get fewer sources (Meilisearch + Qdrant remain)
- **Why limitation:** Build context is empty; service has `profiles: [perplexica]` so it doesn’t start by default

### Firecrawl — ⚠️ **Optional deep crawler**

- **Location:** `crawlers/firecrawl/` — **empty** (no `apps/api/Dockerfile`)
- **Used by:** `orchestrator.py` (manthana-api) in `crawl_deep()` for full-page extraction
- **Flow:** `extract()` tries Crawl4AI first (fast), then Firecrawl (deep) if content is short
- **When not running:** Falls back to SearXNG snippets — "Crawlers unavailable — using SearXNG snippets"
- **Impact:** Legacy search (manthana-api) gets less full-page content; SearXNG snippets still used
- **Why limitation:** Build context is empty; service has `profiles: [crawlers]` so it doesn’t start by default

---

## 9. Firewall (Kamatera / UFW)

Ensure these ports are open:

```bash
# If using UFW
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP (Traefik)
ufw allow 443/tcp   # HTTPS (Traefik)
ufw allow 3001/tcp  # Frontend (if not behind Traefik)
ufw allow 8000/tcp  # API (if using dev-ports)
ufw enable
ufw status
```

---

## 10. Optional: Crawlers & Perplexica

If you have Firecrawl, Nutch, and Perplexica set up:

```bash
docker-compose --profile crawlers --profile perplexica up -d
```

---

## 11. Stop / Restart

```bash
# Stop backend
cd /opt/manthana && docker-compose down

# Stop frontend: Ctrl+C if in foreground, or:
pkill -f "next start"

# Restart backend
docker-compose up -d
```

---

## Quick Reference — One-Liner Start

```bash
cd /opt/manthana && \
  cp -n .env.example .env 2>/dev/null; \
  docker-compose -f docker-compose.yml -f docker-compose.dev-ports.yml up -d && \
  echo "Backend starting. Wait ~5 min, then: curl http://localhost:8000/health"
```

Then in another terminal:

```bash
cd /opt/manthana/frontend-manthana/manthana && \
  npm install && npm run build && npm run start
```

Open: **http://YOUR_KAMATERA_IP:3001**
