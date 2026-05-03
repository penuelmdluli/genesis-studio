// ============================================
// Facebook Page Auto-Comments
// Posts comments AS the page on its own posts.
// ============================================

export async function postPageComment(
  postId: string,
  message: string,
  pageToken?: string
): Promise<string | null> {
  const token = pageToken || process.env.FB_MBS_PAGE_ACCESS_TOKEN;
  if (!token) return null;

  const params = new URLSearchParams({
    message,
    access_token: token,
  });

  const res = await fetch(`https://graph.facebook.com/v25.0/${postId}/comments`, {
    method: "POST",
    body: params,
  });

  if (!res.ok) {
    const err = await res.text();
    console.error(`[FB Comment] Failed on ${postId}: ${err.slice(0, 200)}`);
    return null;
  }

  const data = (await res.json()) as { id: string };
  console.log(`[FB Comment] ✅ Comment posted on ${postId}: ${data.id}`);
  return data.id;
}

// ── Marketing Comments for Owner Auto-Posts ──

const PINNED_COMMENTS = [
  "🎬 This was 100% AI-generated using Genesis Studio. No camera. No crew. No editing. Just one prompt.\n\n👉 Try it FREE: https://genesisstudio.app\n🎁 100 free credits — create your first video in 60 seconds!",
  "⚡ How was this made? One prompt + Genesis Studio = this video.\n\nAI does the script, voiceover, music, and captions.\n\n🚀 https://genesisstudio.app — try it free, no card needed!",
  "🤖 Yes, this is AI. And yes, you can make your own.\n\nGenesis Studio — the #1 AI video tool for African creators.\n\n👇 https://genesisstudio.app\n✨ 100 free credits waiting for you!",
  "💡 Imagine creating content like this every day without a camera.\n\nThat's Genesis Studio. AI video generation. Built in South Africa.\n\n🔗 https://genesisstudio.app — start free today!",
  "🌍 Made in Africa. Powered by AI. Available worldwide.\n\nGenesis Studio turns your ideas into cinematic videos.\nVoiceover. Music. Captions. All automatic.\n\n🚀 https://genesisstudio.app",
];

const ENGAGEMENT_COMMENTS = [
  "👇 Drop a 🔥 if you think AI video is the future of content creation!",
  "💬 What would YOU create with AI video? Comment your idea below! 👇",
  "🤔 Can you tell this is AI? Be honest in the comments! 👀",
  "📢 Tag a content creator who NEEDS to see this! 👇",
  "❤️ Like this if you want to see more AI-generated content from Africa!",
  "🎯 Which topic should we cover next? Drop your suggestions below! 👇",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Post marketing comments on an owner's video post.
 * Posts two comments: one pinned marketing CTA + one engagement prompt.
 */
export async function postMarketingComments(
  postId: string,
  pageToken: string
): Promise<void> {
  // Comment 1: Marketing CTA (pin-worthy)
  const ctaComment = pickRandom(PINNED_COMMENTS);
  await postPageComment(postId, ctaComment, pageToken);

  // Small delay to avoid rate limits
  await new Promise((r) => setTimeout(r, 2000));

  // Comment 2: Engagement prompt
  const engagementComment = pickRandom(ENGAGEMENT_COMMENTS);
  await postPageComment(postId, engagementComment, pageToken);
}
