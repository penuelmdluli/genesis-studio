-- ============================================
-- First-party product events
-- ============================================
-- page_views (0007) says where a person went. This says what they DID there:
-- clicked Generate, started a checkout, hit an error, finished onboarding.
-- Together with generation_jobs, credit_transactions and pending_checkouts it
-- gives a complete per-customer timeline — enough to answer "where did this
-- person get stuck?" without guessing.
--
-- Same privacy stance as page_views: no IP, visitor_id only with consent,
-- user_id only for signed-in sessions. props is a small JSON object of
-- non-personal context (model id, plan id, error class) — never free text
-- the user typed.

CREATE TABLE IF NOT EXISTS user_events (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  visitor_id TEXT,
  name TEXT NOT NULL,
  path TEXT,
  props TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_user_events_name ON user_events(name, created_at);
