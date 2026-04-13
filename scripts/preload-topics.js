const fs = require('fs');
try {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  for (const line of envContent.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  }
} catch {}

const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const TOPICS = [
  // TIER 1 — ALWAYS VIRAL (weight 10)
  { title: 'AI is replacing these 5 jobs in South Africa right now', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'South African rand hits shocking new low — what happens next', tier: 1, pillar: 'finance', priority: 10 },
  { title: 'Eskom exposed — where did R40 billion go', tier: 1, pillar: 'breaking_news', priority: 10 },
  { title: 'China is quietly buying South Africa piece by piece', tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'Load shedding is over — but here is what they are not telling you', tier: 1, pillar: 'breaking_news', priority: 10 },
  { title: 'South Africans are leaving — the real numbers will shock you', tier: 1, pillar: 'breaking_news', priority: 9 },
  { title: 'AI took my job — true story from Johannesburg', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'USA vs China war — South Africa must choose sides', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: 'This African country just embarrassed South Africa in tech', tier: 1, pillar: 'tech', priority: 9 },
  { title: 'Your WhatsApp messages are being read — here is proof', tier: 1, pillar: 'tech', priority: 9 },

  // TIER 2 — HIGH ENGAGEMENT (weight 7-8)
  { title: 'South African startup just raised R500 million', tier: 2, pillar: 'tech', priority: 8 },
  { title: 'Starlink vs Telkom — South Africa picks a winner', tier: 2, pillar: 'tech', priority: 8 },
  { title: 'This SA invention is changing the world', tier: 2, pillar: 'ai_news', priority: 7 },
  { title: 'Crypto is dying in South Africa — here is why', tier: 2, pillar: 'finance', priority: 7 },
  { title: 'The real reason your food prices keep rising', tier: 2, pillar: 'finance', priority: 8 },
];

async function run() {
  console.log('=== PRELOADING 15 VIRAL TOPICS TO tech_pulse_africa ===\n');

  // First: clean up pending items from OTHER pages (we're shutting them down)
  const otherPages = [
    'mzansi_baby_stars',
    'africa_2050', 'africa_2050_dev',
    'afrika_toons_dev',
    'world_news_animated_dev',
    'pop_culture_buzz_dev',
    'ai_revolution_dev',
  ];
  const { error: cancelErr, count: cancelCount } = await supabase
    .from('dev_content_queue')
    .update({ status: 'cancelled' })
    .in('page_id', otherPages)
    .eq('status', 'pending')
    .select('id', { count: 'exact', head: false });
  console.log(`Cancelled ${cancelCount || 0} pending items from paused pages\n`);

  // Insert 15 topics for tech_pulse_africa
  let queued = 0;
  for (const topic of TOPICS) {
    const videoPrompt = buildVideoPrompt(topic.title);
    const { data: item, error } = await supabase.from('dev_content_queue').insert({
      page_id: 'tech_pulse_africa_dev',
      pillar: topic.pillar,
      engine: 'seedance-1.5',
      input_data: {
        page_name: 'Tech Pulse Africa',
        topic_title: topic.title,
        video_prompt: videoPrompt,
        provider: 'laser-focus-preload',
        tier: topic.tier,
        niche_score: topic.priority,
      },
      status: 'pending',
    }).select().single();
    if (error) { console.log(`  ✗ ${topic.title.substring(0, 50)}: ${error.message}`); continue; }
    queued++;
    console.log(`  ✓ [T${topic.tier} p${topic.priority}] ${topic.title.substring(0, 55)} (${item.id.substring(0, 8)})`);
  }

  console.log(`\n${queued}/${TOPICS.length} topics queued`);
  console.log('\nNext: cron at 05:00 UTC will automatically pick up 4 highest-priority');
  console.log('topics per cycle for tech_pulse_africa. Manual trigger also possible.');
}

function buildVideoPrompt(title) {
  // Convert topic title → a richer prompt for Seedance
  return `${title}. Cinematic documentary style with South African context. Shots of Johannesburg skyline, Cape Town, Durban, modern African cities, technology centers, server rooms, economic districts. Golden hour lighting, drone shots, close-ups of money, tech devices, news graphics. No people, environments and objects only.`;
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
