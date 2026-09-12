-- A creator's own Facebook Page, connected through Facebook Login.
-- Tokens here belong to the customer, not the operator: they are page access
-- tokens obtained with that person's consent and are deleted when they
-- disconnect or when Meta sends a data-deletion request.
CREATE TABLE IF NOT EXISTS social_connections (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  provider TEXT NOT NULL,           -- 'facebook'
  external_id TEXT NOT NULL,        -- page id
  name TEXT,                        -- page name, for the UI
  access_token TEXT NOT NULL,       -- page access token
  token_expires_at TEXT,
  scopes TEXT,
  connected_at TEXT DEFAULT (datetime('now')),
  revoked_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_social_user ON social_connections(user_id, provider);
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_unique ON social_connections(user_id, provider, external_id);
