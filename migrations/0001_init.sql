-- ============================================
-- GENESIS STUDIO — D1 (SQLite) Schema
-- Converted from PostgreSQL / Supabase
-- ============================================

-- =====================
-- USERS
-- =====================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
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
  password_hash TEXT,
  auth_provider TEXT DEFAULT 'email' CHECK (auth_provider IN ('email', 'google', 'clerk_legacy')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- =====================
-- SESSIONS (custom auth)
-- =====================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);

-- =====================
-- GENERATION JOBS
-- =====================
CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
  is_draft INTEGER NOT NULL DEFAULT 0,
  credits_cost INTEGER NOT NULL,
  output_video_url TEXT,
  thumbnail_url TEXT,
  runpod_job_id TEXT,
  gpu_time REAL,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  aspect_ratio TEXT DEFAULT 'landscape',
  audio_track_id TEXT,
  audio_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON generation_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON generation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON generation_jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_runpod_job_id ON generation_jobs(runpod_job_id);

-- =====================
-- VIDEOS
-- =====================
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  job_id TEXT REFERENCES generation_jobs(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  model_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  resolution TEXT NOT NULL,
  duration INTEGER NOT NULL,
  fps INTEGER NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  aspect_ratio TEXT DEFAULT 'landscape',
  audio_url TEXT,
  audio_track_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_public ON videos(is_public) WHERE is_public = 1;

-- =====================
-- CREDIT TRANSACTIONS
-- =====================
CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('subscription_grant', 'pack_purchase', 'generation_debit', 'generation_refund', 'admin_adjustment')),
  amount INTEGER NOT NULL,
  balance INTEGER NOT NULL,
  description TEXT NOT NULL,
  job_id TEXT REFERENCES generation_jobs(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON credit_transactions(created_at DESC);

-- =====================
-- API KEYS
-- =====================
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  key_hash TEXT UNIQUE NOT NULL,
  last_used_at TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash) WHERE is_active = 1;

-- =====================
-- PRODUCTIONS (Genesis Brain)
-- =====================
CREATE TABLE IF NOT EXISTS productions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'planned', 'generating', 'assembling', 'completed', 'failed', 'cancelled')),
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  target_duration INTEGER NOT NULL DEFAULT 30,
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape' CHECK (aspect_ratio IN ('landscape', 'portrait', 'square')),
  plan TEXT,
  voiceover INTEGER NOT NULL DEFAULT 0,
  music INTEGER NOT NULL DEFAULT 0,
  captions INTEGER NOT NULL DEFAULT 0,
  total_credits INTEGER NOT NULL DEFAULT 0,
  output_video_urls TEXT,
  thumbnail_url TEXT,
  gif_preview_url TEXT,
  voiceover_url TEXT,
  music_url TEXT,
  captions_url TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  assembly_state TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_productions_user_id ON productions(user_id);
CREATE INDEX IF NOT EXISTS idx_productions_status ON productions(status);
CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at DESC);

