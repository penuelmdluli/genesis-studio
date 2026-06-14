-- Owner Marketing Engine — Image history + outro tracking
-- Supports image preset history for reuse and branded outro clips

CREATE TABLE IF NOT EXISTS owner_marketing_images (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  character_preset_id TEXT NOT NULL,
  scenario_preset_id TEXT NOT NULL,
  prompt TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_owner_marketing_images_created
  ON owner_marketing_images(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_owner_marketing_images_scenario
  ON owner_marketing_images(scenario_preset_id);
