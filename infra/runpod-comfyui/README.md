# RunPod ComfyUI Worker — Wan 2.2

Custom RunPod serverless worker running ComfyUI with Wan 2.2 for video generation.

## Build & Deploy

### Prerequisites
- Docker installed
- RunPod account with serverless access
- Docker Hub (or any container registry) account

### 1. Build the image
```bash
docker build -t YOUR_REGISTRY/genesis-comfyui-wan22:latest .
docker push YOUR_REGISTRY/genesis-comfyui-wan22:latest
```

### 2. Create RunPod Network Volume
- Go to https://runpod.io/console/user/storage
- Create volume: name=`genesis-comfyui-models`, size=100GB
- Note the Volume ID

### 3. Create Serverless Endpoint
- Go to https://runpod.io/console/serverless
- New Endpoint:
  - **Image**: `YOUR_REGISTRY/genesis-comfyui-wan22:latest`
  - **GPU**: A100 80GB (recommended) or L40S 48GB
  - **Max Workers**: 2
  - **Idle Timeout**: 10s
  - **FlashBoot**: ENABLED
  - **Network Volume**: attach your volume at `/runpod-volume`
  - **Start Command**: `bash /download_models.sh && bash /start.sh`
- Copy the Endpoint ID

### 4. Configure Genesis Studio
```bash
# .env.local
RUNPOD_COMFYUI_ENDPOINT_ID=<endpoint-id>
COMFYUI_PROVIDER_ENABLED=true
```

## Input Format

The worker accepts standard runpod-worker-comfy input:
```json
{
  "input": {
    "workflow": { ... ComfyUI API-format workflow JSON ... }
  }
}
```

The Genesis adapter (`src/lib/runpod-comfyui.ts`) builds the workflow
with injected prompt/seed/dimensions and sends it.

## Costs
- A100 80GB: ~$1.89/hr → ~$0.04-0.06 per 5s video
- L40S 48GB: ~$1.19/hr → ~$0.03-0.04 per 5s video
