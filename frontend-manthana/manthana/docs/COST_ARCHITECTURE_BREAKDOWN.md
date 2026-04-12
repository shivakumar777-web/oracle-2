# Manthana Labs + Oracle - Complete Cost Architecture Breakdown

## Executive Summary

This document breaks down every single infrastructure component, service, GPU/CPU spec, and billing model used in production. No pricing numbers included - read this to understand WHERE costs originate so you can calculate your own estimates.

---

## 1. INFRASTRUCTURE STACK OVERVIEW

### 1.1 Frontend Layer (User-Facing)
**Service: Vercel**
- **What runs here:** Next.js 14 application with App Router
- **Framework:** React 18, TypeScript, Tailwind CSS
- **Build output:** Static + Edge Functions + Serverless Functions
- **Regions:** Vercel Edge Network (global CDN)

**Resources consumed:**
- Bandwidth: Static assets (JS bundles, CSS, images)
- Function invocations: API routes, middleware, SSR pages
- Build minutes: Git push → deployment pipeline
- Concurrent executions: Simultaneous users hitting the site

---

### 1.2 Application Backend (API Layer)
**Service: Railway**
- **What runs here:** Gateway API service (Python/FastAPI or Node)
- **Purpose:** Route requests, auth, orchestration
- **Deployment:** Containerized service

**Resources consumed:**
- CPU cores: Request processing, JSON serialization, auth verification
- RAM: Session storage, request buffering, in-memory queues
- Network egress: Calling downstream services (Modal, databases)
- Disk: Temporary file storage for uploads before forwarding

---

### 1.3 AI/ML Inference Layer (GPU-Intensive)
**Service: Modal Labs**
- **What runs here:** Vision models, multimodal inference (Kimi-class models)
- **Deployment pattern:** Serverless GPU functions (cold start → warm → scale down)

**GPU Resources:**
- **Model type:** Multimodal vision-language model (Kimi K2.5 class)
- **GPU tiers available on Modal:**
  - T4 (NVIDIA Tesla T4, 16GB VRAM) - entry level
  - L4 (NVIDIA L4, 24GB VRAM) - mid-range
  - A10G (NVIDIA A10G, 24GB VRAM) - higher throughput
  - A100 (NVIDIA A100 40GB/80GB) - maximum performance
  - H100 (NVIDIA H100) - latest generation (rarely needed for this)

**CPU Resources:**
- Pre-processing: Image decoding, resizing, format conversion
- Post-processing: Token generation handling, response formatting

**Memory (RAM):**
- Model weights storage in VRAM
- Image tensors in GPU memory
- KV cache during generation

**Storage:**
- Container image registry (your model + dependencies)
- Temporary checkpoint storage

---

### 1.4 Data & Auth Layer
**Service: Supabase**
- **What runs here:** PostgreSQL database, Auth, Storage

**PostgreSQL Resources:**
- Compute: CPU cores for query processing
- RAM: Buffer cache, connection handling
- Storage: Row data, indexes, WAL (write-ahead logs)
- Connections: Concurrent client connections

**Auth Resources:**
- GoTrue server (Go-based auth service)
- Token generation/validation
- Session storage

**Storage (S3-compatible):**
- Image uploads (DICOM, X-rays, CT scans)
- Report PDFs
- Export files

---

### 1.5 Payment Processing
**Service: Razorpay**
- Webhook handling (your Railway backend receives these)
- No direct infrastructure cost - purely transaction-based

---

## 2. DETAILED WORKFLOW RESOURCE CONSUMPTION

### 2.1 Labs Single-Modality Analysis (e.g., X-ray Upload)

**Step-by-step resource usage:**

#### Step 1: Image Upload
**Client → Vercel**
- Vercel receives: HTTP POST with multipart/form-data
- **Resources:** Bandwidth in, function execution time

**Vercel → Railway (Gateway)**
- Forward request to backend
- **Resources:** Vercel outbound bandwidth, Railway inbound bandwidth

**Railway → Supabase Storage**
- Store raw file temporarily
- **Resources:** Railway outbound, Supabase inbound storage write

#### Step 2: Modality Detection (if auto)
**Railway CPU processing**
- Simple heuristics or lightweight model
- **Resources:** Railway CPU cycles, RAM

#### Step 3: AI Analysis (GPU Heavy)
**Railway → Modal**
- API call to Modal endpoint
- **Resources:** Railway network egress

