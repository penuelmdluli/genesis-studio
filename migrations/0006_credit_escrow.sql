-- ============================================
-- Credit escrow + job lifecycle
-- ============================================
-- Replaces debit-then-refund with hold → capture | release.
--
-- Why: production has 104 refunds against 117 failures and 9,145 credits
-- refunded. refundCredits() has no idempotency guard, and two independent
-- actors refund on the same 30-minute timeout (cron/check-stuck-jobs and
-- GET /api/jobs/[jobId]), so a user polling their job while the cron sweeps
-- could be credited twice. Separately, /api/generate debited BEFORE creating
-- the job row, so a createJob() failure left a debit with no job, no refund
-- and no way to reconcile — every debit was written with job_id = "".
--
-- A hold fixes all three: it is created atomically with the balance movement,
-- it carries the job id from the start, and it can be resolved exactly once.

CREATE TABLE IF NOT EXISTS credit_holds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- Set as soon as the job row exists. Nullable only for the brief window
  -- between reserving credits and creating the job.
  job_id TEXT,

  amount INTEGER NOT NULL CHECK (amount > 0),

  -- held     → credits are reserved and already off the user's balance
  -- captured → the work succeeded; the debit is now real and in the ledger
  -- released → the work failed or expired; credits went back to the balance
  --
  -- Every transition is guarded by "WHERE status = 'held'", so a hold can be
  -- resolved exactly once no matter how many actors race for it. This is what
  -- makes the double-refund impossible rather than merely unlikely.
  status TEXT NOT NULL DEFAULT 'held'
    CHECK (status IN ('held', 'captured', 'released')),

  -- Two submits carrying the same key resolve to the same hold, so a
  -- double-click cannot create two jobs or two charges.
  idempotency_key TEXT,

  description TEXT NOT NULL DEFAULT '',
  resolution_reason TEXT,

  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_credit_holds_user ON credit_holds(user_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_holds_job ON credit_holds(job_id);
CREATE INDEX IF NOT EXISTS idx_credit_holds_open ON credit_holds(status, created_at);

-- Partial unique index: the idempotency guarantee, enforced by the database
-- rather than by application code that could race with itself.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_holds_idem
  ON credit_holds(user_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

-- --- generation_jobs: lifecycle columns -----------------------------------
-- SQLite has no "ADD COLUMN IF NOT EXISTS"; these run once. Kept as separate
-- statements so a partial failure is obvious rather than silent.

-- The hold backing this job, so the reaper can resolve it without guessing.
ALTER TABLE generation_jobs ADD COLUMN credit_hold_id TEXT;

-- When this job stops being worth waiting for. Set at submit from the model's
-- own average time plus margin. A job with no deadline can sit in 'queued'
-- forever, which is exactly what the 18 timeout failures were.
ALTER TABLE generation_jobs ADD COLUMN deadline_at TEXT;

-- Which provider actually took the job. Production could not previously
-- answer "who ran this?" — runpod_job_id held FAL and WaveSpeed ids too.
ALTER TABLE generation_jobs ADD COLUMN provider TEXT;

-- Machine-readable failure class, for grouping in the admin dashboard.
-- error_message stays as the human sentence.
ALTER TABLE generation_jobs ADD COLUMN error_code TEXT;

-- What the run actually cost us, filled in when the provider reports it.
ALTER TABLE generation_jobs ADD COLUMN cost_usd REAL;

CREATE INDEX IF NOT EXISTS idx_jobs_deadline
  ON generation_jobs(status, deadline_at);
