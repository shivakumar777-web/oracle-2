# Manthana Production Deployment Checklist

**Use this checklist before deploying to production.** Items marked ⚠️ are security-critical.

---

## Required Environment Variables

Set these in `.env` or your deployment environment:

| Variable | Purpose | ⚠️ |
|----------|---------|-----|
| `MEILI_MASTER_KEY` | Meilisearch admin API key. **Must be a strong random value** — never use default `masterKey` in production. | **Yes** |
| `DOMAIN` | Root domain (e.g. `manthana.ai`) for Traefik routing | |
| `ACME_EMAIL` | Let's Encrypt email for TLS certificates | |
| `TRAEFIK_AUTH` | htpasswd string for Traefik dashboard protection | |
| `GROQ_API_KEY` | Groq API key for LLM synthesis | |
| `HF_TOKEN` | Hugging Face token for model downloads | |
| `LITELLM_MASTER_KEY` | LiteLLM proxy master key | |
| `SEARXNG_SECRET` | SearXNG secret key | |
| `GRAFANA_USER` / `GRAFANA_PASSWORD` | Grafana admin credentials | |
| `N8N_USER` / `N8N_PASSWORD` / `N8N_ENCRYPTION_KEY` | n8n workflow automation | |
| `FRONTEND_URL` | Frontend origin for CORS (e.g. `https://manthana.ai`) | |

---

## Security Verification

- [ ] **MEILI_MASTER_KEY** is set to a strong random value (e.g. `openssl rand -hex 32`). The app logs CRITICAL at startup if default key is used with a non-localhost Meilisearch URL.
- [ ] No secrets committed to git; `.env` and `.env.production` are in `.gitignore`.
- [ ] Traefik dashboard is protected with `TRAEFIK_AUTH`.
- [ ] Internal services (Meilisearch, Qdrant, Elasticsearch, etc.) are not exposed to the public internet.

---

## Pre-Launch Verification

- [ ] Run `make health` — all services return healthy.
- [ ] Frontend can reach ai-router at `NEXT_PUBLIC_API_URL`.
- [ ] TLS certificates are valid (Traefik ACME).
- [ ] Logs show no CRITICAL Meilisearch key warnings.

---

## Quick Commands

```bash
# Generate a secure Meilisearch key
openssl rand -hex 32

# Add to .env
echo "MEILI_MASTER_KEY=<paste-generated-key>" >> .env
```

---

*See `docker-compose.yml` for full list of configurable environment variables.*
