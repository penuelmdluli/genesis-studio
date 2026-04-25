-- Signup Attribution — tracks how users discovered Genesis Studio
-- Used to measure conversion from Explore, campaigns, organic, etc.

CREATE TABLE IF NOT EXISTS signup_attribution (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_video_id UUID,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  signup_referrer TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS signup_attribution_source_idx
  ON signup_attribution (source, created_at DESC);

CREATE INDEX IF NOT EXISTS signup_attribution_video_idx
  ON signup_attribution (source_video_id)
  WHERE source_video_id IS NOT NULL;
