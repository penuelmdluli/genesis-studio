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

// ──────────────────────────────────────────────────────────────
// "AI APOCALYPSE PULSE" — 40-topic seed list for Tech Pulse Africa
// All topics map to the same visual motif bucket (servers, robots,
// code, data centers, empty offices) so both Seedance and stock
// footage produce topic-aligned visuals.
// ──────────────────────────────────────────────────────────────
const TOPICS = [
  // ═══════════════════════════════════════════════════════
  // PILLAR 1 — "AI IS REPLACING [JOB]" (12 topics, 3x/week)
  // ═══════════════════════════════════════════════════════
  { title: 'AI just replaced 3000 call center agents in Johannesburg', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'This is why junior lawyers in South Africa are panicking', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'AI is replacing graphic designers — and clients do not care', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'Radio DJs in South Africa are being quietly replaced by AI voices', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'AI accountants are now cheaper than human ones in SA', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'Teachers in South Africa will be replaced — here is the proof', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'Your doctor is already being replaced and you did not know', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'AI just wrote a BEE compliance report better than a consultant', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: '5 BPO jobs in South Africa that disappear next year', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'Bank tellers are gone — here is what is replacing them', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: 'AI is taking over journalism in South Africa — no one is talking about it', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: 'Data entry jobs are dead — 100000 South Africans affected', tier: 2, pillar: 'ai_disruption', priority: 8 },

  // ═══════════════════════════════════════════════════════
  // PILLAR 2 — "AI JUST DID SOMETHING TERRIFYING" (10 topics, 2x/week)
  // ═══════════════════════════════════════════════════════
  { title: 'AI just passed the South African bar exam — with a distinction', tier: 1, pillar: 'ai_news', priority: 10 },
  { title: 'A new AI just cloned a South African voice in 3 seconds', tier: 1, pillar: 'ai_news', priority: 10 },
  { title: 'This AI can predict which South Africans will get sick next year', tier: 1, pillar: 'ai_news', priority: 9 },
  { title: 'AI just wrote an entire SONA speech and experts could not tell', tier: 1, pillar: 'ai_news', priority: 9 },
  { title: 'Deepfake of Cyril Ramaphosa fooled 8 million people in one day', tier: 1, pillar: 'ai_news', priority: 10 },
  { title: 'A robot just beat the best chess player in Johannesburg', tier: 2, pillar: 'ai_news', priority: 8 },
  { title: 'AI just read your WhatsApp and knew your next move', tier: 2, pillar: 'ai_news', priority: 8 },
  { title: 'This AI knows your credit score before you apply for a loan', tier: 2, pillar: 'ai_news', priority: 8 },
  { title: 'AI trained on South African matric papers — results will shock you', tier: 2, pillar: 'ai_news', priority: 7 },
  { title: 'A chatbot just diagnosed a rare disease three doctors missed', tier: 2, pillar: 'ai_news', priority: 8 },

  // ═══════════════════════════════════════════════════════
  // PILLAR 3 — "YOUR AI-PROOF CAREER" (6 topics, 1x/week)
  // ═══════════════════════════════════════════════════════
  { title: '3 jobs in South Africa that AI cannot touch — yet', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'How to survive the AI takeover — from a Cape Town developer', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'The one skill every South African must learn before 2027', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'Why plumbers and electricians will outearn software engineers', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: 'The AI-proof side hustle paying R30 000 a month in SA', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: '5 careers that will double in value when AI takes over', tier: 2, pillar: 'ai_disruption', priority: 7 },

  // ═══════════════════════════════════════════════════════
  // PILLAR 4 — "AFRICA'S AI MOMENT" (6 topics, 1x/week)
  // ═══════════════════════════════════════════════════════
  { title: 'A Kenyan startup just built the AI that Silicon Valley is copying', tier: 1, pillar: 'ai_news', priority: 10 },
  { title: 'Nigeria now trains more AI engineers than the UK', tier: 1, pillar: 'ai_news', priority: 9 },
  { title: 'This Johannesburg fintech uses AI to catch fraud in 2 seconds', tier: 1, pillar: 'ai_news', priority: 9 },
  { title: 'A South African teen built an AI — Microsoft came calling', tier: 2, pillar: 'ai_news', priority: 8 },
  { title: 'Cape Town is becoming the AI capital of Africa — the data proves it', tier: 2, pillar: 'ai_news', priority: 8 },
  { title: 'Ghana just launched the first African-owned language AI', tier: 2, pillar: 'ai_news', priority: 7 },

  // ═══════════════════════════════════════════════════════
  // PILLAR 5 — "HOW THE RICH USE AI" (6 topics, 1x/week)
  // ═══════════════════════════════════════════════════════
  { title: 'How rich South Africans are using AI to 10x their income', tier: 1, pillar: 'ai_disruption', priority: 10 },
  { title: 'The AI tool that millionaire traders in Sandton use every day', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'AI is making rich people richer — here is how', tier: 1, pillar: 'ai_disruption', priority: 9 },
  { title: 'How a Joburg entrepreneur uses AI to run 4 businesses alone', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: 'Wealthy families are hiring AI tutors instead of human ones', tier: 2, pillar: 'ai_disruption', priority: 8 },
  { title: 'The AI side hustle quietly making R200 000 a month in SA', tier: 2, pillar: 'ai_disruption', priority: 8 },
];

