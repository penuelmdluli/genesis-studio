-- ============================================
-- Lead Videos — saved trending reference clips
-- ============================================
-- A lead is a link to somebody else's video (Facebook, TikTok, Instagram, X)
-- that we want to reuse as the motion reference for our own videos later.
-- The point of persisting it is that the source often disappears: reels get
-- deleted, go private, or rot behind a login wall between the moment we spot
-- one and the session where we actually use it. So a lead is downloaded to R2
-- when it is added, and video_url is what motion control consumes from then on.

CREATE TABLE IF NOT EXISTS lead_videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,

  -- Where we found it, exactly as pasted (minus tracking params).
  source_url TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',

  -- Filled in from the source once we fetch it.
  title TEXT,
  creator_name TEXT,
  thumbnail_url TEXT,
  view_count INTEGER DEFAULT 0,
  duration_sec REAL DEFAULT 0,

  -- Our own durable copy. video_url is a CDN URL over r2_key.
  r2_key TEXT,
  video_url TEXT,
  file_size_bytes INTEGER DEFAULT 0,

  -- pending  → queued, nothing downloaded yet
  -- fetching → a download is in flight
  -- ready    → video_url is usable as a motion reference
  -- failed   → see error_message; retried up to a cap by the cron
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fetching', 'ready', 'failed')),
  error_message TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,

  -- Curation.
  notes TEXT,
  tags TEXT,
  starred INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,

  -- Usage, so the list can surface what is still unused.
  times_used INTEGER NOT NULL DEFAULT 0,
  last_used_at TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_lead_videos_user ON lead_videos(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_lead_videos_status ON lead_videos(status);

-- Pasting the same link twice is the normal way to use this (you see the reel
-- again days later and forget). The unique index turns that into an update of
-- the row you already have rather than a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_lead_videos_user_url
  ON lead_videos(user_id, source_url);
