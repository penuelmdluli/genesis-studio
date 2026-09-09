FROM python:3.10-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libgl1 libglib2.0-0 libsm6 libxrender1 libxext6 wget && \
    rm -rf /var/lib/apt/lists/*

# Install PyTorch (CUDA 12.1)
RUN pip install --no-cache-dir \
    torch==2.1.2 torchvision==0.16.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu121

# Clone SadTalker
RUN git clone --depth 1 https://github.com/OpenTalker/SadTalker.git /sadtalker
WORKDIR /sadtalker

# Install SadTalker deps
RUN pip install --no-cache-dir \
    -r requirements.txt \
    runpod \
    requests \
    gfpgan

# Download model checkpoints (baked into image for fast cold starts)
RUN bash scripts/download_models.sh

COPY handler.py /handler.py

CMD ["python", "/handler.py"]
