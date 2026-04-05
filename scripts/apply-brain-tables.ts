/**
 * Apply Brain Studio tables to Supabase
 * Run: npx tsx scripts/apply-brain-tables.ts
 */

import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { resolve } from "path";

dotenv.config({ path: resolve(__dirname, "../.env.local") });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log("Checking if productions table exists...");

  // Test if the table already exists
  const { error: testError } = await supabase.from("productions").select("id").limit(1);

  if (!testError) {
    console.log("productions table already exists!");
    return;
  }

  if (!testError.message.includes("schema cache") && !testError.message.includes("does not exist")) {
    console.log("productions table exists but has a different error:", testError.message);
    return;
  }

  console.log("productions table not found. Creating Brain Studio tables...");
  console.log("");
  console.log("IMPORTANT: You need to run the following SQL in your Supabase SQL Editor:");
  console.log("Go to: https://supabase.com/dashboard → Your Project → SQL Editor");
  console.log("Paste and run the SQL from: supabase-schema.sql (lines 184-266)");
  console.log("");
  console.log("Or copy-paste this SQL:");
  console.log("=".repeat(60));
  console.log(`
-- Productions table (Genesis Brain)
CREATE TABLE IF NOT EXISTS productions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'planned', 'generating', 'assembling', 'completed', 'failed', 'cancelled')),
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  target_duration INTEGER NOT NULL DEFAULT 30,
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape' CHECK (aspect_ratio IN ('landscape', 'portrait', 'square')),
  plan JSONB,
  voiceover BOOLEAN NOT NULL DEFAULT FALSE,
  music BOOLEAN NOT NULL DEFAULT FALSE,
  captions BOOLEAN NOT NULL DEFAULT FALSE,
  total_credits INTEGER NOT NULL DEFAULT 0,
  output_video_urls TEXT,
  thumbnail_url TEXT,
  gif_preview_url TEXT,
  voiceover_url TEXT,
  music_url TEXT,
  captions_url TEXT,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_productions_user_id ON productions(user_id);
CREATE INDEX IF NOT EXISTS idx_productions_status ON productions(status);
CREATE INDEX IF NOT EXISTS idx_productions_created_at ON productions(created_at DESC);

-- Production Scenes table
CREATE TABLE IF NOT EXISTS production_scenes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  production_id UUID NOT NULL REFERENCES productions(id) ON DELETE CASCADE,
  scene_number INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
  prompt TEXT NOT NULL,
  model_id TEXT NOT NULL,
  duration INTEGER NOT NULL DEFAULT 5,
  resolution TEXT NOT NULL DEFAULT '720p',
  output_video_url TEXT,
  runpod_job_id TEXT,
  gpu_time REAL,
  error_message TEXT,
  progress INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_scenes_production_id ON production_scenes(production_id);
CREATE INDEX IF NOT EXISTS idx_production_scenes_status ON production_scenes(status);
CREATE INDEX IF NOT EXISTS idx_production_scenes_runpod_job_id ON production_scenes(runpod_job_id);

-- Production Templates table
CREATE TABLE IF NOT EXISTS production_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  concept TEXT NOT NULL,
  style TEXT NOT NULL DEFAULT 'cinematic',
  aspect_ratio TEXT NOT NULL DEFAULT 'landscape',
  target_duration INTEGER NOT NULL DEFAULT 30,
  voiceover BOOLEAN NOT NULL DEFAULT FALSE,
  music BOOLEAN NOT NULL DEFAULT FALSE,
  captions BOOLEAN NOT NULL DEFAULT FALSE,
  scene_structure JSONB,
  is_public BOOLEAN NOT NULL DEFAULT FALSE,
  usage_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_production_templates_user_id ON production_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_production_templates_public ON production_templates(is_public) WHERE is_public = TRUE;

-- Enable RLS
ALTER TABLE productions ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_templates ENABLE ROW LEVEL SECURITY;

-- RLS policies (allow service role to bypass, users read own data)
CREATE POLICY "Users can view own productions" ON productions
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Users can view own production scenes" ON production_scenes
  FOR SELECT USING (production_id IN (SELECT id FROM productions WHERE user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text)));

CREATE POLICY "Users can view own templates" ON production_templates
  FOR SELECT USING (user_id IN (SELECT id FROM users WHERE clerk_id = auth.uid()::text));

CREATE POLICY "Public templates are viewable" ON production_templates
  FOR SELECT USING (is_public = TRUE);
`);
  console.log("=".repeat(60));
}

applyMigration().catch(console.error);
