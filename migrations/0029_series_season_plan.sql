-- Series Studio season plan (2026-10-07).
--
-- The writer used to see only a recap of what had happened, so every
-- episode was planned in isolation: no humiliation set up for a later
-- face-slap, no idea where the paywall falls, the same kind of cliffhanger
-- twice in a row. The plan is written once, before episode 1, and every
-- episode is written against it. JSON, see lib/series/season.ts.
--
-- Additive only: one nullable column.

ALTER TABLE series ADD COLUMN season_plan TEXT;
