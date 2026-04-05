-- ============================================
-- GENESIS STUDIO — Explore & Share System
-- Community feed, likes, shares, referrals
-- ============================================

-- Explore videos (public community feed)
CREATE TABLE IF NOT EXISTS explore_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_video_id UUID,
  user_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution TEXT,
  has_audio BOOLEAN DEFAULT false,
  type TEXT DEFAULT 'standard',
  is_free_tier BOOLEAN DEFAULT true,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  recreates INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  is_published BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  is_flagged BOOLEAN DEFAULT false,
  creator_name TEXT,
  creator_avatar_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Likes (user-video unique constraint)
CREATE TABLE IF NOT EXISTS explore_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  video_id UUID NOT NULL REFERENCES explore_videos(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id, video_id)
);

-- Share event tracking
CREATE TABLE IF NOT EXISTS share_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id UUID REFERENCES explore_videos(id) ON DELETE CASCADE,
  sharer_user_id TEXT,
  platform TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Referral sign-ups (tracks which shared videos drive new users)
CREATE TABLE IF NOT EXISTS referral_signups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  new_user_id TEXT NOT NULL,
  referred_from_video_id UUID REFERENCES explore_videos(id),
  referred_from_platform TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_explore_trending ON explore_videos(likes DESC, views DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explore_latest ON explore_videos(created_at DESC) WHERE is_published = true AND is_flagged = false;
CREATE INDEX IF NOT EXISTS idx_explore_type ON explore_videos(type, created_at DESC) WHERE is_published = true;
CREATE INDEX IF NOT EXISTS idx_explore_audio ON explore_videos(has_audio, likes DESC) WHERE has_audio = true AND is_published = true;
CREATE INDEX IF NOT EXISTS idx_explore_featured ON explore_videos(is_featured, created_at DESC) WHERE is_featured = true;
CREATE INDEX IF NOT EXISTS idx_explore_user ON explore_videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_explore_likes_user ON explore_likes(user_id, video_id);
CREATE INDEX IF NOT EXISTS idx_share_events_video ON share_events(video_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referral_video ON referral_signups(referred_from_video_id);

-- ============================================
-- RPC: Atomic increment for counters
-- ============================================

CREATE OR REPLACE FUNCTION increment_explore_field(row_id UUID, field_name TEXT, amount INTEGER)
RETURNS VOID AS $$
BEGIN
  EXECUTE format('UPDATE explore_videos SET %I = %I + $1 WHERE id = $2', field_name, field_name)
  USING amount, row_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- RPC: Trending videos with score calculation
-- ============================================

CREATE OR REPLACE FUNCTION get_trending_explore_videos(
  p_cursor_score DOUBLE PRECISION DEFAULT NULL,
  p_cursor_id UUID DEFAULT NULL,
  p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
  id UUID,
  source_video_id UUID,
  user_id TEXT,
  prompt TEXT,
  model_id TEXT,
  video_url TEXT,
  thumbnail_url TEXT,
  duration INTEGER,
  resolution TEXT,
  has_audio BOOLEAN,
  type TEXT,
  is_free_tier BOOLEAN,
  views INTEGER,
  likes INTEGER,
  recreates INTEGER,
  shares INTEGER,
  is_published BOOLEAN,
  is_featured BOOLEAN,
  is_flagged BOOLEAN,
  creator_name TEXT,
  creator_avatar_url TEXT,
  tags TEXT[],
  created_at TIMESTAMPTZ,
  trending_score DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ev.*,
    (ev.likes * 3.0 + ev.views * 1.0 + ev.recreates * 5.0 +
     GREATEST(0, 100.0 - EXTRACT(EPOCH FROM (NOW() - ev.created_at)) / 1728.0)
    ) AS trending_score
  FROM explore_videos ev
  WHERE ev.is_published = true
    AND ev.is_flagged = false
    AND (
      p_cursor_score IS NULL
      OR (
        (ev.likes * 3.0 + ev.views * 1.0 + ev.recreates * 5.0 +
         GREATEST(0, 100.0 - EXTRACT(EPOCH FROM (NOW() - ev.created_at)) / 1728.0)
        ) < p_cursor_score
        OR (
          (ev.likes * 3.0 + ev.views * 1.0 + ev.recreates * 5.0 +
           GREATEST(0, 100.0 - EXTRACT(EPOCH FROM (NOW() - ev.created_at)) / 1728.0)
          ) = p_cursor_score
          AND ev.id < p_cursor_id
        )
      )
    )
  ORDER BY trending_score DESC, ev.id DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE explore_videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE explore_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_signups ENABLE ROW LEVEL SECURITY;

-- Public read access for explore_videos (the whole point is public)
CREATE POLICY "Public read explore_videos" ON explore_videos
  FOR SELECT USING (is_published = true AND is_flagged = false);

-- Service role can do everything
CREATE POLICY "Service role full access explore_videos" ON explore_videos
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access explore_likes" ON explore_likes
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access share_events" ON share_events
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access referral_signups" ON referral_signups
  FOR ALL USING (auth.role() = 'service_role');
