import asyncio
import httpx
import json
import hashlib
import time
import logging
import os

# ── Logging Setup ─────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("manthana.log")
    ]
)
log = logging.getLogger("manthana")

# ── Service URLs (Docker internal network) ────────────────
SEARXNG       = os.getenv("SEARXNG_URL",       "http://searxng:8080")
FIRECRAWL     = os.getenv("FIRECRAWL_URL",     "http://firecrawl-api:3002")
CRAWL4AI      = os.getenv("CRAWL4AI_URL",      "http://crawl4ai:11235")
OLLAMA        = os.getenv("OLLAMA_URL",         "http://ollama:11434")
QDRANT        = os.getenv("QDRANT_URL",         "http://qdrant:6333")
ELASTICSEARCH = os.getenv("ELASTICSEARCH_URL", "http://elasticsearch:9200")
MEILISEARCH   = os.getenv("MEILISEARCH_URL",   "http://meilisearch:7700")
MEILI_KEY     = os.getenv("MEILI_MASTER_KEY",  "")
OLLAMA_MODEL  = os.getenv("OLLAMA_MODEL",       "llama3")

# ── Collection / Index names ──────────────────────────────
# CRITICAL: these MUST match the names used in ai-router/main.py
ES_INDEX    = "manthana-medical"
QDRANT_COL  = "medical_documents"   # fix #3: was "manthana-vectors"
MEILI_INDEX = "medical_search"      # fix #4: was "manthana-medical"

TIMEOUT = 15

# ═══════════════════════════════════════════════════════════
# UTILITY
# ═══════════════════════════════════════════════════════════

def doc_id(url: str) -> str:
    return hashlib.md5(url.encode()).hexdigest()


# ── Async HTTP helpers (fix #5: replaced sync requests with httpx) ─
async def safe_post(url: str, payload: dict, timeout: int = TIMEOUT) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.post(url, json=payload)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        log.warning(f"POST failed {url}: {e}")
        return {}


async def safe_get(url: str, params: dict = None, timeout: int = TIMEOUT) -> dict:
    try:
        async with httpx.AsyncClient(timeout=timeout) as client:
            r = await client.get(url, params=params)
            r.raise_for_status()
            return r.json()
    except Exception as e:
        log.warning(f"GET failed {url}: {e}")
        return {}


# ═══════════════════════════════════════════════════════════
# LAYER 1 — SEARCH (SearXNG)
# ═══════════════════════════════════════════════════════════

async def search_web(query: str, category: str = "medical") -> list:
    log.info(f"[SEARCH] Query: {query} | Category: {category}")
    data = await safe_get(f"{SEARXNG}/search", {
        "q": query,
        "format": "json",
        "categories": category,
        "language": "en"
    })
    results = data.get("results", [])
    log.info(f"[SEARCH] Found {len(results)} results")
    return results


# ═══════════════════════════════════════════════════════════
# LAYER 2 — EXTRACT (Crawl4AI + Firecrawl)
# ═══════════════════════════════════════════════════════════

async def crawl_fast(url: str) -> str:
    """Crawl4AI — fast bulk extraction"""
    log.info(f"[CRAWL4AI] Crawling: {url}")
    data = await safe_post(f"{CRAWL4AI}/crawl", {
        "url": url,
        "priority": 10
    })
    return data.get("result", {}).get("markdown", "")


async def crawl_deep(url: str) -> str:
    """Firecrawl — deep JS-rendered extraction"""
    log.info(f"[FIRECRAWL] Deep crawling: {url}")
    data = await safe_post(f"{FIRECRAWL}/v1/scrape", {
        "url": url,
        "formats": ["markdown"],
        "onlyMainContent": True,
        "waitFor": 2000
    })
    return data.get("data", {}).get("markdown", "")


async def extract(url: str, deep: bool = False) -> str:
    content = await crawl_deep(url) if deep else await crawl_fast(url)
    if not content or len(content) < 100:
        log.warning(f"[EXTRACT] Fallback to deep crawl: {url}")
        content = await crawl_deep(url)
    return content


# ═══════════════════════════════════════════════════════════
# LAYER 3 — INDEX (Elasticsearch + Qdrant + Meilisearch)
# ═══════════════════════════════════════════════════════════

