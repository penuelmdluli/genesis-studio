# Genesis Studio — RunPod ComfyUI Worker with Wan 2.2
# Base: official RunPod ComfyUI worker (includes ComfyUI + handler)
# Adds: Wan 2.2 custom nodes, workflow templates, model download script

FROM runpod/worker-comfyui:5.8.5-base

# Install custom nodes required for Wan 2.2 video generation
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    git clone --depth 1 https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    git clone --depth 1 https://github.com/kijai/ComfyUI-KJNodes.git

# Install Python dependencies for custom nodes
RUN cd /comfyui/custom_nodes/ComfyUI-WanVideoWrapper && \
    pip install --no-cache-dir -r requirements.txt 2>/dev/null || true && \
    cd /comfyui/custom_nodes/ComfyUI-VideoHelperSuite && \
    pip install --no-cache-dir -r requirements.txt 2>/dev/null || true && \
    cd /comfyui/custom_nodes/ComfyUI-KJNodes && \
    pip install --no-cache-dir -r requirements.txt 2>/dev/null || true

# Bake workflow templates into the image
COPY workflows/ /workflows/

# Model download script — runs on first boot, downloads to network volume
COPY download_models.sh /download_models.sh
RUN chmod +x /download_models.sh
