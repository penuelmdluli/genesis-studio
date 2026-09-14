-- ============================================
-- Add inactivity timeout support to sessions
-- ============================================

ALTER TABLE sessions ADD COLUMN last_active_at TEXT;

-- Backfill existing sessions: set last_active_at to created_at
UPDATE sessions SET last_active_at = created_at WHERE last_active_at IS NULL;
