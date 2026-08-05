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
import { autoCommentOnPost } from "@/lib/owner-marketing";

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
  penuel: {
    name: "Penuel Mdluli",
    pageId: process.env.FB_PENUEL_PAGE_ID || "105512739117796",
    tokenEnvKey: "FB_PAGE_TOKEN_penuel",
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
  "🔗 Make your own at ivideostudio.ai — it takes 60 seconds",
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

🔗 https://ivideostudio.ai

#MzansiBabyStars #BabyDance #CuteKids #SouthAfrica #AIVideo #GenesisStudio #MadeWithAI #ViralVideo #DanceChallenge #Mzansi #AIGenerated #FYP`;
}

function getBrainStudioDescription(concept: string): string {
  const hook = pickRandom(HOOKS);
  const cta = pickRandom(CTAS);

  return `${hook}

${concept.slice(0, 300)}

🎬 Full AI production — script, voiceover, music & captions. All generated in minutes, not days.

${cta}

🔗 https://ivideostudio.ai

#TechPulseAfrica #Africa2050 #AIVideo #GenesisStudio #AfricanTech #Innovation #MadeWithAI #BreakingNews #FutureOfAfrica #AIGenerated #ContentCreator #FYP`;
}

function getSingleVideoDescription(prompt: string): string {
  const hook = pickRandom(HOOKS);
  const cta = pickRandom(CTAS);

  return `${hook}

${prompt.slice(0, 250)}

${cta}

🔗 https://ivideostudio.ai

#GenesisStudio #AIVideo #MadeWithAI #TextToVideo #AIGenerated #CreatorTools #AfricanCreators #ContentCreation #FYP #Viral`;
}

// ── Feature Announcement Templates ──
// Used when posting new feature launches & product marketing to the Penuel Mdluli page

interface FeatureInfo {
  name: string;
  description: string;
  videoUrl?: string;
  videoR2Key?: string;
}

const PRODUCT_HOOKS = [
  "New feature just dropped 🔥",
  "This changes EVERYTHING for content creators",
  "AI just levelled up — watch this",
  "We've been cooking... and it's finally ready",
  "This is what AI video looks like in 2026",
  "Every creator in Africa needs to see this",
  "Built different. Made in South Africa. For the world.",
  "AI video just got a MASSIVE upgrade",
  "Watch what this does in 60 seconds",
  "They said AI video was years away. It's HERE.",
];

const PRODUCT_CTAS = [
  "Try it yourself — 50 FREE credits, no card needed → ivideostudio.ai",
  "This is free to try. What are you waiting for? → ivideostudio.ai",
  "Share this with a creator who needs to see it 🔥",
  "Create YOUR own AI videos FREE → ivideostudio.ai",
  "New features dropping every week. Follow for more.",
  "Stop paying for stock footage. Start creating with AI → ivideostudio.ai",
];

const FEATURE_TEMPLATES: Record<string, (feature: FeatureInfo) => string> = {
  "motion-control": (f) => `${pickRandom(PRODUCT_HOOKS)}

🎭 NEW: Motion Control

Upload ANY photo + ANY dance/motion video → AI makes your character perform that exact motion.

TikTok dancer? Paste the URL. Instagram reel? Paste it. Your own video? Upload it.

The character moves exactly like the reference. Every step. Every gesture. Every vibe.

${pickRandom(PRODUCT_CTAS)}

🔗 https://ivideostudio.ai

#MotionControl #AIVideo #GenesisStudio #MadeWithAI #AfricanTech #ContentCreator #MadeInSA #Innovation #FYP #Viral #AIGenerated #MzansiBabyStars`,

  "react-studio": (f) => `${pickRandom(PRODUCT_HOOKS)}

🎬 NEW: React Studio

Insert yourself into ANY video scene. React with celebrities. Join the World Cup. Enter movie scenes.

Just upload your photo and describe where you want to be. AI does the rest.

${pickRandom(PRODUCT_CTAS)}

🔗 https://ivideostudio.ai

#ReactStudio #AIVideo #GenesisStudio #MadeWithAI #AfricanTech #ContentCreator #MadeInSA #Innovation #FYP #Viral #AIGenerated #MzansiBabyStars`,

  "ai-character": (f) => `${pickRandom(PRODUCT_HOOKS)}

🧑‍🎨 NEW: AI Character Generator

Don't have a photo? No problem. Describe ANY character — anime warrior, business mogul, superhero — and get 4 AI portraits to use in Motion Control.

No uploads. No photoshoots. Pure imagination → video.

${pickRandom(PRODUCT_CTAS)}

🔗 https://ivideostudio.ai

#AICharacter #AIVideo #GenesisStudio #MadeWithAI #AfricanTech #ContentCreator #MadeInSA #Innovation #FYP #Viral #AIGenerated #MzansiBabyStars`,

  "ai-singer": (f) => `${pickRandom(PRODUCT_HOOKS)}

🎤 NEW: AI Singer

Write lyrics → pick a music style → get a full music video with perfect lip-sync.

AI writes the melody. AI sings it. AI animates the face. You just bring the words.

${pickRandom(PRODUCT_CTAS)}

🔗 https://ivideostudio.ai

#AISinger #AIMusic #GenesisStudio #MadeWithAI #AfricanTech #MusicVideo #MadeInSA #Innovation #FYP #Viral #AIGenerated #MzansiBabyStars`,

  generic: (f) => `${pickRandom(PRODUCT_HOOKS)}

${f.name}: ${f.description.slice(0, 300)}

Built with love in South Africa. Used by creators worldwide.

${pickRandom(PRODUCT_CTAS)}

🔗 https://ivideostudio.ai

#GenesisStudio #AIVideo #MadeWithAI #AfricanTech #ContentCreator #MadeInSA #Innovation #FYP #Viral #AIGenerated #MzansiBabyStars`,
};

