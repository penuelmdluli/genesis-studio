-- Abuse detection: who signed up from which device and network.
--
-- Free credits are real money, so a farm of throwaway Gmail accounts costs us
-- generation spend. We never had an IP or device on the account record, so the
-- only link between two accounts was an analytics cookie that often never fired.
-- This table is written on every register and login.

CREATE TABLE IF NOT EXISTS signup_signals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  event TEXT NOT NULL,              -- 'register' | 'login'
  device_id TEXT,                   -- first-party cookie, survives logout and new accounts
  ip TEXT,
  ip_prefix TEXT,                   -- /24 (v4) or /48 (v6): same household or phone network
  country TEXT,
  asn TEXT,                         -- network operator, flags datacentre/VPN ranges
  user_agent TEXT,
  accept_language TEXT,
  fingerprint TEXT,                 -- hash of UA + language + platform, for cleared cookies
  risk_score INTEGER DEFAULT 0,
  risk_reasons TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_signup_signals_device ON signup_signals(device_id);
CREATE INDEX IF NOT EXISTS idx_signup_signals_ip ON signup_signals(ip_prefix);
CREATE INDEX IF NOT EXISTS idx_signup_signals_fp ON signup_signals(fingerprint);
CREATE INDEX IF NOT EXISTS idx_signup_signals_user ON signup_signals(user_id);
CREATE INDEX IF NOT EXISTS idx_signup_signals_created ON signup_signals(created_at);

-- Suspended accounts cannot sign in or spend credits.
ALTER TABLE users ADD COLUMN suspended INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN suspended_reason TEXT;
