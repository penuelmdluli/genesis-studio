-- The growth brain's outbox and inbox.
--
-- Engines running on the owner's machine propose actions here. The owner
-- approves or rejects them by clicking a link in the daily email - from a
-- phone, signed out, anywhere. The brain polls this table and carries out
-- whatever was approved.
--
-- Living in D1 rather than on the laptop means the approval link works even
-- when the machine that proposed the action is asleep.

CREATE TABLE IF NOT EXISTS growth_actions (
  id TEXT PRIMARY KEY,
  engine TEXT NOT NULL,            -- recovery | ops | funnel | pricing | hunter | content
  title TEXT NOT NULL,             -- one line the owner reads in the email
  detail TEXT,                     -- the evidence and reasoning behind it
  payload TEXT,                    -- JSON the engine needs to execute it
  money_at_stake REAL,             -- rands, where it can be estimated
  risk TEXT,                       -- 'safe' = auto-executable, 'ask' = needs approval
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected | done | failed
  result TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  decided_at TEXT,
  done_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_growth_actions_status ON growth_actions(status);
CREATE INDEX IF NOT EXISTS idx_growth_actions_engine ON growth_actions(engine);
CREATE INDEX IF NOT EXISTS idx_growth_actions_created ON growth_actions(created_at);
