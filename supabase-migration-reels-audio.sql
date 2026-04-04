-- ============================================
-- GENESIS STUDIO — Migration: Reels & Audio Support
-- Run this in your Supabase SQL Editor
-- ============================================

-- Add reel/audio columns to generation_jobs
ALTER TABLE generation_jobs
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT 'landscape',
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT;

-- Add reel/audio columns to videos
ALTER TABLE videos
  ADD COLUMN IF NOT EXISTS aspect_ratio TEXT DEFAULT 'landscape',
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS audio_track_id TEXT;

-- Update the type check constraint to allow existing types
-- (no change needed — reels use the same generation types t2v/i2v/v2v)
