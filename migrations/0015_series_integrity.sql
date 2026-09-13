-- One row per scene, enforced by the database.
--
-- Two presses of "Make this episode" could both pass a read-then-decide
-- guard before either had written anything: one episode ended up with 24
-- rows for 12 scenes, every one rendered and paid for twice. A shot's id is
-- now derived from its episode and position, and this index refuses the
-- second claim outright, so a race costs nothing instead of doubling the bill.
CREATE UNIQUE INDEX IF NOT EXISTS idx_shots_episode_index ON series_shots(episode_id, shot_index);

-- How many times a scene has been attempted. Failures retry themselves, and
-- this is what stops a scene that fails for a real reason from retrying for
-- ever and billing every time.
ALTER TABLE series_shots ADD COLUMN attempts INTEGER DEFAULT 1;

-- The raw provider error, kept alongside the friendly line shown to the
-- creator. Storing only the reassurance once left a real failure impossible
-- to diagnose after the fact.
ALTER TABLE series_shots ADD COLUMN raw_error TEXT;

-- The joined episode, and the background job that builds it.
ALTER TABLE series_episodes ADD COLUMN video_id TEXT;
ALTER TABLE series_episodes ADD COLUMN video_url TEXT;
ALTER TABLE series_episodes ADD COLUMN assembly_job TEXT;

-- Who sounds like whom, decided once per series and reused for ever, so a
-- character does not change voice between episodes.
CREATE TABLE IF NOT EXISTS series_cast (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  character_key TEXT NOT NULL,
  display_name TEXT,
  gender TEXT,
  voice TEXT,
  pitch TEXT DEFAULT '+0Hz',
  rate TEXT DEFAULT '+0%',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_cast_series_char ON series_cast(series_id, character_key);

-- Throttle for operator alerts, so a low provider balance emails once per
-- level rather than every time the check runs.
--
-- `id` is required even though `key` is the real primary key: the database
-- helper silently adds an id to every insert, and without the column every
-- write is rejected with no error — which is exactly how this throttle first
-- failed and emailed on every run.
CREATE TABLE IF NOT EXISTS ops_alerts (
  id TEXT,
  key TEXT PRIMARY KEY,
  last_sent_at TEXT,
  last_level TEXT,
  last_value REAL
);