**Modal GPU execution:**
- Container cold start (if not warm): Pull image, load model weights
- **GPU time:** VRAM allocation, model forward pass on image
- **CPU time:** Image preprocessing (resize, normalize, tokenize)
- **Memory:** Model weights (~2-8GB depending on model variant) + image tensors

**Modal output:**
- Structured JSON result (findings, severity, etc.)
- **Resources:** Network egress back to Railway

#### Step 4: Report Generation
**Railway → Modal (second call)**
- Generate narrative report from structured findings
- **Resources:** Another GPU inference pass (typically shorter than analysis)

#### Step 5: Save Results
**Railway → Supabase PostgreSQL**
- INSERT analysis results, report text
- **Resources:** DB compute, storage IOPS

#### Step 6: Return to Client
**Railway → Vercel → Browser**
- JSON response with results
- **Resources:** Network egress on all hops

---

### 2.2 Multi-Modality Unified Analysis (e.g., CT + X-ray + ECG)

**Resource multiplier effect:**

**Sequential processing per modality:**
- Each modality = one complete analysis pipeline (Steps 3-4 above)
- **3 modalities = 3 GPU calls**

**Unified Report Step:**
- Additional GPU call to cross-reference findings
- **Extra inference:** Combines outputs from all 3 analyses
- Generates cross-modality correlations

**Total GPU calls for multi-modality:**
- N modalities × analysis + N modalities × report + 1 unify call
- Example: 3 modalities = 3 analysis + 3 reports + 1 unify = **7 GPU inferences**

---

### 2.3 Oracle Chat (Post-Labs Discussion)

**Context Handling:**

#### Initial Message (Labs handoff)
**System prompt + Labs report injected**
- Full markdown report (can be 1000-3000+ tokens)
- **Resources:** Large input context for every Oracle turn

**GPU usage per message:**
- Input: Previous conversation history + new question
- Processing: Attention mechanism over full context
- Output: Streaming response generation

**Token growth pattern:**
- Turn 1: Report (3000 tokens) + question (50 tokens) → response (500 tokens)
- Turn 2: Report + turn 1 conversation + new question → response
- **Each turn adds to context window** unless backend truncates/summarizes

**Inference characteristics:**
- Longer context = more memory usage, slower processing
- Streaming output = GPU stays active throughout generation

---

### 2.4 CT Scan Specifics (High Token Count)

**Why CT is expensive:**

#### Image Volume
- X-ray: 1 image, typical resolution ~2-5MB
- CT: 50-500 slices (DICOM series), each slice ~500KB-1MB
- **Total data:** 25-500MB for one CT study

#### Vision Tokenization
- Multimodal models tokenize images differently than text
- One approach: Image patches (e.g., 32x32 pixel patches)
- 512×512 image ≈ 256-1024 tokens depending on patch size
- CT with 100 slices @ 1024 tokens each = **102,400 vision tokens**

#### Processing Strategies
**Option A: Full Volume (Most Accurate, Most Expensive)**
- Send all slices to model
- **Resource use:** Maximum - linear with slice count

**Option B: Key Slices Only (Balanced)**
- Pre-select 5-10 representative slices
- **Resource use:** 5-10% of full volume

**Option C: Thumbnail Overview (Cheapest)**
- Send single representative image + metadata
- **Resource use:** Minimal, but lower diagnostic value

---

## 3. STORAGE & DATABASE COST DRIVERS

### 3.1 Supabase PostgreSQL

**Table: profiles**
- Rows: 1 per user
- Size: ~1KB per row (subscription data, counters)
- **Growth:** Linear with user count

**Table: analysis_jobs (hypothetical)**
- Rows: 1 per scan/analysis
- Columns: job_id, user_id, modality, results_json, timestamps
- results_json: Can be 10-100KB (structured findings)
- **Growth:** Linear with scans performed

**Table: chat_sessions / oracle_history**
- Rows: 1 per conversation
- Content: Full message history
- **Growth:** Linear with Oracle usage

**Indexes:**
- B-tree indexes on foreign keys
- GIN indexes if searching JSON results
- **Storage:** 20-50% overhead on table size

### 3.2 Supabase Storage (S3)

**Raw uploads:**
- Original DICOM/X-ray files
- Retention: User-defined or 30-90 days typical
- **Size:** Original file size × retention policy

