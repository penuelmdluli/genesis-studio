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
// "WAR PULSE" — 40-topic seed list for Tech Pulse Africa
//
// Data-driven: our top-performing post was "Iran halts Strait of Hormuz"
// (1933 reach, 19.5s avg watch, 89 engagement) — clearly war/geopolitics
// wins on this page. All 40 topics are war, conflict, or military-focused
// with high visual alignment (tanks, missiles, cities, maps, leaders).
// ─────────────────────────────────────────────────────────────────────

const TOPICS = [
  // ═══════════════════════════════════════════════════════════
  // PILLAR 1 — MAJOR CONFLICT HOTSPOTS (12 topics)
  // ═══════════════════════════════════════════════════════════
  { title: 'Iran just did something that could spark World War 3', tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'China is preparing for war — South Africa must pick a side', tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: "Russia's next move will shock the world — the plan leaked", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'Israel just crossed a red line in Gaza', tier: 1, pillar: 'breaking_news', priority: 10 },
  { title: "Ukraine's hidden weapon is why Russia is losing", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'The Taiwan invasion is closer than you think', tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: "North Korea's new missile can reach America", tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "NATO's secret plan if China attacks Taiwan", tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "Iran's oil tanker blockade — world economies at risk", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: "Putin's inner circle is panicking — here is why", tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "Israel's AI-powered drone is changing modern war", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "China's hypersonic missile just broke world records", tier: 2, pillar: 'geopolitics', priority: 8 },

  // ═══════════════════════════════════════════════════════════
  // PILLAR 2 — AFRICAN CONFLICTS (8 topics)
  // ═══════════════════════════════════════════════════════════
  { title: "Sudan's civil war — South Africans are being evacuated", tier: 1, pillar: 'breaking_news', priority: 10 },
  { title: "Nigeria's military just captured a top jihadist leader", tier: 1, pillar: 'breaking_news', priority: 9 },
  { title: 'The DRC conflict nobody is talking about', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "Ethiopia vs Egypt — Africa's next big war over the Nile", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'How African mercenaries are fighting in Ukraine', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "Libya's new civil war — oil prices set to skyrocket", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "Mozambique's secret insurgency — South Africa's neighbor at war", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "Central Africa's silent war — the numbers will shock you", tier: 2, pillar: 'geopolitics', priority: 7 },

  // ═══════════════════════════════════════════════════════════
  // PILLAR 3 — MILITARY TECH & WEAPONS (10 topics)
  // ═══════════════════════════════════════════════════════════
  { title: 'The new weapon that could end all wars forever', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "America's stealth bomber that terrifies China", tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: "Russia's nuclear submarine that vanished for 6 months", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: 'This $2 drone just destroyed a $10 million tank', tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: "South Africa's secret weapons program — exposed", tier: 1, pillar: 'geopolitics', priority: 10 },
  { title: "Israel's Iron Dome — how it really stops missiles", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "China's laser weapon that shoots missiles out of the sky", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "Turkey's killer drone is dominating African wars", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "The world's most dangerous spy satellite — revealed", tier: 2, pillar: 'geopolitics', priority: 7 },
  { title: 'Hypersonic missiles — the war changers nobody can stop', tier: 2, pillar: 'geopolitics', priority: 8 },

  // ═══════════════════════════════════════════════════════════
  // PILLAR 4 — SANCTIONS & ECONOMIC WARFARE (5 topics)
  // ═══════════════════════════════════════════════════════════
  { title: "How sanctions are quietly crushing Russia's economy", tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: 'Iran just dumped the US dollar — markets are panicking', tier: 1, pillar: 'breaking_news', priority: 10 },
  { title: "China's war chest is ready — the numbers are terrifying", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: "South Africa's BRICS bet — risky genius or disaster", tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: 'The oil war nobody is reporting — and who wins', tier: 2, pillar: 'geopolitics', priority: 8 },

  // ═══════════════════════════════════════════════════════════
  // PILLAR 5 — HISTORY & LESSONS (5 topics)
  // ═══════════════════════════════════════════════════════════
  { title: 'Why the Afghanistan war will happen all over again', tier: 2, pillar: 'geopolitics', priority: 7 },
  { title: '5 wars the United States secretly lost', tier: 2, pillar: 'geopolitics', priority: 8 },
  { title: 'How Africa became the next great war battleground', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: 'The Cold War 2.0 is already here — and we are losing', tier: 1, pillar: 'geopolitics', priority: 9 },
  { title: 'What happens to South Africa if World War 3 starts', tier: 1, pillar: 'geopolitics', priority: 10 },
];

async function run() {
  console.log(`=== PRELOADING ${TOPICS.length} WAR-PULSE TOPICS TO tech_pulse_africa ===\n`);

  // 1. Cancel pending items on OTHER pages (laser-focus strategy)
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

  // 2. Cancel existing pending items on tech_pulse_africa (both AI-apocalypse seeds
  //    and NewsAPI-sourced items). We're replacing the whole seed queue.
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

  // 3. Insert 40 war topics with BOOSTED priority (+50 baseline so they beat NewsAPI scores)
  let queued = 0;
  for (const topic of TOPICS) {
    const videoPrompt = buildVideoPrompt(topic.title, topic.pillar);
    // Boost niche_score so seeds always beat whatever NewsAPI fetches (+50)
    const boostedScore = 50 + topic.priority;
    const { data: item, error } = await supabase.from('dev_content_queue').insert({
      page_id: 'tech_pulse_africa_dev',
      pillar: topic.pillar,
      engine: 'seedance-1.5',
      input_data: {
        page_name: 'Tech Pulse Africa',
        topic_title: topic.title,
        video_prompt: videoPrompt,
        provider: 'war-pulse',
        tier: topic.tier,
        niche_score: boostedScore,
      },
      status: 'pending',
    }).select().single();
    if (error) { console.log(`  ✗ ${topic.title.substring(0, 50)}: ${error.message}`); continue; }
    queued++;
    console.log(`  ✓ [T${topic.tier} p${boostedScore}] ${topic.title.substring(0, 68)} (${item.id.substring(0, 8)})`);
  }

  console.log(`\n${queued}/${TOPICS.length} war topics queued for Tech Pulse Africa`);
  console.log('\nCron runs 1x/day at 17:30 UTC (19:30 SAST) — recovery mode.');
}

function buildVideoPrompt(title, pillar) {
  // War-themed visuals — battlefields, tanks, military vehicles, cities,
  // maps, politicians, aircraft carriers. No specific faces (avatar risk).
  const base = 'Cinematic war documentary style. Dramatic battlefield footage, military tanks rolling through deserts, fighter jets screaming across skies, naval destroyers at sea, missile launches at dusk, destroyed buildings and smoke, aerial drone shots of conflict zones, war rooms with maps and screens, soldiers in tactical gear, political leaders at press conferences, parliament buildings, flags waving, nuclear submarines, hypersonic missiles, satellite imagery. Dark moody color grade with orange-teal contrast, volumetric light through smoke and dust, slow-motion shots, Deakins-level cinematography. No individual faces visible, no text overlays, no animation — pure photorealistic documentary.';
  return `${title}. ${base}`;
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
