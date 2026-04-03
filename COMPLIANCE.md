# Manthana — Compliance & Data Handling

**Document:** Compliance, data handling, and regulatory stance  
**Last updated:** March 2026

---

## 1. Intended Use & Regulatory Stance

Manthana is a **medical domain intelligence platform** intended for:

- **Research and educational use**
- **Clinical decision support** (as an adjunct, not a replacement for professional judgment)
- **Prototype and MVP deployments** for validation

**Regulatory position:** Manthana is **not** a medical device under FDA 21 CFR Part 820 or EU MDR. It is a software tool for information retrieval, analysis support, and education. Use in clinical workflows must comply with local regulations and institutional policies.

---

## 2. Data Handling

### 2.1 Data Types

| Data Type | Storage | Retention | PII |
|-----------|---------|-----------|-----|
| **Uploaded files** (images, DICOM, etc.) | Ephemeral (processed, not persisted by default) | Request lifecycle | May contain PHI |
| **Search queries** | Not persisted by default | — | May contain PHI |
| **Audit log** | SQLite (`manthana_audit.db`) | Configurable | No PII in findings (labels + confidence only) |
| **Plagiarism scans** | Qdrant vectors (embeddings) | Configurable | Text may contain PHI |
| **Auth (Better Auth)** | SQLite (`auth.db`) in frontend | Per Better Auth config | Email, hashed password |

### 2.2 Audit Trail

- **Analysis requests** (`/v1/analyze/*`): Logged with `request_id`, `service`, `endpoint`, `model_id`, `findings_summary` (labels + confidence only).
- **Plagiarism checks** (`/v1/plagiarism/check`): Logged with `request_id`, `service`, `endpoint`, `originality_score`.
- **No PII** is stored in the audit log. `patient_id` and `study_id` are optional and provided by the client.

### 2.3 Data Retention

- **Audit DB:** Retained per deployment. No automatic purge. Configure `AUDIT_DB_PATH` for custom location.
- **Uploaded files:** Processed in-memory or streamed; not stored by default.
- **Search cache (Redis):** TTL 300 seconds (configurable via `SEARCH_CACHE_TTL`).

---

## 3. Security

### 3.1 Authentication

- **Better Auth (JWT):** Frontend uses Better Auth for sign-in/sign-up. JWT validated by ai-router via JWKS.
- **Optional auth:** Most endpoints accept unauthenticated requests. `GET /me` returns user when Bearer token is present.
- **Protected routes:** Can be added with `Depends(get_current_user)` for PHI-handling deployments.

### 3.2 Secrets

- API keys, tokens, and passwords come from environment variables or `.env`.
- No hardcoded credentials in code.
- See `DEPLOYMENT_CHECKLIST.md` for `MEILI_MASTER_KEY` and other production secrets.

### 3.3 CORS

- Explicitly configured with `FRONTEND_URL` and localhost origins.
- No wildcard `*` in production.

---

## 4. Medical Disclaimer

All endpoints and UI surfaces include:

> "For research and educational use only. This analysis is AI-generated and NOT a substitute for professional medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider."

---

## 5. Recommendations for PHI / Production

For deployments handling PHI or regulated clinical use:

1. **Enable authentication** on all sensitive endpoints (`/v1/analyze/*`, `/v1/plagiarism/check`).
2. **Audit logging:** Already enabled; ensure `AUDIT_DB_PATH` is in a secure, backed-up location.
3. **Data encryption:** Use TLS (Traefik) for all traffic; encrypt audit DB at rest if required.
4. **Access control:** Restrict audit query API (`/v1/audit/log`) to admin roles.
5. **Compliance:** Consult legal counsel for HIPAA, GDPR, or local healthcare data regulations.

---

*This document is for informational purposes. It does not constitute legal advice.*
