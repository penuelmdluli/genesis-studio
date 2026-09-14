-- Accounts the owner creates for app-store reviewers and QA. Kept apart so
-- they are easy to find, top up, and leave out of marketing and metrics.
CREATE TABLE IF NOT EXISTS test_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE,
  label TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
