# Manthana — Operations Runbook

**Document:** Incident response, scaling, recovery, health checks  
**Last updated:** March 2026

---

## 1. Health Checks

### 1.1 Service Health

```bash
# Router health (all downstream services)
curl http://localhost:8000/health

# Individual service health
curl http://localhost:8001/health   # manthana-api
# Radiology ML service removed — use ECG: curl http://localhost:8102/health
curl http://localhost:7700/health   # meilisearch
```

**Expected response:** `{"status": "success", "data": {"router": "online", "services": {...}}}`

### 1.2 Critical Dependencies

| Service | Port | Purpose |
|---------|------|---------|
| ai-router | 8000 | Frontend entry point |
| manthana-api | 8001 | ICD-10, report PDF |
| SearXNG | 8080 | Web search |
| Meilisearch | 7700 | Search index |
| Qdrant | 6333 | Vector search |
| Redis | 6379 | Cache |
| Ollama/LiteLLM | 4000/11434 | LLM inference |

---

## 2. Common Issues

### 2.1 Router Returns 502

**Cause:** Downstream service (radiology, api, etc.) is down or unreachable.

**Actions:**
1. Check `docker-compose ps` — all services should be `Up`.
2. Check service logs: `docker-compose logs <service-name>`.
3. Verify network: e.g. `docker-compose exec ai-router curl -s http://ecg:8102/health`.

### 2.2 Search Returns Empty

**Cause:** SearXNG or Meilisearch unavailable.

**Actions:**
1. `curl http://searxng:8080/health` (or `localhost:4000` if mapped).
2. `curl http://meilisearch:7700/health`.
3. Check Meilisearch key: `MEILI_MASTER_KEY` must be set in production; default `masterKey` logs CRITICAL for non-localhost.

### 2.3 Plagiarism Check Fails

**Cause:** Qdrant or Sentence-Transformers unavailable.

**Actions:**
1. Check Qdrant: `curl http://qdrant:6333/collections`.
2. Check ai-router logs for `plagiarism_check_failed`.

### 2.4 High Memory / CPU

**Cause:** Clinical services (ECG, eye, etc.) load ML models.

**Actions:**
1. Check `docker stats` for resource usage.
2. Restart heavy services: e.g. `docker-compose restart ecg eye`.
3. Consider `ENABLE_GPU=true` if GPU available.

---

## 3. Scaling

### 3.1 Horizontal Scaling

- **ai-router:** Stateless; can run multiple replicas behind a load balancer.
- **Clinical services:** Each loads ML models; scale based on CPU/GPU capacity.
- **Meilisearch, Qdrant, Redis:** Use official scaling guides for production.

### 3.2 Docker Compose

```bash
# Scale ai-router to 2 replicas (example)
docker-compose up -d --scale ai-router=2
```

### 3.3 Kubernetes

- Use `docker-compose` as reference for K8s manifests.
- Ensure `depends_on` and health checks are translated to `readinessProbe`/`livenessProbe`.

---

## 4. Recovery

### 4.1 Restart All Services

```bash
docker-compose down
docker-compose up -d
make health
```

### 4.2 Restart Single Service

```bash
docker-compose restart ai-router
```

### 4.3 Audit Log Recovery

- Audit DB: `manthana_audit.db` (or `AUDIT_DB_PATH`).
- Backup: `cp manthana_audit.db manthana_audit.db.bak`.
- No built-in purge; implement manual or cron-based retention if needed.

### 4.4 Redis Cache

- Cache is ephemeral. Restart clears search cache.
- No action required for recovery.

---

## 5. Logging

- **Structured logs:** JSON format for Loki/Grafana.
- **Log level:** `LOG_LEVEL=INFO` (default). Use `DEBUG` for troubleshooting.
- **Log locations:** Docker stdout; configure Promtail/Loki for aggregation.

---

## 6. Monitoring

- **Prometheus:** `http://localhost:9090` (or Traefik route).
- **Grafana:** Pre-built dashboards for metrics.
- **Key metrics:** `manthana_requests_total`, `manthana_errors_total`, `manthana_rate_limited_total`.

---

## 7. Contact

- **Documentation:** See `README.md`, `DEPLOYMENT_CHECKLIST.md`, `COMPLIANCE.md`.
- **Issues:** GitHub repository for bug reports and feature requests.
