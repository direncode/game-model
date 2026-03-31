FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install Python dependencies
RUN pip install --no-cache-dir \
    runpod \
    numpy \
    scipy \
    pyyaml \
    einops \
    tqdm \
    matplotlib \
    seaborn

# Clone TCD-JEPA directly (submodule not available in RunPod GitHub builds)
RUN git clone --depth 1 https://github.com/direncode/tcd-jepa.git /app/tcd-jepa

# Copy handler
COPY runpod/handler.py /app/handler.py

ENV TCD_JEPA_PATH=/app/tcd-jepa
ENV PYTHONUNBUFFERED=1

CMD ["python", "-u", "/app/handler.py"]
