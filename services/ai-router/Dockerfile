FROM python:3.10-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DEFAULT_TIMEOUT=300

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY oracle-2/services/ai-router/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY packages/manthana-inference /tmp/manthana-inference
RUN pip install --no-cache-dir /tmp/manthana-inference

COPY config/cloud_inference.yaml /app/config/cloud_inference.yaml
COPY oracle-2/services/shared ./services/shared
COPY oracle-2/services/ai-router/ .

ENV CLOUD_INFERENCE_CONFIG_PATH=/app/config/cloud_inference.yaml

EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
