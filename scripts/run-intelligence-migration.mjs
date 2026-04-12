import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const envContent = readFileSync('.env.local', 'utf8');
const getEnv = (key) => { const m = envContent.match(new RegExp(key + '=(.+)')); return m ? m[1].trim() : ''; };

const SURL = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const SKEY = getEnv('SUPABASE_SERVICE_ROLE_KEY');

const supabase = createClient(SURL, SKEY);

const statements = [
  // Table 1: post_performance
  `CREATE TABLE IF NOT EXISTS post_performance (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    production_id UUID,
    queue_item_id UUID,
    page_id TEXT NOT NULL,
    platform TEXT DEFAULT 'facebook',
    fb_post_id TEXT,
    fb_video_id TEXT,
    topic TEXT,
    topic_category TEXT,
    headline TEXT,
    script_excerpt TEXT,
    hook_text TEXT,
    language_code TEXT DEFAULT 'en',
    country_code TEXT DEFAULT 'ZA',
    music_style TEXT,
    video_duration_seconds INTEGER,
    scene_count INTEGER,
    voice_style TEXT,
    pillar TEXT,
    engine TEXT,
    posted_at TIMESTAMPTZ,
    day_of_week INTEGER,
    hour_of_day INTEGER,
    views BIGINT DEFAULT 0,
    unique_viewers BIGINT DEFAULT 0,
    watch_time_seconds BIGINT DEFAULT 0,
    avg_watch_time_seconds FLOAT DEFAULT 0,
    completion_rate FLOAT DEFAULT 0,
    likes INTEGER DEFAULT 0,
    comments INTEGER DEFAULT 0,
    shares INTEGER DEFAULT 0,
    saves INTEGER DEFAULT 0,
    reach BIGINT DEFAULT 0,
    impressions BIGINT DEFAULT 0,
    engagement_rate FLOAT DEFAULT 0,
    click_through_rate FLOAT DEFAULT 0,
    negative_feedback INTEGER DEFAULT 0,
    viral_score FLOAT DEFAULT 0,
    performance_tier TEXT,
    performance_score FLOAT DEFAULT 0,
    is_best_performer BOOLEAN DEFAULT false,
    is_worst_performer BOOLEAN DEFAULT false,
    last_fetched_at TIMESTAMPTZ,
    fetch_count INTEGER DEFAULT 0,
    metrics_locked BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table 2: content_intelligence
  `CREATE TABLE IF NOT EXISTS content_intelligence (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_id TEXT NOT NULL,
    insight_type TEXT NOT NULL,
    insight_key TEXT,
    insight_value JSONB,
    confidence_score FLOAT DEFAULT 0,
    sample_size INTEGER DEFAULT 0,
    avg_performance_score FLOAT DEFAULT 0,
    avg_views BIGINT DEFAULT 0,
    avg_engagement_rate FLOAT DEFAULT 0,
    top_example_post_id UUID,
    is_active BOOLEAN DEFAULT true,
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
  )`,

  // Table 3: ai_decisions
  `CREATE TABLE IF NOT EXISTS ai_decisions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_id TEXT,
    decision_type TEXT,
    before_value TEXT,
    after_value TEXT,
    reason TEXT,
    based_on_insight_id UUID,
    confidence_score FLOAT DEFAULT 0,
    outcome_score FLOAT,
    was_correct BOOLEAN,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table 4: viral_formulas
  `CREATE TABLE IF NOT EXISTS viral_formulas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    page_id TEXT,
    formula_name TEXT,
    topic_category TEXT,
    hook_pattern TEXT,
    optimal_duration INTEGER,
    optimal_hour INTEGER,
    optimal_day INTEGER,
    music_style TEXT,
    language_code TEXT,
    avg_viral_score FLOAT DEFAULT 0,
    avg_views BIGINT DEFAULT 0,
    usage_count INTEGER DEFAULT 0,
    success_rate FLOAT DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,

  // Table 5: feedback_system_logs
  `CREATE TABLE IF NOT EXISTS feedback_system_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT,
    page_id TEXT,
    details JSONB,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`,
];

const indexes = [
  `CREATE INDEX IF NOT EXISTS idx_post_performance_page ON post_performance(page_id, posted_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_post_performance_category ON post_performance(topic_category, performance_score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_post_performance_fb ON post_performance(fb_post_id)`,
  `CREATE INDEX IF NOT EXISTS idx_content_intelligence_page ON content_intelligence(page_id, insight_type)`,
  `CREATE INDEX IF NOT EXISTS idx_ai_decisions_page ON ai_decisions(page_id, created_at DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_viral_formulas_page ON viral_formulas(page_id, avg_viral_score DESC)`,
  `CREATE INDEX IF NOT EXISTS idx_feedback_logs_type ON feedback_system_logs(event_type, created_at DESC)`,
];

async function run() {
  console.log('Running intelligence migration...');
  console.log('Supabase URL:', SURL);

  // Test connection
  const { data: test, error: testErr } = await supabase.from('users').select('id').limit(1);
  if (testErr) {
    console.error('Connection test failed:', testErr.message);
    return;
  }
  console.log('Connection OK');

  // Run each CREATE TABLE via rpc
  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i];
    const tableName = sql.match(/CREATE TABLE IF NOT EXISTS (\w+)/)?.[1] || `statement_${i}`;

    // Try inserting a test row to see if table exists
    const { error: checkErr } = await supabase.from(tableName).select('id').limit(1);
    if (!checkErr) {
      console.log(`  Table ${tableName} already exists`);
      continue;
    }

    // Table doesn't exist — we need to create it via SQL
    // Since we can't run DDL via the REST API, we'll use the SQL editor approach
    console.log(`  Table ${tableName} needs creation — add to Supabase SQL editor`);
  }

  // Verify all tables by trying to query them
  const tables = ['post_performance', 'content_intelligence', 'ai_decisions', 'viral_formulas', 'feedback_system_logs'];
  const missing = [];
  for (const t of tables) {
    const { error } = await supabase.from(t).select('id').limit(1);
    if (error) {
      missing.push(t);
      console.log(`  MISSING: ${t} — ${error.message}`);
    } else {
      console.log(`  OK: ${t}`);
    }
  }

  if (missing.length > 0) {
    console.log('\n=== TABLES NEED CREATION ===');
    console.log('Run the SQL in supabase-migration-intelligence.sql via the Supabase Dashboard SQL Editor:');
    console.log('https://supabase.com/dashboard/project/quliaphgimytmqkwadqu/sql/new');
    console.log('\nMissing tables:', missing.join(', '));
  } else {
    console.log('\nAll intelligence tables exist!');
  }
}

run().catch(console.error);
