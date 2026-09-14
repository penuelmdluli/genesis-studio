-- Series: the reason a creator comes back next week.
--
-- A single clip is not a business. A series is: the same characters, the same
-- language, a story that continues, posted every week. `story_so_far` is what
-- makes episode N+1 follow from episode N instead of starting over, and
-- character_image_url is what keeps the lead's face the same across episodes.
CREATE TABLE IF NOT EXISTS series (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  language TEXT NOT NULL DEFAULT 'en-ZA',   -- zu-ZA | af-ZA | en-ZA | en
  genre TEXT,
  logline TEXT,
  character_name TEXT,
  character_description TEXT,                -- locked wording, reused every episode
  character_image_url TEXT,                  -- the face, reused every episode
  story_so_far TEXT DEFAULT '',              -- accumulated recap the writer reads
  episode_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_series_user ON series(user_id);

CREATE TABLE IF NOT EXISTS series_episodes (
  id TEXT PRIMARY KEY,
  series_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  episode_number INTEGER NOT NULL,
  title TEXT,
  synopsis TEXT,
  script TEXT,              -- JSON: scenes with dialogue in the series language
  production_id TEXT,       -- links into the existing productions pipeline
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_episodes_series ON series_episodes(series_id, episode_number);

-- One shot of one episode. Kept separate from the script so a re-render
-- never rewrites the words, and so a failed shot can be refunded on its own.
CREATE TABLE IF NOT EXISTS series_shots (
  id TEXT PRIMARY KEY,
  episode_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  shot_index INTEGER NOT NULL,
  kind TEXT NOT NULL DEFAULT 'dialogue',   -- dialogue | action
  speaker TEXT,
  dialogue TEXT,                            -- the line, in the series language
  subtitle TEXT,                            -- the same line in English
  action TEXT,                              -- English visual direction
  emotion TEXT,
  image_url TEXT,
  audio_url TEXT,
  clip_url TEXT,                            -- what the creator sees
  raw_clip_url TEXT,                        -- before the 1080p finishing pass
  stage TEXT DEFAULT 'render',              -- render | upscale | done
  provider_ref TEXT,
  status TEXT DEFAULT 'pending',
  error TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_shots_episode ON series_shots(episode_id, shot_index);
