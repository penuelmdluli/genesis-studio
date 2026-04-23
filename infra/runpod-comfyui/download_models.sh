#!/bin/bash
# Download Wan 2.2 model weights to the RunPod network volume.
# This script runs once on first boot — subsequent boots find
# the files already present and skip download.
#
# Network volume must be mounted at /runpod-volume.
# Total download: ~28 GB (fp8 quantized weights).

set -e

MODEL_DIR="${COMFY_MODEL_DIR:-/runpod-volume/ComfyUI/models}"
mkdir -p "$MODEL_DIR/diffusion_models" "$MODEL_DIR/vae" "$MODEL_DIR/text_encoders" "$MODEL_DIR/clip"

HF_BASE="https://huggingface.co/Kijai/WanVideo_comfy/resolve/main"

# Wan 2.2 T2V 14B (fp8 — fits A100 80GB / L40S 48GB)
TARGET="$MODEL_DIR/diffusion_models/wan2.2_t2v_14B_fp8_e4m3fn.safetensors"
if [ ! -f "$TARGET" ]; then
  echo "[models] Downloading Wan 2.2 T2V 14B (fp8)..."
  wget -q --show-progress -O "$TARGET" \
    "$HF_BASE/Wan2_2-T2V-14B_fp8_e4m3fn.safetensors"
  echo "[models] Wan 2.2 T2V downloaded: $(du -h "$TARGET" | cut -f1)"
else
  echo "[models] Wan 2.2 T2V already present, skipping"
fi

# VAE
TARGET="$MODEL_DIR/vae/wan_2.1_vae.safetensors"
if [ ! -f "$TARGET" ]; then
  echo "[models] Downloading Wan 2.1 VAE..."
  wget -q --show-progress -O "$TARGET" \
    "$HF_BASE/Wan2_1_VAE_bf16.safetensors"
else
  echo "[models] VAE already present, skipping"
fi

# Text encoder (UMT5-XXL fp8)
TARGET="$MODEL_DIR/text_encoders/umt5_xxl_fp8_e4m3fn.safetensors"
if [ ! -f "$TARGET" ]; then
  echo "[models] Downloading UMT5-XXL text encoder (fp8)..."
  wget -q --show-progress -O "$TARGET" \
    "$HF_BASE/umt5-xxl-enc-fp8_e4m3fn.safetensors"
else
  echo "[models] Text encoder already present, skipping"
fi

# CLIP vision (for future i2v support)
TARGET="$MODEL_DIR/clip/clip_vision_h.safetensors"
if [ ! -f "$TARGET" ]; then
  echo "[models] Downloading CLIP vision..."
  wget -q --show-progress -O "$TARGET" \
    "$HF_BASE/clip_vision_h.safetensors" 2>/dev/null || echo "[models] CLIP vision not available, skipping (t2v-only is fine)"
else
  echo "[models] CLIP vision already present, skipping"
fi

echo "[models] All models ready."
ls -lh "$MODEL_DIR/diffusion_models/" "$MODEL_DIR/vae/" "$MODEL_DIR/text_encoders/" 2>/dev/null
