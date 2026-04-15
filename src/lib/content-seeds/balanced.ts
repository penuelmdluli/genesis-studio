/**
 * Shared seed-mix logic — used by both the manual `preload-topics.js` script
 * and the new `/api/cron/auto-seed` cron so we have ONE source of truth
 * for content seeds across the 4 pillars.
 */

import { createSupabaseAdmin } from "@/lib/supabase";

export type PillarStyle = "war" | "ai" | "sa" | "human";

export interface SeedTopic {
  title: string;
  tier: 1 | 2;
  pillar: string;
  priority: number; // 1-10 — boosted by +50 when inserted so seeds beat NewsAPI
  style: PillarStyle;
}

export const BALANCED_SEEDS: SeedTopic[] = [
  // ═══ WAR / GEOPOLITICS (15) ═══
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

  // ═══ AI DISRUPTION (10) ═══
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

  // ═══ SOUTH AFRICA NEWS (10) ═══
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

  // ═══ HUMAN INTEREST (5) ═══
  { title: 'The South African who built an empire from zero at 22', tier: 1, pillar: 'motivation', priority: 10, style: 'human' },
  { title: "From township to billionaire — one SA entrepreneur's story", tier: 1, pillar: 'motivation', priority: 10, style: 'human' },
  { title: 'The nurse who saved 1000 lives in one week', tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
  { title: "A 15-year-old SA girl just cured something scientists couldn't", tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
  { title: 'The street vendor who became a millionaire overnight', tier: 2, pillar: 'motivation', priority: 9, style: 'human' },
];

const VISUAL_PROMPTS: Record<PillarStyle, string> = {
  war: 'Cinematic war documentary style. Dramatic battlefield footage, military tanks rolling through deserts, fighter jets across skies, naval destroyers at sea, missile launches at dusk, destroyed buildings with smoke, aerial drone shots of conflict zones, war rooms with maps and screens, soldiers in tactical gear, parliament buildings, flags, nuclear submarines, satellite imagery. Dark moody grade with orange-teal contrast, volumetric light through smoke, Deakins-level cinematography. No individual faces, no text overlays — pure photorealistic documentary.',
  ai: 'Cinematic tech documentary style. Server rooms with blinking racks, humanoid robots, robot arms on factory floors, neural network overlays on cityscapes, empty open-plan offices, close-ups of AI chatbots on screens, glowing circuit boards, Johannesburg and Cape Town skylines with digital overlays. Moody blue-and-cyan lighting, volumetric light, shallow depth of field. No human faces, no text overlays — visuals only.',
  sa: 'Photorealistic South African documentary style. Johannesburg CBD and Sandton skylines, Cape Town Table Mountain and V&A Waterfront, Durban beachfront, township streets at golden hour, Eskom power stations with cooling towers, rand currency close-ups, parliament in Cape Town, load shedding silhouettes of candlelit homes, petrol pumps, supermarket aisles, ATMs. Rich warm tones for wealthy districts, muted tones for townships. Cinematic drone shots and street-level handheld. No individual faces, no text overlays.',
  human: 'Cinematic human-interest documentary style. Shots of hands building something, silhouettes at sunrise, hospital corridors with warm light, classrooms, township entrepreneurs in small shops, teenagers with laptops, markets bustling at dawn, graduation caps in the air, business meetings in modern offices. Warm golden hour lighting, shallow depth of field, emotional slow-motion, documentary cinematography. No specific faces visible, no text overlays — evocative environmental storytelling.',
};

export function buildVideoPromptForStyle(title: string, style: PillarStyle): string {
  return `${title}. ${VISUAL_PROMPTS[style]}`;
}

/**
 * Preload the balanced seed mix into dev_content_queue for a page.
 * Optionally filtered by style (e.g. only war topics if war is the proven winner).
 *
 * @param pageId - dev_content_queue page_id (e.g. "tech_pulse_africa_dev")
 * @param pageName - human-readable name (e.g. "Tech Pulse Africa")
 * @param styles - which styles to include; default all 4
 * @param boostPriority - seeds get +50 score so they beat NewsAPI (~30)
 */
export async function preloadSeeds(
  pageId: string,
  pageName: string,
  styles: PillarStyle[] = ["war", "ai", "sa", "human"],
  boostPriority = 50,
): Promise<{ queued: number; cancelled: number }> {
  const supabase = createSupabaseAdmin();

  // 1. Cancel existing pending seeds for this page — fresh slate
  const { data: existing } = await supabase
    .from("dev_content_queue")
    .select("id, input_data")
    .eq("page_id", pageId)
    .eq("status", "pending");
  const toCancel = (existing || []).filter(
    (r) => r.input_data?.provider === "balanced-recovery" || r.input_data?.provider === "war-pulse" || r.input_data?.provider === "ai-apocalypse-pulse" || r.input_data?.provider === "laser-focus-preload"
  );
  if (toCancel.length > 0) {
    await supabase
      .from("dev_content_queue")
      .update({ status: "cancelled" })
      .in("id", toCancel.map((r) => r.id));
  }

  // 2. Insert fresh seeds matching the requested styles
  const filtered = BALANCED_SEEDS.filter((t) => styles.includes(t.style));
  let queued = 0;
  for (const topic of filtered) {
    const { error } = await supabase.from("dev_content_queue").insert({
      page_id: pageId,
      pillar: topic.pillar,
      engine: "seedance-1.5",
      input_data: {
        page_name: pageName,
        topic_title: topic.title,
        video_prompt: buildVideoPromptForStyle(topic.title, topic.style),
        provider: "balanced-recovery",
        tier: topic.tier,
        niche_score: boostPriority + topic.priority,
        content_style: topic.style,
      },
      status: "pending",
    });
    if (!error) queued++;
  }
  return { queued, cancelled: toCancel.length };
}
