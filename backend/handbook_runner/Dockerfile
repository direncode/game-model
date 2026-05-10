# Handbook runner — sandboxed OCEAN-snippet executor for docs.latentocean.com.
#
# Builds from the repo root (set context: . in docker-compose.prod.yml) so
# this Dockerfile can COPY both `scripts/` (compiler + stdlib) and
# `backend/handbook_runner/` (FastAPI app, corpora, sandbox helpers).
FROM python:3.11-slim

WORKDIR /app

# System deps. build-essential is needed by some scientific wheels; curl is
# kept for healthcheck convenience even though we don't currently wire one.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# ─── Python deps (cached layer) ────────────────────────────────────
# Install the runner-specific dependencies first so the layer survives
# code-only changes.
COPY backend/handbook_runner/requirements.txt /tmp/handbook-runner-requirements.txt
RUN pip install --no-cache-dir -r /tmp/handbook-runner-requirements.txt

# The compiler imports numpy/sklearn for the free embedders; the sandboxed
# user code can call into them too. Keep this list minimal — premium
# operators (transformer, BTUT, TCD) are blocked before execution by the
# premium-gate, so we don't need transformers in this image.
RUN pip install --no-cache-dir \
    numpy>=1.26 \
    scipy \
    scikit-learn

# torch (CPU-only) is needed because scripts.run_universal_pipeline does
# `import torch` at module level for MKL/OpenMP ordering reasons. We
# install the CPU wheel (~250 MB) rather than the GPU variant to keep
# the image small. Premium operators still get blocked at compile time.
RUN pip install --no-cache-dir torch==2.4.* \
    --index-url https://download.pytorch.org/whl/cpu

ENV PYTHONUNBUFFERED=1
ENV KMP_DUPLICATE_LIB_OK=TRUE
ENV PYTHONPATH=/app

# ─── Application code ─────────────────────────────────────────────
# Compiler + stdlib live under scripts/.
COPY scripts /app/scripts
# Runner package (server, sandbox, premium gate, corpora).
COPY backend/handbook_runner /app/backend/handbook_runner

# Make `backend` importable as a package. The handbook_runner __init__ is
# present but the parent `backend/` directory lacks one; an empty file is
# enough.
RUN python -c "from pathlib import Path; Path('/app/backend/__init__.py').touch()"

# Smoke-import the OCEAN compiler at build time so a missing module or a
# syntax error in the compiler fails the image build rather than the first
# request.
RUN python -c "from scripts.operators.ocean.parser import parse_ocean; \
    from scripts.operators.ocean.typecheck import typecheck; \
    from backend.handbook_runner.premium_gate import OPERATOR_REGISTRY; \
    from backend.handbook_runner.asgi import app; \
    assert len(OPERATOR_REGISTRY) >= 11, 'expected >=11 operators'"

# Drop root. The sandbox subprocess inherits this uid, which gives a
# defence-in-depth layer on top of rlimits.
RUN useradd --create-home --uid 10001 runner \
    && chown -R runner:runner /app
USER runner

EXPOSE 8080

# Single worker — the rate limiter is sized for one process. Scale by
# adding compose replicas behind nginx if needed.
CMD ["uvicorn", "backend.handbook_runner.asgi:app", \
     "--host", "0.0.0.0", \
     "--port", "8080", \
     "--workers", "1", \
     "--access-log"]
