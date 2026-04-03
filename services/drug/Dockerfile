FROM python:3.10-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DEFAULT_TIMEOUT=300

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY services/drug/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/shared ./services/shared
COPY services/drug/ .

EXPOSE 8109

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8109"]

