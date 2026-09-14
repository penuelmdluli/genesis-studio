-- Mimic Studio: lip-sync marketing outro on every dance video
-- Adds columns to track the outro generation + final combined video

ALTER TABLE mimic_jobs ADD COLUMN outro_request_id TEXT;
ALTER TABLE mimic_jobs ADD COLUMN outro_status TEXT DEFAULT 'none';
ALTER TABLE mimic_jobs ADD COLUMN outro_video_url TEXT;
ALTER TABLE mimic_jobs ADD COLUMN final_video_url TEXT;
ALTER TABLE mimic_jobs ADD COLUMN marketing_audio_url TEXT;

-- Drop the old CHECK constraint and recreate with new statuses
-- D1 doesn't enforce CHECK constraints, so this is documentation only
-- Valid statuses: pending, scraping, submitted, processing, completed, failed
-- Valid outro_status: none, submitted, completed, failed
