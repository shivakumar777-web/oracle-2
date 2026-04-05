# Research Service Dockerfile
# ============================
FROM python:3.11-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc curl \
    && rm -rf /var/lib/apt/lists/*

COPY oracle-2/services/research-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/manthana-inference /tmp/manthana-inference
RUN pip install --no-cache-dir /tmp/manthana-inference

COPY config/cloud_inference.yaml /app/config/cloud_inference.yaml
COPY oracle-2/services/shared/ /app/services/shared/
COPY oracle-2/services/research-service/ .

ENV CLOUD_INFERENCE_CONFIG_PATH=/app/config/cloud_inference.yaml
ENV PYTHONPATH=/app

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/v1/health || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
