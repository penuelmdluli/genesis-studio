FROM runpod/worker-comfyui:5.8.5-base

# Install Wan 2.2 custom nodes
RUN cd /comfyui/custom_nodes && \
    git clone --depth 1 https://github.com/kijai/ComfyUI-WanVideoWrapper.git && \
    git clone --depth 1 https://github.com/Kosinkadink/ComfyUI-VideoHelperSuite.git && \
    git clone --depth 1 https://github.com/kijai/ComfyUI-KJNodes.git

# Install their Python deps
RUN pip install --no-cache-dir \
    -r /comfyui/custom_nodes/ComfyUI-WanVideoWrapper/requirements.txt \
    -r /comfyui/custom_nodes/ComfyUI-VideoHelperSuite/requirements.txt \
    -r /comfyui/custom_nodes/ComfyUI-KJNodes/requirements.txt \
    2>/dev/null || true

# First-boot model download script
COPY download_models.sh /download_models.sh
RUN chmod +x /download_models.sh
