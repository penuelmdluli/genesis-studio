FROM python:3.10-slim

# System deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    git ffmpeg libsndfile1 && \
    rm -rf /var/lib/apt/lists/*

# Install PyTorch (CUDA 12.1)
RUN pip install --no-cache-dir \
    torch==2.1.2 torchaudio==2.1.2 --index-url https://download.pytorch.org/whl/cu121

# Install ACE-Step
RUN pip install --no-cache-dir \
    ace-step \
    runpod \
    boto3 \
    soundfile \
    requests

# Pre-download model weights at build time (bakes into image for fast cold starts)
RUN python -c "from ace_step.pipeline import ACEStepPipeline; ACEStepPipeline()"

COPY handler.py /handler.py

CMD ["python", "/handler.py"]
