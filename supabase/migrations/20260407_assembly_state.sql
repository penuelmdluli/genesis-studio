-- Add assembly_state JSONB column to productions table
-- Stores the async assembly state machine (phases, FAL job IDs, URLs)
ALTER TABLE productions ADD COLUMN IF NOT EXISTS assembly_state JSONB;
