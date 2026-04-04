-- ============================================
-- GENESIS STUDIO — Supabase Database Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- USERS TABLE
-- =====================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'creator', 'pro', 'studio')),
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  credit_balance INTEGER NOT NULL DEFAULT 50,
  monthly_credits_used INTEGER NOT NULL DEFAULT 0,
  monthly_credits_limit INTEGER NOT NULL DEFAULT 50,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- GENERATION JOBS TABLE
-- =====================
CREATE TABLE generation_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  type TEXT NOT NULL CHECK (type IN ('t2v', 'i2v', 'v2v', 'motion')),
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  negative_prompt TEXT,
  input_image_url TEXT,
  input_video_url TEXT,
  resolution TEXT NOT NULL DEFAULT '720p',
  duration INTEGER NOT NULL DEFAULT 5,
  fps INTEGER NOT NULL DEFAULT 24,
  seed INTEGER,
  guidance_scale REAL DEFAULT 7.5,
  num_inference_steps INTEGER DEFAULT 30,
  is_draft BOOLEAN NOT NULL DEFAULT FALSE,
  credits_cost INTEGER NOT NULL,
  output_video_url TEXT,
  thumbnail_url TEXT,
  runpod_job_id TEXT,
  gpu_time REAL,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX idx_jobs_status ON generation_jobs(status);
CREATE INDEX idx_jobs_created_at ON generation_jobs(created_at DESC);
CREATE INDEX idx_jobs_runpod_job_id ON generation_jobs(runpod_job_id);

-- =====================
-- VIDEOS TABLE
-- =====================
CREATE TABLE videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  resolution TEXT NOT NULL,
  duration INTEGER NOT NULL,
  fps INTEGER NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_videos_user_id ON videos(user_id);
CREATE INDEX idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX idx_videos_public ON videos(is_public) WHERE is_public = TRUE;

-- =====================
-- CREDIT TRANSACTIONS TABLE
-- =====================
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('subscription_grant', 'pack_purchase', 'generation_debit', 'generation_refund', 'admin_adjustment')),
  amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  description TEXT NOT NULL,
  job_id UUID REFERENCES generation_jobs(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX idx_transactions_created_at ON credit_transactions(created_at DESC);

-- =====================
-- API KEYS TABLE
-- =====================
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  last_used_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = TRUE;

-- =====================
-- ROW LEVEL SECURITY
-- =====================
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Service role bypasses RLS (used by our API)
-- Users can only read their own data
CREATE POLICY "Users can view own profile" ON users
  FOR SELECT USING (auth.uid()::text = clerk_id);

CREATE POLICY "Users can view own jobs" ON generation_jobs
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can view own videos" ON videos
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Public videos are viewable" ON videos
  FOR SELECT USING (is_public = TRUE);

CREATE POLICY "Users can view own transactions" ON credit_transactions
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can view own API keys" ON api_keys
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

-- =====================
-- USEFUL VIEWS
-- =====================
CREATE OR REPLACE VIEW user_stats AS
SELECT
  u.id,
  u.email,
  u.plan,
  u.credit_balance,
  COUNT(DISTINCT j.id) FILTER (WHERE j.status = 'completed') as total_generations,
  COUNT(DISTINCT v.id) as total_videos,
  COALESCE(SUM(j.gpu_time) FILTER (WHERE j.status = 'completed'), 0) as total_gpu_seconds,
  u.created_at
FROM users u
LEFT JOIN generation_jobs j ON j.user_id = u.id
LEFT JOIN videos v ON v.user_id = u.id
GROUP BY u.id;

-- =====================
-- PRODUCTIONS TABLE (Genesis Brain)
-- =====================
CREATE TABLE productions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'planned', 'generating', 'assembling', 'completed', 'failed', 'cancelled')),
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  target_duration INTEGER NOT NULL DEFAULT 30,
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape' CHECK (aspect_ratio IN ('landscape', 'portrait', 'square')),
  plan JSONB,
  voiceover BOOLEAN NOT NULL DEFAULT FALSE,
  music BOOLEAN NOT NULL DEFAULT FALSE,
  captions BOOLEAN NOT NULL DEFAULT FALSE,
  total_credits INTEGER NOT NULL DEFAULT 0,
  output_video_urls TEXT, -- JSON string: { landscape: url, ... }
  thumbnail_url TEXT,
  gif_preview_url TEXT,
  voiceover_url TEXT,
  music_url TEXT,
  captions_url TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX idx_productions_user_id ON productions(user_id);
CREATE INDEX idx_productions_status ON productions(status);
CREATE INDEX idx_productions_created_at ON productions(created_at DESC);

CREATE TRIGGER productions_updated_at
  BEFORE UPDATE ON productions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =====================
-- PRODUCTION SCENES TABLE (Genesis Brain)
-- =====================
CREATE TABLE production_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5,
  resolution TEXT NOT NULL DEFAULT '720p',
  output_video_url TEXT,
  runpod_job_id TEXT,
  gpu_time REAL,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_scenes_production_id ON production_scenes(production_id);
CREATE INDEX idx_production_scenes_status ON production_scenes(status);
CREATE INDEX idx_production_scenes_runpod_job_id ON production_scenes(runpod_job_id);

-- =====================
-- PRODUCTION TEMPLATES TABLE (Genesis Brain)
-- =====================
CREATE TABLE production_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape',
  target_duration INTEGER NOT NULL DEFAULT 30,
  voiceover BOOLEAN NOT NULL DEFAULT FALSE,
  music BOOLEAN NOT NULL DEFAULT FALSE,
  captions BOOLEAN NOT NULL DEFAULT FALSE,
  scene_structure JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_production_templates_user_id ON production_templates(user_id);
CREATE INDEX idx_production_templates_public ON production_templates(is_public) WHERE is_public = TRUE;

-- RLS for Brain tables
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own productions" ON productions
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can view own production scenes" ON production_scenes
  FOR SELECT USING (production_id IN (SELECT id FROM productions WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)));

CREATE POLICY "Users can view own templates" ON production_templates
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Public templates are viewable" ON production_templates
  FOR SELECT USING (is_public = TRUE);

-- =====================
-- REFERRAL SYSTEM
-- =====================
CREATE TABLE referral_codes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  referral_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_referral_codes_user ON referral_codes(user_id);
CREATE UNIQUE INDEX idx_referral_codes_code ON referral_codes(code);

CREATE TABLE referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_email TEXT NOT NULL,
  referral_code_id UUID NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX idx_referrals_referrer ON referrals(referrer_user_id);

ALTER TABLE referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own referral codes" ON referral_codes
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can view own referrals" ON referrals
  FOR SELECT USING (referrer_user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));
