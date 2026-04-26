-- ComfyUI Async Job Tracking
-- Tracks jobs submitted to RunPod ComfyUI via webhook callback pattern.
-- The webhook handler updates rows on completion/failure.

CREATE TABLE IF NOT EXISTS comfyui_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  production_id UUID,
  scene_id UUID,
  provider TEXT NOT NULL DEFAULT 'runpod-comfyui',
  runpod_job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'completed', 'failed', 'fallback_pending')),
  r2_url TEXT,
  cost_usd DECIMAL(10,4),
  prompt TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS comfyui_jobs_runpod_job_id_idx
  ON comfyui_jobs (runpod_job_id);

CREATE INDEX IF NOT EXISTS comfyui_jobs_user_status_idx
  ON comfyui_jobs (user_id, status);

CREATE INDEX IF NOT EXISTS comfyui_jobs_fallback_idx
  ON comfyui_jobs (status, submitted_at)
  WHERE status = 'failed';

CREATE INDEX IF NOT EXISTS comfyui_jobs_scene_idx
  ON comfyui_jobs (scene_id)
  WHERE scene_id IS NOT NULL;
