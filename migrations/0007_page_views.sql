-- ============================================
-- First-party visit tracking
-- ============================================
-- Why this exists: the product had no working web analytics at all. The
-- Cloudflare beacon shipped with an empty token and recorded nothing, the
-- Plausible script depends on an account we cannot verify, src/lib/analytics.ts
-- was never imported by anything, and signup_attribution had zero rows. The
-- in-product funnel could be measured from generation_jobs, but everything
-- before signup was invisible — so "where are we losing people?" was
-- unanswerable for the entire top of the funnel.
--
-- Privacy stance, deliberately chosen rather than inherited:
--
--   * No IP address is ever stored. Country comes from Cloudflare's
--     CF-IPCountry header, which is already coarse, and nothing finer is kept.
--   * referrer_host stores the HOST only, never the full referring URL. Full
--     URLs routinely carry search terms and personal identifiers in the query
--     string, and we have no use for them.
--   * visitor_id is a random per-device value that exists ONLY when the user
--     accepted analytics cookies. Without consent the row is still written but
--     visitor_id is null: we learn that a visit happened and where it came
--     from, and nothing that can be tied back to a person or joined across
--     visits. That is the same bargain Plausible and Cloudflare Analytics
--     offer, and it keeps aggregate traffic honest for everyone.
--   * user_id is set only for a signed-in session, where the person is already
--     identified to us.

CREATE TABLE IF NOT EXISTS page_views (
  id TEXT PRIMARY KEY,

  -- Null unless the visitor accepted analytics cookies. Null rows still count
  -- toward traffic; they just cannot be stitched into a journey.
  visitor_id TEXT,
  user_id TEXT,

  path TEXT NOT NULL,

  -- Host only. "google.com", not the full search URL.
  referrer_host TEXT,

  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,

  country TEXT,
  device TEXT CHECK (device IN ('mobile', 'tablet', 'desktop', 'unknown')),

  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_path ON page_views(path, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_ref ON page_views(referrer_host, created_at);
CREATE INDEX IF NOT EXISTS idx_page_views_visitor ON page_views(visitor_id, created_at);
