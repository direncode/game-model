FROM python:3.11-slim

WORKDIR /app

# System deps for numpy/scipy/torch wheels + git for any vcs deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python deps. Pin versions for deterministic builds.
# torch is heavy (~800MB) — only needed for cluster.tcd_recursive_loop and
# embed.transformer; kept in image so the workbench's "Run" works for
# premium operators.
RUN pip install --no-cache-dir \
    fastapi==0.115.* \
    uvicorn[standard]==0.32.* \
    pydantic==2.* \
    numpy>=1.26 \
    scipy \
    pandas \
    scikit-learn \
    redis \
    tokenizers>=0.20 \
    safetensors>=0.4 \
    huggingface_hub>=0.24 \
    && pip install --no-cache-dir torch==2.4.* --index-url https://download.pytorch.org/whl/cpu

# Pre-cache the MiniLM-L6 weights (~90 MB) so the first embed.transformer
# call doesn't pay the download cost. Built into the image at build time.
ENV HF_HOME=/app/.cache/huggingface
RUN python -c "from huggingface_hub import snapshot_download; \
    snapshot_download('sentence-transformers/all-MiniLM-L6-v2', \
        allow_patterns=['config.json', 'tokenizer.json', 'model.safetensors'], \
        cache_dir='/app/.cache/huggingface/hub')"

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