**Processed assets:**
- Heatmap overlays (PNG/JPG)
- Generated PDF reports
- Thumbnails

**Cleanup strategies:**
- Delete raw files after analysis (keep only results)
- Or: Move to cold storage after 7 days

---

## 4. COMPUTE SPECIFICATIONS (What You're Actually Running)

### 4.1 Modal GPU Specifications

Assuming production-grade setup for medical imaging:

**GPU Configuration:**
- **Type:** NVIDIA A10G or A100
- **VRAM:** 24GB (A10G) or 40GB (A100)
- **Container size:** 8-16GB (model weights + dependencies)

**Cold start characteristics:**
- Container boot: 5-15 seconds
- Model load to VRAM: 10-30 seconds
- **Total cold start:** 15-45 seconds (first request after idle)

**Warm request:**
- Processing time: 2-10 seconds depending on image complexity
- VRAM stays allocated
- Idle timeout before shutdown: typically 60-300 seconds

**Concurrency:**
- 1 GPU can handle 1 request at a time (typically)
- **Scaling:** Modal auto-scales to N GPUs for N concurrent requests

### 4.2 Railway Backend Specifications

**Typical production config:**
- **CPU:** 1-2 vCPUs shared
- **RAM:** 2-4GB
- **Disk:** 10-20GB ephemeral
- **Network:** Shared 100Mbps-1Gbps

**Load patterns:**
- CPU spikes during: Image preprocessing, JSON serialization
- RAM spikes during: Large file uploads, batch processing

### 4.3 Vercel Edge/Serverless

**Build:**
- **Duration:** 1-3 minutes per deployment
- **Compute:** 4 vCPU build environment

**Runtime:**
- Edge functions: V8 isolates, sub-millisecond cold start
- Serverless functions: Node runtime, ~100ms cold start

---

## 5. BILLING MODELS BY SERVICE

### 5.1 Modal Billing Model

**GPU billing formula:**
```
Cost = GPU_seconds × GPU_rate
```

**GPU seconds calculation:**
- Wall-clock time from container start to stop
- Includes: Cold start, model loading, inference, idle time before timeout
- Rounded up to the second or millisecond depending on tier

**CPU billing:**
- Usually included with GPU container
- Or separate if using CPU-only containers

**Storage billing:**
- Container registry storage (GB × days)
- Layer caching reduces this after first deploy

**Network:**
- Ingress: Usually free
- Egress: Charged per GB (results returning to your backend)

**Key metric to track:**
- **GPU-hours per month** - the single biggest cost driver

---

### 5.2 Railway Billing Model

**Resource-based pricing:**
```
Cost = CPU_hours × CPU_rate + RAM_GB_hours × RAM_rate + Egress_GB × Network_rate
```

**Components:**
- **CPU:** vCPU hours consumed
- **RAM:** GB allocated × hours (usually reserved, not pay-per-use)
- **Disk:** GB allocated (persistent or ephemeral)
- **Network:** Outbound data transfer

**Deployment model:**
- Always-on container (billed 24/7) OR
- Sleep/scale-to-zero (billed only when active)

---

### 5.3 Vercel Billing Model

**Free tier limits (hobby):**
- Bandwidth: 100GB/month
- Function invocations: 100,000/day
- Build minutes: 6,000/month

**Paid tier (Pro/Business):**
```
Cost = Seat_license + Bandwidth_overages + Function_invocations_overages
```

**Key metrics:**
- GB transferred (static assets + function responses)
- Function execution time (GB-seconds = RAM × duration)
- Build compute minutes

---

### 5.4 Supabase Billing Model

**Database:**
```
Cost = Instance_size + Additional_storage + Egress
```

**Instance sizes:**
- Micro (free tier): ~500MB RAM, shared CPU
- Small: 2GB RAM, 1 vCPU
- Medium: 4GB RAM, 2 vCPU
- Large: 8GB RAM, 4 vCPU
- **Storage included:** Usually 8GB base + $/GB additional

**Auth (GoTrue):**
- MAU (Monthly Active Users) based
- Free tier: 50,000 MAU
- Paid: Per 1000 MAU

**Storage:**
- Storage GB used
- Egress (download bandwidth)
- Operations (GET, PUT, LIST requests per 10k)

---

### 5.5 Razorpay Billing

