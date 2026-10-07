-- Series Studio scene continuity (2026-10-07).
--
-- Every shot used to be drawn from ONE photograph, the lead's, with no fixed
-- set, so another character's lines came out of the lead's face and each
-- shot invented its own room ("The Maid's Son" ep 1). These hold what a real
-- scene shares: where it happens, and what each person looks like.
--
-- Additive only: every column is nullable and nothing existing is changed.

ALTER TABLE series ADD COLUMN location TEXT;           -- default set for the series, e.g. "a Sandton mansion study at dusk"
ALTER TABLE series ADD COLUMN set_image_url TEXT;      -- reference picture of that set, made once

ALTER TABLE series_episodes ADD COLUMN location TEXT;      -- this episode's set, from the writer; falls back to the series
ALTER TABLE series_episodes ADD COLUMN set_image_url TEXT; -- reference picture of it, made once per episode

ALTER TABLE series_cast ADD COLUMN look TEXT;          -- locked visual description of this character
ALTER TABLE series_cast ADD COLUMN image_url TEXT;     -- reference portrait, made once from the look
