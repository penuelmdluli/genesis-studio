-- ============================================
-- GENESIS STUDIO — Dev Content Pipeline Tables
-- Run in Supabase SQL editor on dev project
-- ============================================

-- Trending topics from all news sources
CREATE TABLE IF NOT EXISTS dev_trending_topics (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  summary text,
  category text,
  viral_potential int DEFAULT 0,
  content_angle text,
  suggested_hook text,
  region text,
  source text,
  sources_count int DEFAULT 1,
  page_target text,
  status text DEFAULT 'pending' CHECK (status IN ('pending','queued','generated','posted')),
  created_at timestamptz DEFAULT now(),
  used_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_dev_trending_status ON dev_trending_topics(status, viral_potential DESC);
CREATE INDEX IF NOT EXISTS idx_dev_trending_created ON dev_trending_topics(created_at DESC);

-- Content generation queue
CREATE TABLE IF NOT EXISTS dev_content_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id text NOT NULL,
  pillar text NOT NULL,
  status text DEFAULT 'pending' CHECK (status IN ('pending','generating','ready','posted','failed')),
  engine text,
  input_data jsonb,
  video_url text,
  caption text,
  hashtags text[],
  scheduled_time timestamptz,
  generated_at timestamptz,
  posted_at timestamptz,
  cost_usd decimal(10,4),
  viral_score int DEFAULT 0,
  news_topic_id uuid REFERENCES dev_trending_topics(id),
  error_message text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_queue_status ON dev_content_queue(status);
CREATE INDEX IF NOT EXISTS idx_dev_queue_page ON dev_content_queue(page_id, status);
CREATE INDEX IF NOT EXISTS idx_dev_queue_scheduled ON dev_content_queue(scheduled_time);

-- Generation cost tracking
CREATE TABLE IF NOT EXISTS dev_generation_costs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  engine text NOT NULL,
  pillar text,
  page_id text,
  estimated_cost_usd decimal(10,4),
  actual_cost_usd decimal(10,4),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dev_costs_created ON dev_generation_costs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dev_costs_engine ON dev_generation_costs(engine);
