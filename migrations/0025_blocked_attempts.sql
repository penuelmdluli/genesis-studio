-- Every sign-up or sign-in we turned away, and why.
--
-- The blocklist stops the attack; this shows how often it is still being tried,
-- from where, and whether the attacker is rotating networks or giving up.

CREATE TABLE IF NOT EXISTS blocked_attempts (
  id TEXT PRIMARY KEY,
  outcome TEXT NOT NULL,          -- 'blocked' | 'auto_blocked' | 'credits_withheld'
  route TEXT NOT NULL,            -- 'register' | 'login'
  email TEXT,
  ip TEXT,
  ip_prefix TEXT,
  country TEXT,
  device_id TEXT,
  fingerprint TEXT,
  user_agent TEXT,
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_blocked_attempts_created ON blocked_attempts(created_at);
CREATE INDEX IF NOT EXISTS idx_blocked_attempts_ip ON blocked_attempts(ip_prefix);
CREATE INDEX IF NOT EXISTS idx_blocked_attempts_outcome ON blocked_attempts(outcome);