async function run() {
  console.log(`=== PRELOADING ${TOPICS.length} AI-DISRUPTION TOPICS TO tech_pulse_africa ===\n`);

  // 1. Cancel any pending items on OTHER pages (laser-focus strategy)
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

  // 2. Cancel any STALE off-theme pending items on tech_pulse_africa
  //    (the celebrity / gaming / non-AI topics from the NewsAPI fetcher).
  //    Only keep existing 'laser-focus-preload' or 'ai' pillar items.
  const { data: existing } = await supabase
    .from('dev_content_queue')
    .select('id, input_data, pillar')
    .eq('page_id', 'tech_pulse_africa_dev')
    .eq('status', 'pending');
  const stale = (existing || []).filter((row) => {
    const pillar = row.pillar || '';
    const provider = row.input_data?.provider || '';
    // Keep AI-pillar OR laser-focus-preload items; cancel everything else
    if (pillar.startsWith('ai_')) return false;
    if (provider === 'laser-focus-preload') return false;
    return true;
  });
  if (stale.length > 0) {
    await supabase
      .from('dev_content_queue')
      .update({ status: 'cancelled' })
      .in('id', stale.map((s) => s.id));
    console.log(`Cancelled ${stale.length} stale off-theme pending items on tech_pulse_africa\n`);
  }

  // 3. Insert the new 40 topics
  let queued = 0;
  for (const topic of TOPICS) {
    const videoPrompt = buildVideoPrompt(topic.title, topic.pillar);
    const { data: item, error } = await supabase.from('dev_content_queue').insert({
      page_id: 'tech_pulse_africa_dev',
      pillar: topic.pillar,
      engine: 'seedance-1.5',
      input_data: {
        page_name: 'Tech Pulse Africa',
        topic_title: topic.title,
        video_prompt: videoPrompt,
        provider: 'ai-apocalypse-pulse',
        tier: topic.tier,
        niche_score: topic.priority,
      },
      status: 'pending',
    }).select().single();
    if (error) { console.log(`  ✗ ${topic.title.substring(0, 50)}: ${error.message}`); continue; }
    queued++;
    console.log(`  ✓ [T${topic.tier} p${topic.priority}] ${topic.title.substring(0, 60)} (${item.id.substring(0, 8)})`);
  }

  console.log(`\n${queued}/${TOPICS.length} topics queued for Tech Pulse Africa`);
  console.log('\nCron will pick 1 best-scored item per page per cycle (2x/day SAST peaks).');
}

function buildVideoPrompt(title, pillar) {
  // Visual prompt tailored to the AI-disruption motif bucket.
  // Every scene gets server racks, robots, code, glowing circuits — never people.
  const base = 'Cinematic tech documentary style with African context. Server rooms with blinking racks, humanoid robots, neural network overlays, empty open-plan offices, close-ups of AI chatbots on screens, glowing circuit boards, Johannesburg/Cape Town/Lagos skylines with digital overlays. Moody blue-and-cyan lighting, volumetric light, shallow depth of field. No human faces, no presenters, no text — visuals only.';
  return `${title}. ${base}`;
}

run().catch((e) => { console.error('FATAL:', e.message); process.exit(1); });
