# Web Service Dockerfile
# =======================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY oracle-2/services/web-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/manthana-inference /tmp/manthana-inference
RUN pip install --no-cache-dir /tmp/manthana-inference

COPY config/cloud_inference.yaml /app/config/cloud_inference.yaml

# Copy shared modules
COPY oracle-2/services/shared/ /app/services/shared/

# Copy application code
COPY oracle-2/services/web-service/ .

ENV CLOUD_INFERENCE_CONFIG_PATH=/app/config/cloud_inference.yaml
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8001/v1/health || exit 1

# Run the service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8001"]
