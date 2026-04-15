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

// ─────────────────────────────────────────────────────────────────────
// BALANCED SEED MIX — 40 topics across 4 pillars (recovery strategy)
//
// Honest reading of the data: n=1 isn't a signal. Iran/Hormuz's 1933
// reach may have been topic OR timing. We need diversity during the
// recovery window so we can see which cluster actually drives engagement
// once the page lifts out of throttle.
//
// Distribution:
//   15 WAR / GEOPOLITICS  — our anchor (Iran/Hormuz evidence)
//   10 AI DISRUPTION      — Tech Pulse Africa brand-fit + viral pattern
//   10 SOUTH AFRICA NEWS  — local relevance (loadshedding, rand, crime)
//    5 HUMAN INTEREST     — emotional / shareable / counter-programming
// ─────────────────────────────────────────────────────────────────────

const TOPICS = [
  // ═══════════════════════════════════════════════════════════════
  // PILLAR 1 — WAR / GEOPOLITICS (15 topics)
  // ═══════════════════════════════════════════════════════════════
  { title: 'What happens to South Africa if World War 3 starts', tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "Iran's oil tanker blockade — world economies at risk", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: 'China is preparing for war — South Africa must pick a side', tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "Russia's nuclear submarine that vanished for 6 months", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: 'This $2 drone just destroyed a $10 million tank', tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "South Africa's secret weapons program — exposed", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "Ethiopia vs Egypt — Africa's next big war over the Nile", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "Sudan's civil war — South Africans are being evacuated", tier: 1, pillar: 'breaking_news', priority: 10, style: 'war' },
  { title: 'Iran just did something that could spark World War 3', tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: "Ukraine's hidden weapon is why Russia is losing", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },
  { title: 'How Africa became the next great war battleground', tier: 1, pillar: 'geopolitics', priority: 9, style: 'war' },
  { title: "NATO's secret plan if China attacks Taiwan", tier: 1, pillar: 'geopolitics', priority: 9, style: 'war' },
  { title: 'The Cold War 2.0 is already here — and we are losing', tier: 1, pillar: 'geopolitics', priority: 9, style: 'war' },
  { title: "America's stealth bomber that terrifies China", tier: 1, pillar: 'geopolitics', priority: 9, style: 'war' },
  { title: "Russia's next move will shock the world — the plan leaked", tier: 1, pillar: 'geopolitics', priority: 10, style: 'war' },

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 2 — AI DISRUPTION (10 topics)
  // ═══════════════════════════════════════════════════════════════
  { title: 'AI just replaced 3000 call center agents in Johannesburg', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: 'This is why junior lawyers in South Africa are panicking', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: 'AI is replacing graphic designers — and clients do not care', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: 'Your doctor is already being replaced and you did not know', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: '5 BPO jobs in South Africa that disappear next year', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: 'Deepfake of Cyril Ramaphosa fooled 8 million people in one day', tier: 1, pillar: 'ai_news', priority: 10, style: 'ai' },
  { title: 'A new AI just cloned a South African voice in 3 seconds', tier: 1, pillar: 'ai_news', priority: 10, style: 'ai' },
  { title: 'How rich South Africans are using AI to 10x their income', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: '3 jobs in South Africa that AI cannot touch — yet', tier: 1, pillar: 'ai_disruption', priority: 10, style: 'ai' },
  { title: 'Teachers in South Africa will be replaced — here is the proof', tier: 1, pillar: 'ai_disruption', priority: 9, style: 'ai' },

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 3 — SOUTH AFRICA NEWS (10 topics)
  // ═══════════════════════════════════════════════════════════════
  { title: 'Load shedding is back — but this time it is worse', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'South African rand just crashed — here is what it means', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'Eskom exposed — where did R40 billion really go', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'South Africans are leaving the country — the real numbers', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'The hidden cost of BEE nobody talks about', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'SARS is watching your bank account — here is how', tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'Why petrol prices in SA will double by 2027', tier: 1, pillar: 'breaking_news', priority: 9, style: 'sa' },
  { title: 'ANC vs DA — who really runs the Government of National Unity', tier: 1, pillar: 'geopolitics', priority: 9, style: 'sa' },
  { title: "South Africa's crime stats — the truth they hide from you", tier: 1, pillar: 'breaking_news', priority: 10, style: 'sa' },
  { title: 'Your VAT increase explained — who really pays', tier: 1, pillar: 'breaking_news', priority: 9, style: 'sa' },

  // ═══════════════════════════════════════════════════════════════
  // PILLAR 4 — HUMAN INTEREST (5 topics)
  // ═══════════════════════════════════════════════════════════════
  { title: 'The South African who built an empire from zero at 22', tier: 1, pillar: 'motivation', priority: 10, style: 'human' },
  { title: "From township to billionaire — one SA entrepreneur's story", tier: 1, pillar: 'motivation', priority: 10, style: 'human' },
  { title: 'The nurse who saved 1000 lives in one week', tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
  { title: "A 15-year-old SA girl just cured something scientists couldn't", tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
  { title: 'The street vendor who became a millionaire overnight', tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
];

async function run() {
  console.log(`=== PRELOADING ${TOPICS.length}-TOPIC BALANCED MIX TO tech_pulse_africa ===\n`);
  const counts = TOPICS.reduce((acc, t) => { acc[t.style] = (acc[t.style] || 0) + 1; return acc; }, {});
  console.log(`Distribution: war=${counts.war}, ai=${counts.ai}, sa=${counts.sa}, human=${counts.human}\n`);

  // 1. Cancel pending items on OTHER pages (laser-focus)
  const otherPages = [
    'mzansi_baby_stars',
    'africa_2050', 'africa_2050_dev',
    'afrika_toons_dev',
    'world_news_animated_dev',
    'pop_culture_buzz_dev',
    'ai_revolution_dev',
  ];
  const { count: cancelCount } = await supabase
    .from('dev_content_queue')
    .update({ status: 'cancelled' })
    .in('page_id', otherPages)
    .eq('status', 'pending')
    .select('id', { count: 'exact', head: false });
  console.log(`Cancelled ${cancelCount || 0} pending items from paused pages\n`);

  // 2. Cancel existing pending items on tech_pulse_africa — fresh slate
  const { data: existing } = await supabase
    .from('dev_content_queue')
    .select('id')
    .eq('page_id', 'tech_pulse_africa_dev')
    .eq('status', 'pending');
  if (existing && existing.length > 0) {
    await supabase
      .from('dev_content_queue')
      .update({ status: 'cancelled' })
      .in('id', existing.map((r) => r.id));
    console.log(`Cancelled ${existing.length} existing pending items on tech_pulse_africa\n`);
  }

  // 3. Insert the 40 balanced topics
  let queued = 0;
  for (const topic of TOPICS) {
    const videoPrompt = buildVideoPrompt(topic.title, topic.style);
    const boostedScore = 50 + topic.priority; // seeds always beat NewsAPI
    const { data: item, error } = await supabase.from('dev_content_queue').insert({
      page_id: 'tech_pulse_africa_dev',
      pillar: topic.pillar,
      engine: 'seedance-1.5',
      input_data: {
        page_name: 'Tech Pulse Africa',
        topic_title: topic.title,
        video_prompt: videoPrompt,
        provider: 'balanced-recovery',
        tier: topic.tier,
        niche_score: boostedScore,
        content_style: topic.style,
      },
      status: 'pending',
    }).select().single();
    if (error) { console.log(`  ✗ ${topic.title.substring(0, 50)}: ${error.message}`); continue; }
    queued++;
    const emoji = { war: '⚔️', ai: '🤖', sa: '🇿🇦', human: '❤️' }[topic.style] || '•';
    console.log(`  ${emoji} [T${topic.tier} p${boostedScore}] ${topic.title.substring(0, 70)} (${item.id.substring(0, 8)})`);
  }

  console.log(`\n${queued}/${TOPICS.length} topics queued for Tech Pulse Africa`);
  console.log('Cron runs 1x/day at 17:30 UTC (19:30 SAST) — recovery mode.');
  console.log('\nAfter ~14 days (14 posts), we will have real data to pick a winning pillar.');
}

// ─────────────────────────────────────────────────────────────────────
// Pillar-specific visual prompts — each style routes to its own motif
// bucket so scenes look on-theme for the topic.
// ─────────────────────────────────────────────────────────────────────
function buildVideoPrompt(title, style) {
  const PROMPTS = {
    war: 'Cinematic war documentary style. Dramatic battlefield footage, military tanks rolling through deserts, fighter jets across skies, naval destroyers at sea, missile launches at dusk, destroyed buildings with smoke, aerial drone shots of conflict zones, war rooms with maps and screens, soldiers in tactical gear, parliament buildings, flags, nuclear submarines, satellite imagery. Dark moody grade with orange-teal contrast, volumetric light through smoke, Deakins-level cinematography. No individual faces, no text overlays — pure photorealistic documentary.',
    ai: 'Cinematic tech documentary style. Server rooms with blinking racks, humanoid robots, robot arms on factory floors, neural network overlays on cityscapes, empty open-plan offices, close-ups of AI chatbots on screens, glowing circuit boards, Johannesburg and Cape Town skylines with digital overlays. Moody blue-and-cyan lighting, volumetric light, shallow depth of field. No human faces, no text overlays — visuals only.',
    sa: 'Photorealistic South African documentary style. Johannesburg CBD and Sandton skylines, Cape Town Table Mountain and V&A Waterfront, Durban beachfront, township streets at golden hour, Eskom power stations with cooling towers, rand currency close-ups, parliament in Cape Town, load shedding silhouettes of candlelit homes, petrol pumps, supermarket aisles, ATMs. Rich warm tones for wealthy districts, muted tones for townships. Cinematic drone shots and street-level handheld. No individual faces, no text overlays.',
    human: 'Cinematic human-interest documentary style. Shots of hands building something, silhouettes at sunrise, hospital corridors with warm light, classrooms, township entrepreneurs in small shops, teenagers with laptops, markets bustling at dawn, graduation caps in the air, business meetings in modern offices. Warm golden hour lighting, shallow depth of field, emotional slow-motion, documentary cinematography. No specific faces visible, no text overlays — evocative environmental storytelling.',
  };
  const base = PROMPTS[style] || PROMPTS.war;
  return `${title}. ${base}`;
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
