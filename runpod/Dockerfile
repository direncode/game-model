FROM runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04

WORKDIR /app

# Python deps. torch is in the base image; everything else is added on top.
# BTUT (backend/app/services/btut/) only needs numpy + stdlib (verified by
# grep over the package). TCD-JEPA train_graph.py only needs torch + numpy.
RUN pip install --no-cache-dir \
    runpod \
    numpy \
    scipy \
    pyyaml \
    einops \
    tqdm \
    matplotlib \
    seaborn

# ─── Code ────────────────────────────────────────────────────────────
# Build context MUST be the repo root (configure in RunPod project:
# Dockerfile path = runpod/Dockerfile, build context = repo root).
#
# Why local COPY instead of git clone:
#   - The previous Dockerfile cloned https://github.com/direncode/tcd-jepa
#     but that public mirror does not contain train_graph.py, so the
#     handler's `from train_graph import train` failed silently and
#     fell through to _simulate_training. Local tcd-jepa has it.
#   - backend/ was never in the image at all, so BTUT pre-reduction
#     also failed silently in the handler.
COPY tcd-jepa /app/tcd-jepa
COPY backend  /app/backend
COPY runpod/handler.py /app/handler.py

ENV TCD_JEPA_PATH=/app/tcd-jepa
ENV BACKEND_PATH=/app/backend
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "/app/handler.py"]
