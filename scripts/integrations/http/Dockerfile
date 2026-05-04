FROM python:3.11-slim

WORKDIR /app

# System deps for numpy/scipy/torch wheels + git for any vcs deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps. Pin versions for deterministic builds.
# torch is heavy (~800MB) — only needed for cluster.tcd_recursive_loop;
# kept in image so the workbench's "Run" works for premium operators.
RUN pip install --no-cache-dir \
    fastapi==0.115.* \
    uvicorn[standard]==0.32.* \
    pydantic==2.* \
    numpy>=1.26 \
    scipy \
    pandas \
    scikit-learn \
    redis \
    && pip install --no-cache-dir torch==2.4.* --index-url https://download.pytorch.org/whl/cpu

# Pre-load env workaround for sklearn/torch MKL DLL clash on Windows hosts
# (no-op on Linux; harmless).
ENV KMP_DUPLICATE_LIB_OK=TRUE
ENV PYTHONUNBUFFERED=1

# Copy everything the runtime needs.
# Build context is repo root (set in docker-compose.prod.yml).
COPY scripts /app/scripts
COPY tcd-jepa /app/tcd-jepa

# Make scripts/ importable as a package
ENV PYTHONPATH=/app

EXPOSE 8000

# Single uvicorn process for v1; scale by adding more replicas in compose.
CMD ["uvicorn", "scripts.integrations.http.ocean_api:app", \
     "--host", "0.0.0.0", \
     "--port", "8000", \
     "--workers", "1", \
     "--access-log"]