**Pure transaction-based:**
```
Cost = Transaction_amount × Percentage_fee + Fixed_fee_per_transaction
```

**Webhook costs:**
- Your Railway backend handles webhooks (included in Railway cost)
- No direct Razorpay cost for receiving webhooks

---

## 6. COST CALCULATION FRAMEWORK

### 6.1 Define Your Variables

Before calculating, determine these for your usage pattern:

**User behavior:**
- `U` = Monthly active users
- `S_per_user` = Average scans per user per month
- `M_per_scan` = Average modalities per scan (1.0 for single, 2.5 for typical multi)
- `Oracle_turns` = Average Oracle messages per user after Labs

**Technical specs:**
- `GPU_inference_secs` = Seconds of GPU time per inference
- `Modal_GPU_type` = T4/L4/A10G/A100 (affects rate per second)
- `Modal_idle_timeout` = Seconds before container shuts down (affects reuse)

**Data sizes:**
- `Avg_image_size_MB` = Average upload size
- `Retention_days` = How long you store raw images

### 6.2 GPU Time Calculation Example

For one X-ray workflow:

```
GPU_time_one_scan = 
  Analysis_inference_time + 
  Report_generation_time +
  Cold_start_overhead

Where:
- Analysis_inference_time = 5-10 seconds (Kimi multimodal forward pass)
- Report_generation_time = 3-5 seconds (text generation)
- Cold_start_overhead = 0 if warm, 20-40 seconds if cold

Total = 8-15 seconds (warm) or 28-55 seconds (cold)
```

For multi-modality (3 scans + unify):
```
Total_GPU_calls = 3 × (analysis + report) + 1 unify
Total_GPU_seconds = 
  3 × analysis_time + 
  3 × report_time + 
  1 × unify_time + 
  Cold_start (maybe 1-3 cold starts depending on parallelism)
```

### 6.3 Database Load Calculation

```
Monthly_DB_ops = 
  U × S_per_user × Writes_per_scan +
  U × Oracle_turns × (1 Write + N Reads)

Storage_growth_GB = 
  U × S_per_user × Avg_result_size_KB × (1/1024/1024)
```

### 6.4 Network Egress Calculation

```
Monthly_egress_GB = 
  U × S_per_user × Avg_image_size_MB × (1/1024) +  // Downloads
  U × S_per_user × Result_JSON_size_KB × (1/1024/1024) +  // API responses
  U × Page_views × Assets_per_page × Asset_size_KB  // Web UI
```

---

## 7. FREE TIER REALITY CHECK

### 7.1 Current Free Tier Limits (As of this architecture)

| Service | Free Tier Limit | What it actually means |
|---------|-----------------|------------------------|
| **Vercel** | 100GB bandwidth, 100k function invocations/day | ~10,000 users if each visits once/day |
| **Railway** | $5-10 credit or limited hours | ~500-1000 GPU calls OR continuous small backend |
| **Modal** | $30 credits (typical) | ~5-10 hours of T4 GPU OR ~2-3 hours of A100 |
| **Supabase** | 500MB DB, 1GB storage, 2GB egress | ~1000 users with minimal images |

### 7.2 Where Free Tier Breaks

**Scenario: 500 users, 2 scans each per month**

**Modal GPU:**
- 1000 scans × 10 seconds GPU time = 10,000 GPU-seconds ≈ 2.8 GPU-hours
- T4 rate: ~$0.50/hour → $1.40 (within $30)
- **BUT** if using A100 @ $3/hour → $8.40 (still within $30)
- **CT scans with 100 slices:** 10x multiplier → $84 (exceeds free)

**Supabase Storage:**
- 1000 scans × 5MB average = 5GB
- Exceeds 1GB free tier

**Vercel:**
- 500 users × 30 days × 10 page views = 150,000 page views
- Within 100k/day limit, but approaching it

---

## 8. SCALING TRIGGERS & BOTTLENECKS

### 8.1 First to Hit Limits (Typical Pattern)

**Phase 1: ~100 users**
- Limit hit: **Modal GPU hours** (if heavy CT usage)
- Solution: Request paid Modal plan, optimize slice selection

**Phase 2: ~500 users**
- Limit hit: **Supabase storage** (image accumulation)
- Solution: Implement cleanup policy, move to paid tier

**Phase 3: ~1000 users**
- Limit hit: **Vercel bandwidth** (100GB)
- Solution: Enable Vercel Pro

