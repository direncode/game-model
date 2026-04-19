# Self-contained lo_core image. No GPU, no external APIs, no network required
# at runtime. Use for enterprise demos + CI.

FROM python:3.11-slim AS base

WORKDIR /app
COPY . /app/lo_core

# Install the package + default stdlib-only core
RUN pip install --no-cache-dir -e /app/lo_core

# Legend library gets mounted at /data at runtime (not baked in)
ENTRYPOINT ["lo"]
CMD ["version"]
