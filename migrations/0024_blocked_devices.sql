-- Hard blocklist: a device or network that farmed accounts is refused outright.
--
-- Suspending accounts stops the ones we found; this stops the next attempt from
-- the same browser or network before an account exists at all.

CREATE TABLE IF NOT EXISTS blocked_devices (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,            -- 'device' | 'ip_prefix' | 'fingerprint'
  value TEXT NOT NULL,
  reason TEXT,
  hits INTEGER DEFAULT 0,        -- how many attempts it has turned away
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_blocked_devices_value ON blocked_devices(kind, value);
