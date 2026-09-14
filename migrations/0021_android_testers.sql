-- People who asked to test the Android app. Play's closed test only admits
-- Google accounts on the tester list, so we collect the address they use on
-- Google Play, add it to the list, and email them the install link.
CREATE TABLE IF NOT EXISTS android_testers (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  user_id TEXT,
  source TEXT,
  device TEXT,
  added_to_play INTEGER DEFAULT 0,
  install_link_sent INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_android_testers_user ON android_testers(user_id) WHERE user_id IS NOT NULL;
