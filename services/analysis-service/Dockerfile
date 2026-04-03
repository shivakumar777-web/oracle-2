# Analysis Service Dockerfile
# =============================
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY services/analysis-service/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy shared modules
COPY services/shared/ /app/services/shared/

# Copy application code
COPY services/analysis-service/ .

# Set Python path for shared imports
ENV PYTHONPATH=/app

# Expose port
EXPOSE 8003

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8003/v1/health || exit 1

# Run the service
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8003"]
