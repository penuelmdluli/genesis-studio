/**
 * GENESIS STUDIO — Owner Auto-Post
 *
 * Automatically posts videos created by owner accounts to Facebook pages
 * with marketing strategy content (titles, hashtags, descriptions).
 *
 * Routing:
 * - Mimic Motion / MBS content → Mzansi Baby Stars page
 * - Brain Studio productions → Tech Pulse Africa + Africa 2050 pages
 * - Single generations → Tech Pulse Africa page
 */

import { isOwnerClerkId } from "@/lib/credits";
import { r2PublicUrl } from "@/lib/storage";

// ── Page Configuration ──
interface FacebookPage {
  name: string;
  pageId: string;
  tokenEnvKey: string;
}

const PAGES: Record<string, FacebookPage> = {
  mbs: {
    name: "Mzansi Baby Stars",
    pageId: process.env.FB_MBS_PAGE_ID || "112465853843545",
    tokenEnvKey: "FB_PAGE_TOKEN_mzansi_baby_stars",
  },
  tech_pulse: {
    name: "Tech Pulse Africa",
    pageId: process.env.FB_TECH_PULSE_PAGE_ID || "",
    tokenEnvKey: "FB_PAGE_TOKEN_tech_news",
  },
  africa_2050: {
    name: "Africa 2050",
    pageId: process.env.FB_AFRICA_2050_PAGE_ID || "",
    tokenEnvKey: "FB_PAGE_TOKEN_ai_money",
  },
};

// ── Marketing Descriptions ──

function getMBSDescription(prompt: string): string {
  const hashtags = "#MzansiBabyStars #BabyDance #CuteKids #SouthAfrica #AIVideo #GenesisStudio #MadeWithAI #ViralVideo #AfricanBabies #DanceChallenge";
  return `${prompt.slice(0, 200)}

${hashtags}

🎬 Created with Genesis Studio — AI Video Generation
🚀 Try it FREE: https://genesisstudio.app
✨ Make your own AI videos in 60 seconds!`;
}

function getBrainStudioDescription(concept: string): string {
  const hashtags = "#TechPulseAfrica #Africa2050 #AIVideo #GenesisStudio #AfricanTech #Innovation #MadeWithAI #AIGenerated #FutureOfAfrica #TechNews";
  return `${concept.slice(0, 300)}

${hashtags}

🎬 Full AI production — script, voiceover, music, captions
🚀 Made with Genesis Studio: https://genesisstudio.app
🌍 AI video generation for African creators`;
}

function getSingleVideoDescription(prompt: string): string {
  const hashtags = "#GenesisStudio #AIVideo #MadeWithAI #TextToVideo #AIGenerated #CreatorTools #VideoAI #AfricanCreators";
  return `${prompt.slice(0, 250)}

${hashtags}

🎬 Generated with Genesis Studio
🚀 Create your own: https://genesisstudio.app
✨ 50 free credits — no card needed`;
}

// ── Post to Facebook Page ──

async function postToPage(
  page: FacebookPage,
  videoUrl: string,
  description: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  const token = process.env[page.tokenEnvKey];
  if (!token || !page.pageId) {
    console.warn(`[OWNER-AUTOPOST] ${page.name}: missing pageId or token (${page.tokenEnvKey})`);
    return { success: false, error: "Page not configured" };
  }

  try {
    const params = new URLSearchParams({
      file_url: videoUrl,
      description,
      access_token: token,
    });

    const res = await fetch(
      `https://graph.facebook.com/v25.0/${page.pageId}/videos`,
      { method: "POST", body: params }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error(`[OWNER-AUTOPOST] ${page.name} failed (${res.status}):`, err.slice(0, 200));
      return { success: false, error: `FB API ${res.status}` };
    }

    const data = (await res.json()) as { id: string; post_id?: string };
    console.log(`[OWNER-AUTOPOST] ✅ Posted to ${page.name}: ${data.post_id || data.id}`);
    return { success: true, postId: data.post_id || data.id };
  } catch (err) {
    console.error(`[OWNER-AUTOPOST] ${page.name} error:`, err);
    return { success: false, error: String(err) };
  }
}

// ── Public API ──

/**
 * Auto-post a Mimic Motion / MBS video to the Mzansi Baby Stars page.
 * Only for owner accounts.
 */
export async function autoPostMimicToMBS(
  clerkId: string,
  videoR2Key: string,
  prompt: string
): Promise<void> {
  if (!isOwnerClerkId(clerkId)) return;

  const videoUrl = r2PublicUrl(videoR2Key);
  const description = getMBSDescription(prompt);

  await postToPage(PAGES.mbs, videoUrl, description);
}

/**
 * Auto-post a Brain Studio production to Tech Pulse Africa and Africa 2050.
 * Only for owner accounts.
 */
export async function autoPostBrainToPages(
  userId: string,
  videoUrl: string,
  concept: string
): Promise<void> {
  // Look up clerk_id from userId
  const { createSupabaseAdmin } = await import("@/lib/supabase");
  const sb = createSupabaseAdmin();
  const { data } = await sb.from("users").select("clerk_id").eq("id", userId).single();
  if (!data?.clerk_id || !isOwnerClerkId(data.clerk_id)) return;

  const description = getBrainStudioDescription(concept);

  // Post to both pages in parallel
  const results = await Promise.allSettled([
    postToPage(PAGES.tech_pulse, videoUrl, description),
    postToPage(PAGES.africa_2050, videoUrl, description),
  ]);

  for (const r of results) {
    if (r.status === "rejected") {
      console.error("[OWNER-AUTOPOST] Brain post failed:", r.reason);
    }
  }
}

/**
 * Auto-post a single generation to Tech Pulse Africa.
 * Only for owner accounts.
 */
export async function autoPostSingleVideo(
  clerkId: string,
  videoR2Key: string,
  prompt: string
): Promise<void> {
  if (!isOwnerClerkId(clerkId)) return;

  const videoUrl = r2PublicUrl(videoR2Key);
  const description = getSingleVideoDescription(prompt);

  await postToPage(PAGES.tech_pulse, videoUrl, description);
}