function getFeatureAnnouncementDescription(
  featureKey: string,
  feature: FeatureInfo
): string {
  const template = FEATURE_TEMPLATES[featureKey] || FEATURE_TEMPLATES.generic;
  return template(feature);
}

function getPersonalBrandDescription(prompt: string): string {
  const hook = pickRandom(PRODUCT_HOOKS);
  const cta = pickRandom(PRODUCT_CTAS);

  return `${hook}

${prompt.slice(0, 300)}

${cta}

🔗 https://ivideostudio.ai

#GenesisStudio #AIVideo #MadeWithAI #AfricanTech #MadeInSA #ContentCreator #MzansiBabyStars #AIGenerated #FYP #Viral`;
}

// ── Post to Facebook Page ──

const VIDEO_TITLES = [
  "🚨 This was made by AI in 60 seconds",
  "🔥 AI just created this — ivideostudio.ai",
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
  videoId?: string,
  prompt?: string
): Promise<{ success: boolean; postId?: string; scheduled?: boolean; scheduledFor?: string; error?: string }> {
  const token = process.env[page.tokenEnvKey];
  if (!token || !page.pageId) {
    console.warn(`[OWNER-AUTOPOST] ${page.name}: missing pageId or token (${page.tokenEnvKey})`);
    return { success: false, error: "Page not configured" };
  }

  try {
    const { recordOwnerPost } = await import("@/lib/owner-scheduler");

    // Publish IMMEDIATELY — post the video the moment it's created (no slots).
    const params = new URLSearchParams({
      file_url: videoUrl,
      title: pickRandom(VIDEO_TITLES),
      description,
      access_token: token,
      published: "true",
    });

    console.log(`[OWNER-AUTOPOST] 🚀 ${page.name}: publishing immediately`);

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

    console.log(`[OWNER-AUTOPOST] ✅ ${page.name}: posted ${postId}`);

    // Record as posted (also fires the Slack "✅ Video posted" alert)
    await recordOwnerPost(
      page.pageId, page.name, postId, videoId || "",
      "posted", new Date(), prompt
    ).catch(() => {});

    // Auto-comment with marketing + engagement right away (fire-and-forget)
    autoCommentOnPost(postId, token).catch(() => {});

    return { success: true, postId, scheduled: false };
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

  // Facebook — MBS page + Penuel Mdluli page
  await Promise.allSettled([
    postToPage(PAGES.mbs, videoUrl, description, undefined, prompt),
    postToPage(PAGES.penuel, videoUrl, description, undefined, prompt),
  ]);

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
  const { getDb } = await import("@/lib/db-driver");
  const sb = getDb();
  const { data } = await sb.from("users").select("clerk_id").eq("id", userId).single();
  if (!data?.clerk_id || !isOwnerClerkId(data.clerk_id)) return;

  const description = getBrainStudioDescription(concept);

  // Facebook pages (smart scheduled)
  await Promise.allSettled([
    postToPage(PAGES.tech_pulse, videoUrl, description, undefined, concept),
    postToPage(PAGES.africa_2050, videoUrl, description, undefined, concept),
  ]);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, concept).catch(() => {});
}

/**
 * Auto-post a single generation to all platforms.
 * Facebook (Tech Pulse + Penuel Mdluli) + YouTube Shorts + TikTok.
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

  // Facebook — post to both Tech Pulse and Penuel Mdluli page
  await Promise.allSettled([
    postToPage(PAGES.tech_pulse, videoUrl, description, undefined, prompt),
    postToPage(PAGES.penuel, videoUrl, description, undefined, prompt),
  ]);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, prompt).catch(() => {});
}

/**
 * Post a feature announcement / product marketing video.
 * Posts to Penuel Mdluli page (personal brand) + Tech Pulse Africa.
 * Use for new feature launches, demos, and product marketing.
 *
 * featureKey: "motion-control" | "react-studio" | "ai-character" | "ai-singer" | "generic"
 */
export async function autoPostFeatureAnnouncement(
  clerkId: string,
  videoR2Key: string,
  featureKey: string,
  featureInfo: { name: string; description: string }
): Promise<void> {
  if (!isOwnerClerkId(clerkId)) return;

  const videoUrl = r2PublicUrl(videoR2Key);
  const description = getFeatureAnnouncementDescription(featureKey, featureInfo);

  // Post to Penuel Mdluli page (personal brand) + Tech Pulse Africa
  await Promise.allSettled([
    postToPage(PAGES.penuel, videoUrl, description, undefined, featureInfo.description),
    postToPage(PAGES.tech_pulse, videoUrl, description, undefined, featureInfo.description),
  ]);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, featureInfo.description).catch(() => {});
}

/**
 * Auto-post any video to the Penuel Mdluli page with founder branding.
 * For personal brand content, behind-the-scenes, demos, etc.
 */
export async function autoPostToPersonalPage(
  clerkId: string,
  videoR2Key: string,
  prompt: string
): Promise<void> {
  if (!isOwnerClerkId(clerkId)) return;

  const videoUrl = r2PublicUrl(videoR2Key);
  const description = getPersonalBrandDescription(prompt);

  // Facebook (smart scheduled)
  await postToPage(PAGES.penuel, videoUrl, description, undefined, prompt);

  // YouTube + TikTok (immediate, fire-and-forget)
  crossPostToAllPlatforms(videoUrl, prompt).catch(() => {});
}
