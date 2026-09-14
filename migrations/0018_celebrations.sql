-- Moments worth celebrating on screen (a friend joined, credits earned).
-- Shown once as a full-screen celebration, then kept in the notification bell.
CREATE TABLE IF NOT EXISTS user_celebrations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL,            -- friend_joined | reward | welcome_bonus
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  credits INTEGER NOT NULL DEFAULT 0,
  friends INTEGER NOT NULL DEFAULT 0,
  seen INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_celebrations_user ON user_celebrations(user_id, seen, created_at);
