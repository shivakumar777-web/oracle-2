Backend services and internal engines for the Manthana medical search platform.

- Core microservices live under `services/`
- Internal search engines (like Perplexica) live under `backend/search-engine/`

Perplexica is an internal-only search engine and must only be accessed via the `ai-router` service on port 8000.