**Phase 4: ~2000+ users**
- Limit hit: **Railway concurrent connections**
- Solution: Upgrade Railway plan for more resources

### 8.2 Optimization Levers (Cost Reduction)

**Modal GPU optimization:**
- Reduce cold starts: Keep containers warm (increases base cost, reduces per-call overhead)
- Slice selection: Send 10 key slices instead of 100
- Batch processing: Queue multiple requests, process in parallel on fewer GPUs longer

**Storage optimization:**
- Delete raw DICOM after 7 days, keep only results
- Compress images before storage
- Use Supabase Storage → S3 with lifecycle policies

**Database optimization:**
- Archive old chat sessions to cold storage
- Compress JSON results (remove whitespace, use compact format)

**Network optimization:**
- Enable Vercel Edge caching
- Compress API responses (gzip/brotli)

---

## 9. MULTI-TENANT VS DEDICATED COST PATTERNS

### 9.1 Current Architecture (Shared/Multi-tenant)

**Resource sharing:**
- One Modal app serves all users
- One Railway backend handles all requests
- One Supabase project for all data

**Cost characteristics:**
- High utilization = better cost efficiency
- Idle periods = wasted capacity (but serverless mitigates)
- **Cost per user decreases** with scale (economies of serverless)

### 9.2 Enterprise Alternative (Dedicated)

If offering dedicated instances to Pro Plus customers:

**Changes:**
- Separate Modal app per enterprise customer
- Dedicated Railway/Railway teams
- Separate Supabase projects or schemas

**Cost characteristics:**
- Fixed minimum cost per customer (even with zero usage)
- Better isolation, security, performance
- **Cost per user increases** but revenue per user should too

---

## 10. MONITORING & OBSERVABILITY COSTS

**Not included above but needed in production:**

- **Logging:** Vercel/Railway logs, Modal logs (can be verbose for GPU debugging)
- **Monitoring:** Uptime checks, error tracking (Sentry, LogRocket)
- **Analytics:** Usage metrics for your own billing decisions

These usually have their own free/paid tiers separate from your infrastructure.

---

## APPENDIX A: GLOSSARY

- **GPU-hour:** 1 GPU running for 1 hour. Billing unit for GPU time.
- **Cold start:** Time to boot a container and load model. Billable GPU time even before processing.
- **Warm container:** Already running, ready for immediate inference. Faster, but stays billable during idle.
- **VRAM:** GPU memory. Determines max model size + batch size.
- **vCPU:** Virtual CPU core. For non-GPU processing (preprocessing, API logic).
- **Egress:** Data leaving a service (uploads to you are ingress/free, downloads from you are egress/paid).
- **IOPS:** Input/output operations per second. Database performance metric.
- **MAU:** Monthly Active Users. Count of unique users who did at least one action.
- **DICOM:** Medical imaging standard format. Often 10-100x larger than compressed images.

---

## APPENDIX B: YOUR CALCULATOR TEMPLATE

Use this template with your own researched rates:

```
MONTHLY COSTS:

1. MODAL GPU (your biggest variable)
   - Number of scans per month: ___
   - Avg GPU seconds per scan: ___
   - GPU type (T4/L4/A10G/A100): ___
   - Rate per GPU-second: $___
   - Subtotal: ___ × ___ × ___ = $___

2. RAILWAY (your always-on backend)
   - Plan tier: ___
   - CPU/RAM spec: ___
   - Fixed monthly: $___
   - Egress overage: ___ GB × $___ = $___

3. VERCEL (your frontend)
   - Plan: Hobby/Pro/Business
   - Bandwidth: ___ GB × $___ = $___
   - Function invocations: ___ × $___ = $___

4. SUPABASE (your data)
   - DB tier: ___
   - Storage: ___ GB × $___ = $___
   - Egress: ___ GB × $___ = $___
   - MAU: ___ × $___ = $___

5. RAZORPAY (payment processing)
   - Transaction volume: ₹___
   - Percentage fee: ___%
   - Fixed fee: ___
   - Subtotal: ₹___ × ___% + ___ = ₹___

TOTAL (USD): $___
TOTAL (INR @ 95/$): ₹___
```

---

**Document version:** 1.0  
**Last updated:** With current Manthana Labs architecture  
**Purpose:** Self-service cost estimation - plug in rates from each provider's pricing page
