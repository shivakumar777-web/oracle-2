# Oracle Service Dockerfile
# ===========================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY oracle-2/services/oracle-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/manthana-inference /tmp/manthana-inference
RUN pip install --no-cache-dir /tmp/manthana-inference

COPY config/cloud_inference.yaml /app/config/cloud_inference.yaml

# Copy shared modules
COPY oracle-2/services/shared/ /app/services/shared/

# Copy ai-router intelligence modules (Phase A: Oracle fix plan)
# All 7 modules must be in same dir for cross-imports (query_intelligence, source_router, etc.)
COPY oracle-2/services/ai-router/domain_intelligence.py /app/lib/
COPY oracle-2/services/ai-router/query_intelligence.py /app/lib/
COPY oracle-2/services/ai-router/source_router.py /app/lib/
COPY oracle-2/services/ai-router/reranker.py /app/lib/
COPY oracle-2/services/ai-router/pubmed_client.py /app/lib/
COPY oracle-2/services/ai-router/clinical_trials.py /app/lib/
COPY oracle-2/services/ai-router/m5_engine.py /app/lib/

# Copy application code
COPY oracle-2/services/oracle-service/ .

ENV CLOUD_INFERENCE_CONFIG_PATH=/app/config/cloud_inference.yaml

# Set Python path for shared imports and lib (ai-router modules)
ENV PYTHONPATH=/app:/app/lib

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/v1/health || exit 1

# Run the service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