async def index_elasticsearch(url: str, content: str,
                               title: str = "", engine: str = ""):
    did = doc_id(url)
    log.info(f"[ES] Indexing: {url[:60]}")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.put(
                f"{ELASTICSEARCH}/{ES_INDEX}/_doc/{did}",
                json={
                    "url": url,
                    "title": title,
                    "content": content,
                    "engine": engine,
                    "indexed_at": time.strftime("%Y-%m-%dT%H:%M:%SZ")
                }
            )
            r.raise_for_status()
    except Exception as e:
        log.warning(f"[ES] Index failed: {e}")


async def get_embedding(text: str) -> list:
    data = await safe_post(f"{OLLAMA}/api/embeddings", {
        "model": OLLAMA_MODEL,
        "prompt": text[:2000]
    })
    return data.get("embedding", [])


async def index_qdrant(url: str, content: str, title: str = ""):
    log.info(f"[QDRANT] Embedding: {url[:60]}")
    vector = await get_embedding(content[:2000])
    if not vector:
        log.warning("[QDRANT] Empty embedding — skipping")
        return
    did = abs(int(hashlib.md5(url.encode()).hexdigest(), 16)) % (10**12)
    await safe_post(f"{QDRANT}/collections/{QDRANT_COL}/points", {
        "points": [{
            "id": did,
            "vector": vector,
            "payload": {
                "url": url,
                "title": title,
                "snippet": content[:500]
            }
        }]
    })


async def index_meilisearch(url: str, content: str, title: str = ""):
    log.info(f"[MEILI] Indexing: {url[:60]}")
    did = doc_id(url)
    headers = {}
    if MEILI_KEY:
        headers["Authorization"] = f"Bearer {MEILI_KEY}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            r = await client.post(
                f"{MEILISEARCH}/indexes/{MEILI_INDEX}/documents",
                json=[{
                    "id": did,
                    "url": url,
                    "title": title,
                    "content": content[:5000]
                }],
                headers=headers
            )
            r.raise_for_status()
    except Exception as e:
        log.warning(f"[MEILI] Index failed: {e}")


async def index_all(url: str, content: str,
                    title: str = "", engine: str = ""):
    if not content or len(content) < 50:
        log.warning(f"[INDEX] Skipping empty content: {url}")
        return
    await asyncio.gather(
        index_elasticsearch(url, content, title, engine),
        index_qdrant(url, content, title),
        index_meilisearch(url, content, title),
    )
    log.info(f"[INDEX] ✅ All 3 indexes updated: {url[:60]}")


# ═══════════════════════════════════════════════════════════
# LAYER 4 — OWN INDEX SEARCH
# ═══════════════════════════════════════════════════════════

async def search_own_index(query: str) -> list:
    log.info(f"[OWN INDEX] Checking Elasticsearch: {query}")
    data = await safe_get(
        f"{ELASTICSEARCH}/{ES_INDEX}/_search",
        {"q": query, "size": 5}
    )
    hits = data.get("hits", {}).get("hits", [])
    log.info(f"[OWN INDEX] Found {len(hits)} local results")
    return hits


# ═══════════════════════════════════════════════════════════
# LAYER 5 — AI SYNTHESIS (Ollama)
# ═══════════════════════════════════════════════════════════

async def synthesize(query: str, context: str) -> str:
    log.info(f"[OLLAMA] Synthesizing answer for: {query}")
    prompt = f"""You are Manthana, India's medical intelligence engine.
You have expertise in Ayurveda, Allopathy, Homeopathy, Siddha and Unani.
Answer the following medical query using ONLY the provided context.
Always cite sources. Be accurate, concise and evidence-based.

Query: {query}

Context:
{context[:4000]}

Answer:"""
    data = await safe_post(f"{OLLAMA}/api/generate", {
        "model": OLLAMA_MODEL,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "top_p": 0.9,
            "num_predict": 512
        }
    }, timeout=60)
    answer = data.get("response", "")
    log.info(f"[OLLAMA] Answer generated ({len(answer)} chars)")
    return answer


# ═══════════════════════════════════════════════════════════
# MASTER PIPELINE — INTELLIGENT QUERY ROUTER
# ═══════════════════════════════════════════════════════════

def query_is_complex(query: str) -> bool:
    words = query.strip().split()
    complex_keywords = [
        "compare", "difference", "vs", "versus",
        "interaction", "side effect", "contraindication",
        "dosage", "protocol", "treatment plan", "mechanism"
    ]
    is_long = len(words) > 5
    has_complex_keyword = any(
        k in query.lower() for k in complex_keywords
    )
    return is_long or has_complex_keyword


