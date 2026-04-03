# Backend Coupling — Agent Caution Notes

**Purpose:** Document remaining coupling points in the Manthana backend. Agents editing these areas must exercise caution to avoid cascading failures or breaking multiple services.

**Last Updated:** March 2026

---

## Overview

The backend has been separated into section-specific services (Oracle, Web, Research, Analysis). However, several coupling points remain. **Changes to these areas can affect multiple services.**

---

## 1. Shared `services/shared` Package

**Location:** `services/shared/`

**Affected Services:** Oracle, Web (Research and Analysis use less of it)

**Key Files:**
- `circuit_breaker.py` — Oracle and Web import from here
- `envelopes.py` — Oracle and Web use `create_oracle_response`, `create_web_response`, etc.
- `redis_keys.py` — Key namespacing for all services
- `events.py` — Event bus (if used)

### Caution

- **Breaking changes** to `circuit_breaker.py` or `envelopes.py` will affect both Oracle and Web services.
- The design is **additive**: each service uses its own named instances (e.g. `oracle_groq_circuit`, `web_searxng_circuit`). Normal changes that add new instances or preserve existing APIs are safe.
- **Avoid:** Changing function signatures, removing exports, or altering the `CircuitBreaker` / envelope base classes without updating all consumers.
- **Prefer:** Adding new service-specific helpers or extending existing ones in a backward-compatible way.

---

## 2. Shared Redis Instance

**Location:** Single Redis instance used by all services (e.g. `redis://redis:6379`)

**Affected Services:** Oracle, Web, Research, Analysis

### Caution

- Keys are **namespaced** (`oracle:`, `web:`, `research:`, `analysis:`). Data does not collide.
- **Redis outage affects everyone.** There is no per-service Redis; it is a single point of failure.
- When editing Redis usage: use `services/shared/redis_keys.py` helpers to ensure correct namespace. Do not hardcode keys without a prefix.
- **Avoid:** Changing key structure or prefix logic without checking all services that use Redis.

---

## 3. Shared PostgreSQL Host

**Location:** Same PostgreSQL host; different databases per service

**Databases:** `oracle_service`, `web_service`, `research_service`, `analysis_service`

### Caution

- Each service has its **own database** — schema changes in one do not affect others.
- **Host failure affects all.** If the PostgreSQL host goes down, all section services are impacted.
- When adding migrations or connection logic: ensure `DATABASE_URL` is service-specific and points to the correct database.

---

## 4. Monolithic ai-router

**Location:** `services/ai-router/` (main gateway)

**Status:** Still present for gradual migration. New section services run alongside it.

### Caution

- The **ai-router is the legacy monolithic gateway.** Section-specific services (oracle-service, web-service, etc.) are the target architecture.
- Editing ai-router can affect all sections that still route through it.
- **Migration in progress:** Frontend and routing may still use ai-router. Changes to ai-router should consider whether the new section services are ready to take over.
- **Avoid:** Adding new cross-section dependencies in ai-router. Prefer moving logic into section-specific services.

---

## Quick Reference for Agents

| Area | Edit Safely? | Caution |
|------|---------------|---------|
| `services/oracle-service/*` | ✅ Yes | Isolated; changes stay in Oracle |
| `services/web-service/*` | ✅ Yes | Isolated; changes stay in Web |
| `services/research-service/*` | ✅ Yes | Isolated |
| `services/analysis-service/*` | ✅ Yes | Isolated |
| `services/shared/circuit_breaker.py` | ⚠️ Careful | Affects Oracle + Web |
| `services/shared/envelopes.py` | ⚠️ Careful | Affects Oracle + Web |
| `services/shared/redis_keys.py` | ⚠️ Careful | Affects all Redis users |
| `services/ai-router/*` | ⚠️ Careful | Legacy gateway; still in use |

---

## Related Documentation

- `SECTION_SEPARATION_FIX_PLAN.md` — Full architectural plan
- `docker-compose.yml` — Service definitions and dependencies
