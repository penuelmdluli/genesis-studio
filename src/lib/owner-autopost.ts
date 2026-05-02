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
    pageId: process.env.FB_TECH_PULSE_PAGE_ID || "100919755007786",
    tokenEnvKey: "FB_PAGE_TOKEN_tech_news",
  },
  africa_2050: {
    name: "Africa 2050",
    pageId: process.env.FB_AFRICA_2050_PAGE_ID || "104120995511039",
    tokenEnvKey: "FB_PAGE_TOKEN_limitless_you",
  },
};

// ── Marketing Descriptions ──
// Every post has: emotional hook → content → marketing CTA → link → hashtags
// The goal: viewers engage with the content AND discover Genesis Studio

const HOOKS = [
  "🚨 You won't believe this was made by AI",
  "⚡ This just dropped and the internet isn't ready",
  "🔥 WATCH THIS — AI just changed the game forever",
  "💥 BREAKING: This entire video was generated in 60 seconds",
  "👀 Stop scrolling. You NEED to see this",
  "🤯 AI just did something that shouldn't be possible",
  "🚀 The future of content is HERE — and it's African-made",
  "⚠️ Warning: After seeing this, you'll never create content the same way",
  "🎬 One prompt. 60 seconds. This is what came out",
  "💎 This is NOT stock footage. This is 100% AI-generated",
];