async def manthana_search(query: str,
                           category: str = "medical",
                           force_ai: bool = False) -> dict:
    log.info(f"{'='*60}")
    log.info(f"[MANTHANA] New query: {query}")
    start = time.time()

    # ── MODE 1: Check own index first (zero cost) ──────────
    own_hits = await search_own_index(query)
    if len(own_hits) >= 5 and not force_ai:
        log.info("[MANTHANA] MODE 1: Serving from own index")
        elapsed = round(time.time() - start, 2)
        return {
            "mode": "own_index",
            "query": query,
            "answer": None,
            "sources": [h["_source"]["url"] for h in own_hits],
            "results": [h["_source"] for h in own_hits],
            "elapsed_seconds": elapsed
        }

    # ── MODE 2: Web search + crawl + index ────────────────
    log.info("[MANTHANA] MODE 2: Web search + crawl pipeline")
    web_results = await search_web(query, category)
    top_urls    = [r["url"] for r in web_results[:5]]
    contents    = []

    # Crawl top 5 URLs concurrently
    async def crawl_and_index(result: dict):
        url    = result.get("url", "")
        title  = result.get("title", "")
        engine = result.get("engine", "")
        if not url:
            return None
        content = await extract(url)
        if content:
            await index_all(url, content, title, engine)
        return content

    crawl_tasks = [crawl_and_index(r) for r in web_results[:5]]
    crawl_results = await asyncio.gather(*crawl_tasks)
    contents = [c for c in crawl_results if c]

    # ── MODE 3: AI synthesis for complex queries ───────────
    answer = None
    if (force_ai or query_is_complex(query)) and contents:
        log.info("[MANTHANA] MODE 3: AI synthesis activated")
        combined = "\n\n---\n\n".join(contents[:3])
        answer   = await synthesize(query, combined)

    elapsed = round(time.time() - start, 2)
    log.info(f"[MANTHANA] ✅ Done in {elapsed}s | "
             f"Mode: {'AI' if answer else 'search'} | "
             f"Sources: {len(top_urls)}")

    return {
        "mode": "ai_synthesis" if answer else "web_search",
        "query": query,
        "answer": answer,
        "sources": top_urls,
        "results": web_results[:5],
        "elapsed_seconds": elapsed
    }


# ═══════════════════════════════════════════════════════════
# INIT — Create indexes on first run
# ═══════════════════════════════════════════════════════════

async def init_indexes():
    log.info("[INIT] Creating Elasticsearch index...")
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            await client.put(
                f"{ELASTICSEARCH}/{ES_INDEX}",
                json={
                    "settings": {"number_of_shards": 1,
                                  "number_of_replicas": 0},
                    "mappings": {"properties": {
                        "url":        {"type": "keyword"},
                        "title":      {"type": "text"},
                        "content":    {"type": "text"},
                        "engine":     {"type": "keyword"},
                        "indexed_at": {"type": "date"}
                    }}
                }
            )
        log.info("[INIT] ✅ Elasticsearch index ready")
    except Exception as e:
        log.warning(f"[INIT] ES index may already exist: {e}")

    log.info("[INIT] Creating Qdrant collection...")
    # fix #6: vector size changed from 4096 → 768 to match all-MiniLM-L6-v2
    await safe_post(f"{QDRANT}/collections/{QDRANT_COL}", {
        "vectors": {
            "size": 768,
            "distance": "Cosine"
        }
    })
    log.info("[INIT] ✅ Qdrant collection ready")

    log.info("[INIT] Creating Meilisearch index...")
    headers = {}
    if MEILI_KEY:
        headers["Authorization"] = f"Bearer {MEILI_KEY}"
    try:
        async with httpx.AsyncClient(timeout=TIMEOUT) as client:
            await client.post(
                f"{MEILISEARCH}/indexes",
                json={"uid": MEILI_INDEX, "primaryKey": "id"},
                headers=headers
            )
        log.info("[INIT] ✅ Meilisearch index ready")
    except Exception as e:
        log.warning(f"[INIT] Meili index may already exist: {e}")


# ═══════════════════════════════════════════════════════════
# ENTRY POINT
# ═══════════════════════════════════════════════════════════

async def main():
    log.info("🔱 MANTHANA — Medical Intelligence Engine Starting...")
    await init_indexes()

    # Test query
    result = await manthana_search(
        "ashwagandha dosage for stress and anxiety"
    )
    print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
