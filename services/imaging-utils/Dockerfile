FROM python:3.10-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_DEFAULT_TIMEOUT=300

RUN apt-get update && apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libsm6 \
    libxrender1 \
    libxext6 \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY services/imaging-utils/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY services/shared ./services/shared
COPY services/imaging-utils/ .

EXPOSE 8111

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8111"]