const CTAS = [
  "👇 Try it yourself — 50 FREE credits, no card needed",
  "🔗 Make your own at genesisstudio.app — it takes 60 seconds",
  "💡 Every creator in Africa needs this tool. Share this with someone who creates content",
  "🚀 Built in South Africa. Used by creators worldwide. Your turn",
  "✨ Stop paying for stock footage. Start creating with AI",
  "🎯 The #1 AI video tool for African creators — try it free today",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getMBSDescription(prompt: string): string {
  const hook = pickRandom(HOOKS);
  const cta = pickRandom(CTAS);

  return `${hook}

${prompt.slice(0, 200)}

${cta}

🔗 https://genesisstudio.app

#MzansiBabyStars #BabyDance #CuteKids #SouthAfrica #AIVideo #GenesisStudio #MadeWithAI #ViralVideo #DanceChallenge #Mzansi #AIGenerated #FYP`;
}

function getBrainStudioDescription(concept: string): string {
  const hook = pickRandom(HOOKS);
  const cta = pickRandom(CTAS);

  return `${hook}

${concept.slice(0, 300)}

🎬 Full AI production — script, voiceover, music & captions. All generated in minutes, not days.

${cta}

🔗 https://genesisstudio.app

#TechPulseAfrica #Africa2050 #AIVideo #GenesisStudio #AfricanTech #Innovation #MadeWithAI #BreakingNews #FutureOfAfrica #AIGenerated #ContentCreator #FYP`;
}

function getSingleVideoDescription(prompt: string): string {
  const hook = pickRandom(HOOKS);
  const cta = pickRandom(CTAS);

  return `${hook}

${prompt.slice(0, 250)}

${cta}

🔗 https://genesisstudio.app

#GenesisStudio #AIVideo #MadeWithAI #TextToVideo #AIGenerated #CreatorTools #AfricanCreators #ContentCreation #FYP #Viral`;
}

// ── Post to Facebook Page ──

const VIDEO_TITLES = [
  "🚨 This was made by AI in 60 seconds",
  "🔥 AI just created this — genesisstudio.app",
  "⚡ Made with Genesis Studio — try it FREE",
  "💥 AI Video Generation is HERE",
  "🤯 60 seconds. One prompt. This is the result.",
  "🎬 Genesis Studio — AI videos for creators",
  "🚀 The future of content creation is African-made",
  "👀 This entire video is AI-generated",
];

async function postToPage(
  page: FacebookPage,
  videoUrl: string,
  description: string,
  videoId?: string
): Promise<{ success: boolean; postId?: string; scheduled?: boolean; scheduledFor?: string; error?: string }> {
  const token = process.env[page.tokenEnvKey];
  if (!token || !page.pageId) {
    console.warn(`[OWNER-AUTOPOST] ${page.name}: missing pageId or token (${page.tokenEnvKey})`);
    return { success: false, error: "Page not configured" };
  }

  try {
    // Smart scheduling — check if we should post now or queue for later
    const { getPostingSlot, recordOwnerPost } = await import("@/lib/owner-scheduler");
    const slot = await getPostingSlot(page.pageId, page.name);
    console.log(`[OWNER-AUTOPOST] ${slot.reason}`);

    const params = new URLSearchParams({
      file_url: videoUrl,
      title: pickRandom(VIDEO_TITLES),
      description,
      access_token: token,
    });

    // If scheduling for later, use Facebook's scheduled_publish_time
    if (slot.action === "schedule" && slot.scheduledFor) {
      const unixTimestamp = Math.floor(slot.scheduledFor.getTime() / 1000);
      params.set("scheduled_publish_time", String(unixTimestamp));
      params.set("published", "false");
      console.log(`[OWNER-AUTOPOST] 📅 Scheduling ${page.name} post for ${slot.scheduledFor.toISOString()}`);
    }

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
    const postId = data.post_id || data.id;
    const isScheduled = slot.action === "schedule";

    console.log(`[OWNER-AUTOPOST] ${isScheduled ? "📅 Scheduled" : "✅ Posted"} to ${page.name}: ${postId}`);

    // Record the post for future scheduling decisions
    recordOwnerPost(
      page.pageId, page.name, postId, videoId || "",
      isScheduled ? "scheduled" : "posted",
      slot.scheduledFor
    ).catch(() => {});

    // Auto-comment (only on immediate posts — scheduled posts get commented when they go live)
    if (!isScheduled) {
      try {
        const { postMarketingComments } = await import("@/lib/social/facebook-comments");
        postMarketingComments(postId, token).catch((e) =>
          console.error(`[OWNER-AUTOPOST] Comments failed on ${page.name}:`, e)
        );
      } catch {
        // Comments are non-critical
      }
    }

    return {
      success: true,
      postId,
      scheduled: isScheduled,
      scheduledFor: slot.scheduledFor?.toISOString(),
    };
  } catch (err) {
    console.error(`[OWNER-AUTOPOST] ${page.name} error:`, err);
    return { success: false, error: String(err) };
  }
}

// ── Cross-Platform Posting ──

async function postToYouTube(videoUrl: string, prompt: string): Promise<void> {
  try {
    const { isYouTubeConfigured, uploadToYouTubeShorts } = await import("@/lib/social/youtube");
    if (!isYouTubeConfigured()) return;

    const title = prompt.slice(0, 80);
    const description = getSingleVideoDescription(prompt);
    const tags = ["GenesisStudio", "AIVideo", "MadeWithAI", "Shorts", "AIGenerated", "AfricanCreators"];

    const result = await uploadToYouTubeShorts({ videoUrl, title, description, tags });
    if (result.success) {
      console.log(`[OWNER-AUTOPOST] ✅ YouTube Short: ${result.youtubeVideoId}`);
    } else {
      console.warn(`[OWNER-AUTOPOST] YouTube failed: ${result.error}`);
    }
  } catch (err) {
    console.error("[OWNER-AUTOPOST] YouTube error:", err);
  }
}

async function postToTikTokPlatform(videoUrl: string, prompt: string): Promise<void> {
  try {
    const { isTikTokConfigured, postToTikTok } = await import("@/lib/social/tiktok");
    if (!isTikTokConfigured()) return;

    const hashtags = ["GenesisStudio", "AIVideo", "MadeWithAI", "FYP", "AIGenerated", "AfricanCreators", "Viral"];
    const result = await postToTikTok({ videoUrl, title: prompt.slice(0, 100), hashtags });
    if (result.success) {
      console.log(`[OWNER-AUTOPOST] ✅ TikTok: ${result.shareId}`);
    } else {
      console.warn(`[OWNER-AUTOPOST] TikTok failed: ${result.error}`);
    }
  } catch (err) {
    console.error("[OWNER-AUTOPOST] TikTok error:", err);
  }
}

/**
 * Post to all configured platforms (YouTube + TikTok).
 * Fire-and-forget — doesn't block Facebook posting.
 */
async function crossPostToAllPlatforms(videoUrl: string, prompt: string): Promise<void> {
  await Promise.allSettled([
    postToYouTube(videoUrl, prompt),
    postToTikTokPlatform(videoUrl, prompt),
  ]);
}

// ── Public API ──

/**
 * Auto-post a Mimic Motion / MBS video to all platforms.
 * Facebook (MBS page) + YouTube Shorts + TikTok.
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

  // Facebook (smart scheduled)
  await postToPage(PAGES.mbs, videoUrl, description);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, prompt).catch(() => {});
}

/**
 * Auto-post a Brain Studio production to all platforms.
 * Facebook (Tech Pulse + Africa 2050) + YouTube Shorts + TikTok.
 * Only for owner accounts.
 */
export async function autoPostBrainToPages(
  userId: string,
  videoUrl: string,
  concept: string
): Promise<void> {
  const { createSupabaseAdmin } = await import("@/lib/supabase");
  const sb = createSupabaseAdmin();
  const { data } = await sb.from("users").select("clerk_id").eq("id", userId).single();
  if (!data?.clerk_id || !isOwnerClerkId(data.clerk_id)) return;

  const description = getBrainStudioDescription(concept);

  // Facebook pages (smart scheduled)
  await Promise.allSettled([
    postToPage(PAGES.tech_pulse, videoUrl, description),
    postToPage(PAGES.africa_2050, videoUrl, description),
  ]);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, concept).catch(() => {});
}

/**
 * Auto-post a single generation to all platforms.
 * Facebook (Tech Pulse) + YouTube Shorts + TikTok.
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

  // Facebook (smart scheduled)
  await postToPage(PAGES.tech_pulse, videoUrl, description);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, prompt).catch(() => {});
}
