-- Daily marketing ad loop: one row per SAST day. The unique day is the claim,
-- so a duplicate cron firing can never post the same day twice.
CREATE TABLE IF NOT EXISTS ad_loop_posts (
  id TEXT PRIMARY KEY,
  day TEXT NOT NULL,
  ad_key TEXT NOT NULL,
  page_key TEXT NOT NULL,
  post_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS ad_loop_posts_day ON ad_loop_posts(day);
