# Oracle service — local development

## Quick start

From `oracle-2/services/oracle-service`:

```bash
chmod +x scripts/dev-start.sh   # once
./scripts/dev-start.sh
```

This sets `MANTHANA_ROOT` to `oracle-2`, extends `PYTHONPATH` with `oracle-2` and `services/ai-router`, points `CLOUD_INFERENCE_CONFIG_PATH` at the repo `config/cloud_inference.yaml` (parent of `oracle-2`), verifies imports, then runs:

`uvicorn main:app --host 127.0.0.1 --port 8100 --reload`

## Environment variables

| Variable | Purpose |
|----------|---------|
| `MANTHANA_ROOT` | Root directory that contains `services/shared/` (the `oracle-2` folder). Auto-detected from `paths_bootstrap.py` if unset. |
| `PYTHONPATH` | Must include `oracle-2` (for `services.shared`) and `oracle-2/services/ai-router` (flat `query_intelligence`, etc.). `dev-start.sh` sets this. |
| `CLOUD_INFERENCE_CONFIG_PATH` | Path to `cloud_inference.yaml` (OpenRouter roles/models). Default: `../config/cloud_inference.yaml` relative to `oracle-2`. |
| `ORACLE_USE_RAG` | Default `false` in dev script; set `true` when MeiliSearch/Qdrant/SearXNG are up. |
| `ORACLE_ENABLE_DOMAIN_INTELLIGENCE` | If `true` (default) and ai-router modules fail to import, `/v1/chat` returns a clear SSE error instead of silent stubs. |
| `OPENROUTER_API_KEY` / `ORACLE_OPENROUTER_API_KEY` | Required for live LLM calls (including [OpenRouter free router](https://openrouter.ai/docs/guides/routing/routers/free-models-router) — Bearer key still required). |
| `ORACLE_USE_FREE_MODELS` | `true` → chat/M5 use `openrouter/free` as primary (see `config/cloud_inference.yaml` roles `oracle_chat_free`, `oracle_m5_free`). Default `false`. |

## Verify modules loaded

```bash
curl -s http://127.0.0.1:8100/v1/health | jq .data.intelligence_modules
```

Expected when everything is wired:

```json
{
  "domain_intelligence": true,
  "query_classification": true,
  "m5_engine": true
}
```

If any flag is `false`, check server logs for `lib_unavailable` or `m5_engine_unavailable` (logged at **ERROR**).

## Frontend proxy (Next.js)

The Manthana Next app rewrites browser calls to Oracle so you avoid `ERR_CONNECTION_REFUSED` when the UI and API run on different hosts (e.g. cloud IDE):

- Browser → `/api/oracle-backend/v1/...`
- Next server → `ORACLE_INTERNAL_URL` (default `http://127.0.0.1:8100`) + path

Set in `.env.local`:

```env
ORACLE_INTERNAL_URL=http://127.0.0.1:8100
```

Sanity check (Oracle must be running):

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8100/v1/health
```

With Next dev on port 3001:

```bash
curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3001/api/oracle-backend/v1/health
```

## Common issues

### `ModuleNotFoundError: No module named 'services'`

`PYTHONPATH` must include the **`oracle-2`** directory (parent of the `services/` package), not only `oracle-service/`. Use `./scripts/dev-start.sh` or export paths manually.

### `FATAL: ... cannot find services/shared`

`MANTHANA_ROOT` points at the wrong tree, or the checkout is incomplete. `MANTHANA_ROOT` should be the directory that contains `services/shared/`.

### Chat works but only “general” / no domain detection

Intelligence libraries did not load. Fix `PYTHONPATH`, confirm `intelligence_modules` in `/v1/health`, or temporarily set `ORACLE_ENABLE_DOMAIN_INTELLIGENCE=false` to allow stub behavior (not recommended for production).

## Production checklist

- [ ] `MANTHANA_ROOT` or image layout provides `/app` with `services/shared` and `/app/lib` (or `ai-router`) on `PYTHONPATH`
- [ ] `/v1/health` shows all `intelligence_modules` true
- [ ] `CLOUD_INFERENCE_CONFIG_PATH` set to the correct `cloud_inference.yaml`
- [ ] API keys and downstream services (Redis, Meili, Qdrant, etc.) configured per `config.py`