-- =====================
-- PRODUCTION SCENES
-- =====================
CREATE TABLE IF NOT EXISTS production_scenes (
  id TEXT PRIMARY KEY,
  production_id TEXT NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
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
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_scenes_production_id ON production_scenes(production_id);
CREATE INDEX IF NOT EXISTS idx_scenes_status ON production_scenes(status);
CREATE INDEX IF NOT EXISTS idx_scenes_runpod_job_id ON production_scenes(runpod_job_id);

-- =====================
-- PRODUCTION TEMPLATES
-- =====================
CREATE TABLE IF NOT EXISTS production_templates (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape',
  target_duration INTEGER NOT NULL DEFAULT 30,
  voiceover INTEGER NOT NULL DEFAULT 0,
  music INTEGER NOT NULL DEFAULT 0,
  captions INTEGER NOT NULL DEFAULT 0,
  scene_structure TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_templates_user_id ON production_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_templates_public ON production_templates(is_public) WHERE is_public = 1;

-- =====================
-- EXPLORE SYSTEM
-- =====================
CREATE TABLE IF NOT EXISTS explore_videos (
  id TEXT PRIMARY KEY,
  source_video_id TEXT,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution TEXT,
  has_audio INTEGER DEFAULT 0,
  type TEXT DEFAULT 'standard',
  is_free_tier INTEGER DEFAULT 1,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  recreates INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  is_published INTEGER DEFAULT 1,
  is_featured INTEGER DEFAULT 0,
  is_flagged INTEGER DEFAULT 0,
  creator_name TEXT,
  creator_avatar_url TEXT,
  tags TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_explore_trending ON explore_videos(likes DESC, views DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explore_latest ON explore_videos(created_at DESC) WHERE is_published = 1 AND is_flagged = 0;
CREATE INDEX IF NOT EXISTS idx_explore_type ON explore_videos(type, created_at DESC) WHERE is_published = 1;
CREATE INDEX IF NOT EXISTS idx_explore_audio ON explore_videos(has_audio, likes DESC) WHERE has_audio = 1 AND is_published = 1;
CREATE INDEX IF NOT EXISTS idx_explore_featured ON explore_videos(is_featured, created_at DESC) WHERE is_featured = 1;
CREATE INDEX IF NOT EXISTS idx_explore_user ON explore_videos(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS explore_likes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES explore_videos(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_explore_likes_user ON explore_likes(user_id, video_id);

CREATE TABLE IF NOT EXISTS share_events (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES explore_videos(id) ON DELETE CASCADE,
  sharer_user_id TEXT,
  platform TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_share_events_video ON share_events(video_id, created_at DESC);

CREATE TABLE IF NOT EXISTS referral_signups (
  id TEXT PRIMARY KEY,
  new_user_id TEXT NOT NULL,
  referred_from_video_id TEXT REFERENCES explore_videos(id),
  referred_from_platform TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_referral_video ON referral_signups(referred_from_video_id);

-- =====================
-- WEBHOOK EVENTS (idempotency)
-- =====================
CREATE TABLE IF NOT EXISTS webhook_events (
  id TEXT PRIMARY KEY,
  reference TEXT NOT NULL,
  provider TEXT NOT NULL,
  event TEXT,
  user_id TEXT,
  metadata TEXT DEFAULT '{}',
  processed_at TEXT DEFAULT (datetime('now')),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_ref_provider ON webhook_events(reference, provider);

-- =====================
-- REFERRAL SYSTEM
-- =====================
CREATE TABLE IF NOT EXISTS referral_codes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code TEXT UNIQUE NOT NULL,
  credits_earned INTEGER NOT NULL DEFAULT 0,
  referral_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referral_codes_user ON referral_codes(user_id);

CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  referred_user_email TEXT NOT NULL,
  referral_code_id TEXT NOT NULL REFERENCES referral_codes(id) ON DELETE CASCADE,
  credits_granted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_referred ON referrals(referred_user_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id);

-- =====================
-- SIGNUP ATTRIBUTION
-- =====================
CREATE TABLE IF NOT EXISTS signup_attribution (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  source_video_id TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  landing_path TEXT,
  signup_referrer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_attribution_source ON signup_attribution(source, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_video ON signup_attribution(source_video_id) WHERE source_video_id IS NOT NULL;

-- =====================
-- COMFYUI ASYNC JOBS
-- =====================
CREATE TABLE IF NOT EXISTS comfyui_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  production_id TEXT,
  scene_id TEXT,
  provider TEXT NOT NULL DEFAULT 'runpod-comfyui',
  runpod_job_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'fallback_pending')),
  r2_url TEXT,
  cost_usd REAL,
  prompt TEXT,
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_comfyui_runpod ON comfyui_jobs(runpod_job_id);
CREATE INDEX IF NOT EXISTS idx_comfyui_user_status ON comfyui_jobs(user_id, status);
CREATE INDEX IF NOT EXISTS idx_comfyui_fallback ON comfyui_jobs(status, submitted_at) WHERE status = 'failed';
CREATE INDEX IF NOT EXISTS idx_comfyui_scene ON comfyui_jobs(scene_id) WHERE scene_id IS NOT NULL;

-- =====================
-- MBS AUTOMATION
-- =====================
CREATE TABLE IF NOT EXISTS mbs_characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  portrait_url TEXT NOT NULL,
  description TEXT,
  brand_traits TEXT,
  active INTEGER DEFAULT 1,
  brand_colors TEXT,
  best_for_styles TEXT,
  total_posts INTEGER DEFAULT 0,
  total_engagement INTEGER DEFAULT 0,
  avg_engagement_per_post REAL,
  best_performing_style TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mbs_jobs (
  id TEXT PRIMARY KEY,
  reference_video_url TEXT NOT NULL,
  reference_video_duration_sec INTEGER,
  character_id TEXT REFERENCES mbs_characters(id),
  prompt TEXT NOT NULL,
  setting TEXT,
  duration_sec INTEGER DEFAULT 10,
  aspect_ratio TEXT DEFAULT '9:16',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'submitted', 'completed', 'quality_check',
    'quality_approved', 'quality_review', 'scheduled', 'posted', 'failed', 'cancelled'
  )),
  fal_request_id TEXT,
  finished_video_url TEXT,
  facebook_post_id TEXT,
  facebook_post_url TEXT,
  cost_usd REAL,
  caption TEXT,
  scheduled_post_at TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  candidate_id TEXT,
  quality_score REAL,
  quality_notes TEXT,
  scheduled_for TEXT,
  cfg_scale REAL DEFAULT 0.5,
  created_at TEXT DEFAULT (datetime('now')),
  submitted_at TEXT,
  completed_at TEXT,
  posted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mbs_jobs_status ON mbs_jobs(status);
CREATE INDEX IF NOT EXISTS idx_mbs_jobs_scheduled ON mbs_jobs(scheduled_post_at) WHERE status = 'completed';
CREATE INDEX IF NOT EXISTS idx_mbs_jobs_scheduled_for ON mbs_jobs(scheduled_for) WHERE status = 'scheduled';

CREATE TABLE IF NOT EXISTS mbs_engagement (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES mbs_jobs(id),
  facebook_post_id TEXT NOT NULL,
  views INTEGER,
  reactions INTEGER,
  comments INTEGER,
  shares INTEGER,
  hours_since_post INTEGER,
  fetched_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mbs_source_creators (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube')),
  profile_url TEXT NOT NULL,
  display_name TEXT,
  content_style TEXT,
  partnership_status TEXT DEFAULT 'cold' CHECK (partnership_status IN ('cold', 'contacted', 'partnered', 'declined')),
  attribution_required INTEGER DEFAULT 1,
  active INTEGER DEFAULT 1,
  last_checked_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(handle, platform)
);

CREATE TABLE IF NOT EXISTS mbs_watched_tags (
  id TEXT PRIMARY KEY,
  tag TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  active INTEGER DEFAULT 1,
  min_view_count INTEGER DEFAULT 10000,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mbs_candidates (
  id TEXT PRIMARY KEY,
  source_creator_id TEXT REFERENCES mbs_source_creators(id),
  source_tag_id TEXT REFERENCES mbs_watched_tags(id),
  source_url TEXT NOT NULL UNIQUE,
  source_post_id TEXT,
  duration_sec INTEGER,
  view_count INTEGER,
  posted_at TEXT,
  thumbnail_url TEXT,
  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'downloaded', 'vetting', 'approved', 'review',
    'rejected', 'processed', 'posted', 'failed'
  )),
  vision_score REAL,
  audio_score REAL,
  overall_score REAL,
  safety_notes TEXT,
  suggested_character_id TEXT,
  suggested_setting TEXT,
  suggested_caption TEXT,
  suggested_dance_style TEXT,
  reference_video_r2_url TEXT,
  rejected_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  discovered_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON mbs_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON mbs_candidates(overall_score) WHERE status = 'approved';

CREATE TABLE IF NOT EXISTS mbs_posting_schedule (
  id TEXT PRIMARY KEY,
  job_id TEXT REFERENCES mbs_jobs(id),
  page_id TEXT NOT NULL,
  slot_start TEXT NOT NULL,
  slot_end TEXT NOT NULL,
  posted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS mbs_config (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL UNIQUE,
  max_posts_per_day INTEGER DEFAULT 5,
  optimal_slots TEXT,
  min_minutes_between_posts INTEGER DEFAULT 90,
  active INTEGER DEFAULT 1
);

-- =====================
-- MIMIC STUDIO
-- =====================
CREATE TABLE IF NOT EXISTS mimic_jobs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  character_image_url TEXT NOT NULL,
  reference_video_url TEXT,
  reference_source_url TEXT,
  prompt TEXT,
  duration_sec INTEGER DEFAULT 10,
  aspect_ratio TEXT DEFAULT '9:16',
  keep_video_sound INTEGER DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'scraping', 'submitted', 'processing', 'completed', 'failed'
  )),
  fal_request_id TEXT,
  output_video_url TEXT,
  gallery_video_id TEXT,
  credits_charged INTEGER DEFAULT 1500,
  cost_usd REAL,
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_mimic_jobs_user ON mimic_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_mimic_jobs_status ON mimic_jobs(status);

-- =====================
-- DEV CONTENT PIPELINE
-- =====================
CREATE TABLE IF NOT EXISTS dev_trending_topics (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT,
  viral_potential INTEGER DEFAULT 0,
  content_angle TEXT,
  suggested_hook TEXT,
  region TEXT,
  source TEXT,
  sources_count INTEGER DEFAULT 1,
  page_target TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'queued', 'generated', 'posted')),
  created_at TEXT DEFAULT (datetime('now')),
  used_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_trending_status ON dev_trending_topics(status, viral_potential DESC);
CREATE INDEX IF NOT EXISTS idx_trending_created ON dev_trending_topics(created_at DESC);

CREATE TABLE IF NOT EXISTS dev_content_queue (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  pillar TEXT NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'generating', 'ready', 'posted', 'failed')),
  engine TEXT,
  input_data TEXT,
  video_url TEXT,
  caption TEXT,
  hashtags TEXT,
  scheduled_time TEXT,
  generated_at TEXT,
  posted_at TEXT,
  cost_usd REAL,
  viral_score INTEGER DEFAULT 0,
  news_topic_id TEXT REFERENCES dev_trending_topics(id),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_queue_status ON dev_content_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_page ON dev_content_queue(page_id, status);
CREATE INDEX IF NOT EXISTS idx_queue_scheduled ON dev_content_queue(scheduled_time);

CREATE TABLE IF NOT EXISTS dev_generation_costs (
  id TEXT PRIMARY KEY,
  engine TEXT NOT NULL,
  pillar TEXT,
  page_id TEXT,
  estimated_cost_usd REAL,
  actual_cost_usd REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================
-- STUDIO CONTENT ENGINE
-- =====================
CREATE TABLE IF NOT EXISTS studio_pages (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  page_id TEXT NOT NULL,
  page_name TEXT NOT NULL,
  page_access_token TEXT NOT NULL,
  niche TEXT NOT NULL CHECK (niche IN ('news', 'finance', 'motivation', 'entertainment')),
  is_active INTEGER DEFAULT 1,
  follower_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_trends (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  niche TEXT NOT NULL,
  topic TEXT NOT NULL,
  headline TEXT NOT NULL,
  score INTEGER DEFAULT 0,
  source TEXT,
  used INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_videos (
  id TEXT PRIMARY KEY,
  trend_id TEXT REFERENCES studio_trends(id),
  page_id TEXT REFERENCES studio_pages(id),
  niche TEXT NOT NULL,
  script TEXT NOT NULL,
  raw_video_url TEXT,
  branded_video_url TEXT,
  watermark_applied INTEGER DEFAULT 0,
  caption TEXT,
  production_id TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'scripted', 'generating', 'branding', 'ready', 'posted', 'failed')),
  error_message TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS studio_posts (
  id TEXT PRIMARY KEY,
  video_id TEXT REFERENCES studio_videos(id),
  page_id TEXT REFERENCES studio_pages(id),
  facebook_post_id TEXT,
  scheduled_at TEXT,
  posted_at TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'posted', 'failed')),
  views INTEGER DEFAULT 0,
  reactions INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  performance_score REAL DEFAULT 0,
  pinned_comment_posted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

-- =====================
-- INTELLIGENCE / LEARNING
-- =====================
CREATE TABLE IF NOT EXISTS post_performance (
  id TEXT PRIMARY KEY,
  production_id TEXT,
  queue_item_id TEXT,
  page_id TEXT NOT NULL,
  platform TEXT DEFAULT 'facebook',
  fb_post_id TEXT,
  fb_video_id TEXT,
  topic TEXT,
  topic_category TEXT,
  headline TEXT,
  script_excerpt TEXT,
  hook_text TEXT,
  language_code TEXT DEFAULT 'en',
  country_code TEXT DEFAULT 'ZA',
  music_style TEXT,
  video_duration_seconds INTEGER,
  scene_count INTEGER,
  voice_style TEXT,
  pillar TEXT,
  engine TEXT,
  posted_at TEXT,
  day_of_week INTEGER,
  hour_of_day INTEGER,
  views INTEGER DEFAULT 0,
  unique_viewers INTEGER DEFAULT 0,
  watch_time_seconds INTEGER DEFAULT 0,
  avg_watch_time_seconds REAL DEFAULT 0,
  completion_rate REAL DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  reach INTEGER DEFAULT 0,
  impressions INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0,
  click_through_rate REAL DEFAULT 0,
  negative_feedback INTEGER DEFAULT 0,
  viral_score REAL DEFAULT 0,
  performance_tier TEXT,
  performance_score REAL DEFAULT 0,
  is_best_performer INTEGER DEFAULT 0,
  is_worst_performer INTEGER DEFAULT 0,
  last_fetched_at TEXT,
  fetch_count INTEGER DEFAULT 0,
  metrics_locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_perf_page ON post_performance(page_id, posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_perf_category ON post_performance(topic_category, performance_score DESC);
CREATE INDEX IF NOT EXISTS idx_perf_fb ON post_performance(fb_post_id);
CREATE INDEX IF NOT EXISTS idx_perf_unlocked ON post_performance(metrics_locked, last_fetched_at) WHERE metrics_locked = 0;

CREATE TABLE IF NOT EXISTS content_intelligence (
  id TEXT PRIMARY KEY,
  page_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  insight_key TEXT,
  insight_value TEXT,
  confidence_score REAL DEFAULT 0,
  sample_size INTEGER DEFAULT 0,
  avg_performance_score REAL DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  avg_engagement_rate REAL DEFAULT 0,
  top_example_post_id TEXT,
  is_active INTEGER DEFAULT 1,
  generated_at TEXT DEFAULT (datetime('now')),
  expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_intel_page ON content_intelligence(page_id, insight_type);
CREATE INDEX IF NOT EXISTS idx_intel_active ON content_intelligence(page_id, is_active) WHERE is_active = 1;

CREATE TABLE IF NOT EXISTS ai_decisions (
  id TEXT PRIMARY KEY,
  page_id TEXT,
  decision_type TEXT,
  before_value TEXT,
  after_value TEXT,
  reason TEXT,
  based_on_insight_id TEXT,
  confidence_score REAL DEFAULT 0,
  outcome_score REAL,
  was_correct INTEGER,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_decisions_page ON ai_decisions(page_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_decisions_pending ON ai_decisions(outcome_score, created_at) WHERE outcome_score IS NULL;

CREATE TABLE IF NOT EXISTS viral_formulas (
  id TEXT PRIMARY KEY,
  page_id TEXT,
  formula_name TEXT,
  topic_category TEXT,
  hook_pattern TEXT,
  optimal_duration INTEGER,
  optimal_hour INTEGER,
  optimal_day INTEGER,
  music_style TEXT,
  language_code TEXT,
  avg_viral_score REAL DEFAULT 0,
  avg_views INTEGER DEFAULT 0,
  usage_count INTEGER DEFAULT 0,
  success_rate REAL DEFAULT 0,
  last_used_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_formulas_page ON viral_formulas(page_id, avg_viral_score DESC);

CREATE TABLE IF NOT EXISTS feedback_system_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT,
  page_id TEXT,
  details TEXT,
  error TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_feedback_type ON feedback_system_logs(event_type, created_at DESC);

-- =====================
-- COLLECTIONS
-- =====================
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_videos (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  added_at TEXT DEFAULT (datetime('now')),
  UNIQUE(collection_id, video_id)
);

-- =====================
-- SUPPORT TICKETS
-- =====================
CREATE TABLE IF NOT EXISTS support_tickets (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  email TEXT,
  name TEXT,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'open' CHECK (status IN ('open', 'replied', 'closed')),
  reply TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  replied_at TEXT
);

-- =====================
-- EXPLORE FAVORITES
-- =====================
CREATE TABLE IF NOT EXISTS explore_favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  video_id TEXT NOT NULL REFERENCES explore_videos(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT (datetime('now')),
  UNIQUE(user_id, video_id)
);
