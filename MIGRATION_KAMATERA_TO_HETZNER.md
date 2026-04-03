# Migrate Manthana from Kamatera to Hetzner

Step-by-step guide to move your full stack with minimal downtime.

---

## Overview

| What | How |
|------|-----|
| Code | `git clone` on Hetzner |
| Config | Copy `.env` from Kamatera |
| User accounts | Copy `auth.db` from frontend |
| Search indexes | Copy Meilisearch + Qdrant volumes (optional) |
| AI models | Re-download on Hetzner (Ollama pulls automatically) |

---

## Prerequisites

- Hetzner Cloud account: https://console.hetzner.com
- SSH access to both Kamatera (source) and Hetzner (target)
- Domain DNS (you'll update A record at the end)

---

## Phase 1: Create Hetzner Server

1. **Create a Cloud Server**
   - Location: Germany (Falkenstein) or Finland (Helsinki)
   - Image: **Ubuntu 24.04**
   - Type: **CX43** (16 GB RAM, 160 GB, 8 vCPU) — €9.49/month
   - Add your SSH key
   - Create & note the **IP address**

2. **SSH into Hetzner**
   ```bash
   ssh root@YOUR_HETZNER_IP
   ```

3. **Install Docker**
   ```bash
   apt update && apt install -y curl
   curl -fsSL https://get.docker.com | sh
   apt install -y docker-compose-plugin
   ```

---

## Phase 2: Copy Data from Kamatera

Run these **on Kamatera** (or from your laptop with access to both).

### 2.1 Create a tarball of essentials

```bash
cd /opt/manthana

# Create migration bundle (excludes large/regeneratable data)
mkdir -p /tmp/manthana-migrate
cp .env /tmp/manthana-migrate/
cp -r configs /tmp/manthana-migrate/ 2>/dev/null || true

# Frontend auth (user accounts)
cp frontend-manthana/manthana/auth.db /tmp/manthana-migrate/ 2>/dev/null || true

# Optional: Meilisearch index (if you have indexed data to keep)
docker run --rm -v manthana_meilisearch-data:/data -v /tmp/manthana-migrate:/out \
  alpine tar czf /out/meilisearch-data.tar.gz -C /data .

# Optional: Qdrant vectors (if you have embeddings to keep)
docker run --rm -v manthana_qdrant-data:/data -v /tmp/manthana-migrate:/out \
  alpine tar czf /out/qdrant-data.tar.gz -C /data .

# Create single bundle
cd /tmp
tar czf manthana-migrate.tar.gz manthana-migrate/
ls -lh manthana-migrate.tar.gz
```

### 2.2 Transfer to Hetzner

```bash
# From Kamatera, push to Hetzner (replace HETZNER_IP)
scp /tmp/manthana-migrate.tar.gz root@HETZNER_IP:/tmp/
```

Or **from your laptop** (if you have both IPs):

```bash
scp root@KAMATERA_IP:/tmp/manthana-migrate.tar.gz ./
scp manthana-migrate.tar.gz root@HETZNER_IP:/tmp/
```

---

## Phase 3: Setup on Hetzner

### 3.1 Clone repo and restore data

```bash
# On Hetzner
cd /opt
git clone https://github.com/YOUR_ORG/manthana.git
# Or: git clone YOUR_REPO_URL manthana
cd manthana
```

### 3.2 Extract migration bundle

```bash
cd /opt/manthana
tar xzf /tmp/manthana-migrate.tar.gz -C /tmp/
cp /tmp/manthana-migrate/.env .env

# Update .env for Hetzner
nano .env
# Set: DOMAIN=your-domain.com  (or Hetzner IP for testing)
# Set: FRONTEND_URL=https://your-domain.com  (or http://HETZNER_IP:3001)
```

### 3.3 Restore volumes (if you copied them)

```bash
# Meilisearch (optional)
docker volume create manthana_meilisearch-data
docker run --rm -v manthana_meilisearch-data:/data -v /tmp/manthana-migrate:/in \
  alpine sh -c "cd /data && tar xzf /in/meilisearch-data.tar.gz"

# Qdrant (optional)
docker volume create manthana_qdrant-data
docker run --rm -v manthana_qdrant-data:/data -v /tmp/manthana-migrate:/in \
  alpine sh -c "cd /data && tar xzf /in/qdrant-data.tar.gz"
```

### 3.4 Restore frontend auth

```bash
cp /tmp/manthana-migrate/auth.db frontend-manthana/manthana/ 2>/dev/null || true
```

---

## Phase 4: Start the Stack

### 4.1 Build and run backend

```bash
cd /opt/manthana
docker compose build
docker compose up -d
```

Wait for health (Ollama pulls nomic-embed-text on first run — 5–10 min):

```bash
docker compose ps
docker compose logs -f
# When ready:
curl http://localhost:8000/health
```

### 4.2 Start frontend

```bash
cd /opt/manthana/frontend-manthana/manthana
npm install
echo "NEXT_PUBLIC_API_URL=http://HETZNER_IP:8000" >> .env.local
echo "BETTER_AUTH_URL=http://HETZNER_IP:3001" >> .env.local
echo "BETTER_AUTH_SECRET=$(openssl rand -base64 32)" >> .env.local
npm run build
npm run start
# Or: nohup npm run start > frontend.log 2>&1 &
```

---

## Phase 5: DNS & Firewall

1. **Update DNS** — Point your domain A record to Hetzner IP
2. **Firewall** (on Hetzner):
   ```bash
   ufw allow 22
   ufw allow 80
   ufw allow 443
   ufw allow 3001
   ufw allow 8000
   ufw enable
   ```

---

## Phase 6: Stop Kamatera (after verification)

1. Test everything on Hetzner
2. Stop services on Kamatera:
   ```bash
   cd /opt/manthana && docker compose down
   pkill -f "next start"
   ```
3. Cancel Kamatera if no longer needed

---

## Quick Reference: Minimal Migration (Fresh Start)

If you don't need to preserve indexes or user accounts:

```bash
# On Hetzner only
cd /opt && git clone YOUR_REPO manthana && cd manthana
cp .env.example .env
nano .env  # Fill DOMAIN, MEILI_MASTER_KEY, GROQ_API_KEY, etc.
docker compose build && docker compose up -d
# Wait ~10 min, then start frontend
cd frontend-manthana/manthana && npm install && npm run build && npm run start
```

---

## Troubleshooting

| Issue | Fix |
|------|-----|
| Ollama health fails | Wait longer; first run pulls ~274MB model |
| CORS errors | Set `FRONTEND_URL` and `EXTRA_CORS_ORIGINS` in .env |
| Traefik cert errors | Ensure DOMAIN points to Hetzner IP; check ACME_EMAIL |
| Port already in use | `docker compose down` then `up -d` |
