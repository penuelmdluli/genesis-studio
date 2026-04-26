-- MBS Automation v2 — Full Auto Pipeline
-- Adds: source discovery, candidates, brand safety, quality gate,
-- posting calendar, engagement learning.

-- Source creators to monitor
CREATE TABLE IF NOT EXISTS mbs_source_creators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  handle TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('tiktok', 'instagram', 'facebook', 'youtube')),
  profile_url TEXT NOT NULL,
  display_name TEXT,
  content_style TEXT[],
  partnership_status TEXT DEFAULT 'cold' CHECK (partnership_status IN ('cold', 'contacted', 'partnered', 'declined')),
  attribution_required BOOLEAN DEFAULT true,
  active BOOLEAN DEFAULT true,
  last_checked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(handle, platform)
);

-- Hashtags to watch
CREATE TABLE IF NOT EXISTS mbs_watched_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag TEXT NOT NULL UNIQUE,
  platform TEXT NOT NULL,
  active BOOLEAN DEFAULT true,
  min_view_count INT DEFAULT 10000,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Discovered video candidates
CREATE TABLE IF NOT EXISTS mbs_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_creator_id UUID REFERENCES mbs_source_creators(id),
  source_tag_id UUID REFERENCES mbs_watched_tags(id),
  source_url TEXT NOT NULL UNIQUE,
  source_post_id TEXT,
  duration_sec INT,
  view_count INT,
  posted_at TIMESTAMPTZ,
  thumbnail_url TEXT,

  status TEXT NOT NULL DEFAULT 'discovered' CHECK (status IN (
    'discovered', 'downloaded', 'vetting', 'approved', 'review',
    'rejected', 'processed', 'posted', 'failed'
  )),

  vision_score NUMERIC(5,2),
  audio_score NUMERIC(5,2),
  overall_score NUMERIC(5,2),
  safety_notes JSONB,

  suggested_character_id UUID,
  suggested_setting TEXT,
  suggested_caption TEXT,
  suggested_dance_style TEXT,

  reference_video_r2_url TEXT,
  rejected_reason TEXT,
  reviewed_by TEXT,
  reviewed_at TIMESTAMPTZ,
  discovered_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_candidates_status ON mbs_candidates(status);
CREATE INDEX IF NOT EXISTS idx_candidates_score ON mbs_candidates(overall_score)
  WHERE status = 'approved';

-- Extend mbs_characters with performance learning
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS brand_colors TEXT[];
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS best_for_styles TEXT[];
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS total_posts INT DEFAULT 0;
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS total_engagement INT DEFAULT 0;
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS avg_engagement_per_post NUMERIC(10,2);
ALTER TABLE mbs_characters ADD COLUMN IF NOT EXISTS best_performing_style TEXT;

-- Extend mbs_jobs with quality gate + candidate link + scheduling
ALTER TABLE mbs_jobs ADD COLUMN IF NOT EXISTS candidate_id UUID;
ALTER TABLE mbs_jobs ADD COLUMN IF NOT EXISTS quality_score NUMERIC(5,2);
ALTER TABLE mbs_jobs ADD COLUMN IF NOT EXISTS quality_notes JSONB;
ALTER TABLE mbs_jobs ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
ALTER TABLE mbs_jobs ADD COLUMN IF NOT EXISTS cfg_scale NUMERIC(3,2) DEFAULT 0.5;

-- Drop and recreate the status check to include new statuses
ALTER TABLE mbs_jobs DROP CONSTRAINT IF EXISTS mbs_jobs_status_check;
ALTER TABLE mbs_jobs ADD CONSTRAINT mbs_jobs_status_check
  CHECK (status IN ('pending', 'submitted', 'completed', 'quality_check',
    'quality_approved', 'quality_review', 'scheduled', 'posted', 'failed', 'cancelled'));

CREATE INDEX IF NOT EXISTS idx_mbs_jobs_scheduled_for ON mbs_jobs(scheduled_for)
  WHERE status = 'scheduled';

-- Extend mbs_engagement
ALTER TABLE mbs_engagement ADD COLUMN IF NOT EXISTS hours_since_post INT;

-- Posting schedule (anti-pattern detection)
CREATE TABLE IF NOT EXISTS mbs_posting_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES mbs_jobs(id),
  page_id TEXT NOT NULL,
  slot_start TIMESTAMPTZ NOT NULL,
  slot_end TIMESTAMPTZ NOT NULL,
  posted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page configuration
CREATE TABLE IF NOT EXISTS mbs_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id TEXT NOT NULL UNIQUE,
  max_posts_per_day INT DEFAULT 5,
  optimal_slots JSONB,
  min_minutes_between_posts INT DEFAULT 90,
  active BOOLEAN DEFAULT true
);

-- Seed config for MBS page
INSERT INTO mbs_config (page_id, max_posts_per_day, optimal_slots, min_minutes_between_posts)
VALUES (
  '112465853843545',
  5,
  '[{"hour": 7, "jitter_min": 15}, {"hour": 12, "jitter_min": 15}, {"hour": 15, "jitter_min": 15}, {"hour": 18, "jitter_min": 15}, {"hour": 21, "jitter_min": 15}]',
  90
) ON CONFLICT (page_id) DO NOTHING;

-- Seed watched tags
INSERT INTO mbs_watched_tags (tag, platform) VALUES
  ('#amapiano', 'tiktok'),
  ('#southafricadance', 'tiktok'),
  ('#bacardi', 'tiktok'),
  ('#amapianodance', 'tiktok'),
  ('#mzansidance', 'tiktok'),
  ('#pantsula', 'tiktok')
ON CONFLICT (tag) DO NOTHING;
