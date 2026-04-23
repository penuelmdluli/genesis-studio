#!/bin/bash
# Downloads Wan 2.2 T2V fp8 weights on first boot.
# Files go to ComfyUI's default model dirs on the container's ephemeral disk.
# Total: ~15GB (fp8 quantized). Takes 2-4 min on RunPod's network.
set -e

MODELS="/comfyui/models"
HF="https://huggingface.co/Kijai/WanVideo_comfy/resolve/main"

# Diffusion model (~8GB)
F="$MODELS/diffusion_models/wan2.2_t2v_14B_fp8_e4m3fn.safetensors"
if [ ! -f "$F" ]; then
  echo "[dl] Wan 2.2 T2V 14B fp8..."
  mkdir -p "$MODELS/diffusion_models"
  wget -q --show-progress -O "$F" "$HF/Wan2_2-T2V-14B_fp8_e4m3fn.safetensors"
fi

# VAE (~200MB)
F="$MODELS/vae/wan_2.1_vae_bf16.safetensors"
if [ ! -f "$F" ]; then
  echo "[dl] VAE..."
  mkdir -p "$MODELS/vae"
  wget -q --show-progress -O "$F" "$HF/Wan2_1_VAE_bf16.safetensors"
fi

# Text encoder UMT5-XXL fp8 (~5GB)
F="$MODELS/text_encoders/umt5_xxl_fp8_e4m3fn.safetensors"
if [ ! -f "$F" ]; then
  echo "[dl] UMT5-XXL fp8..."
  mkdir -p "$MODELS/text_encoders"
  wget -q --show-progress -O "$F" "$HF/umt5-xxl-enc-fp8_e4m3fn.safetensors"
fi

echo "[dl] All models ready."
ls -lh "$MODELS/diffusion_models/" "$MODELS/vae/" "$MODELS/text_encoders/" 2>/dev/null || true
