-- ============================================
-- Billing: pending checkouts + plan expiry
-- ============================================
-- Why this exists: a Yoco checkout is a one-off card payment, not a
-- subscription. Until now a "monthly" plan bought through Yoco was granted
-- forever, and there was no record of a checkout between "user clicked
-- Subscribe" and "webhook arrived" — so when the webhook never arrived
-- (it was registered against a dead host for months) nothing in the app
-- could notice or recover.
--
-- pending_checkouts is that record. It lets the dashboard verify a payment
-- directly with the provider the moment the customer lands back on it, and
-- gives the admin view a list of abandoned checkouts.
--
-- plan_expires_at turns a one-off payment into a 31-day plan. The daily
-- billing cron reminds the customer 3 days before, and downgrades to free
-- (keeping their credit balance — credits never expire) when it lapses.

ALTER TABLE users ADD COLUMN plan_expires_at TEXT;

CREATE TABLE IF NOT EXISTS pending_checkouts (
  id TEXT PRIMARY KEY,                 -- provider checkout id (Yoco: ch_...)
  provider TEXT NOT NULL,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('subscription', 'credit_pack')),
  product_id TEXT NOT NULL,            -- plan id or pack id
  amount INTEGER NOT NULL,             -- minor units (cents)
  currency TEXT NOT NULL,
  metadata TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_pending_checkouts_user ON pending_checkouts(user_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_users_plan_expires ON users(plan_expires_at);
