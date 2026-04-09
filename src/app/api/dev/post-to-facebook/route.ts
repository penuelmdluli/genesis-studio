/**
 * Dev Post to Facebook API
 *
 * POST /api/dev/post-to-facebook
 * Body: { posts: [{ videoId, userId, pageKey, caption }] }
 *
 * Generates signed R2 URLs for each video and uploads them as Facebook Reels.
 * Uses the page tokens from environment variables.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl, videoStorageKey } from "@/lib/storage";

export const maxDuration = 120;

// Page configs — 6 Facebook pages
const FB_PAGES: Record<string, { pageId: string; tokenEnv: string; name: string }> = {
  tech_news: { pageId: "100919755007786", tokenEnv: "FB_PAGE_TOKEN_tech_news", name: "Tech Pulse Africa" },
  ai_money: { pageId: "107465491085378", tokenEnv: "FB_PAGE_TOKEN_ai_money", name: "AI Revolution" },
  motivation: { pageId: "102206758210905", tokenEnv: "FB_PAGE_TOKEN_motivation", name: "Afrika Toons" },
  health_wellness: { pageId: "106788301081578", tokenEnv: "FB_PAGE_TOKEN_health_wellness", name: "World News Animated" },
  blissful_moments: { pageId: "112465853843545", tokenEnv: "FB_PAGE_TOKEN_blissful_moments", name: "Mzansi Baby Stars" },
  limitless_you: { pageId: "104120995511039", tokenEnv: "FB_PAGE_TOKEN_limitless_you", name: "Africa 2050" },
};

interface PostResult {
  videoId: string;
  pageKey: string;
  pageName: string;
  success: boolean;
  postId?: string;
  error?: string;
}

async function postVideoToFacebook(
  videoUrl: string,
  pageId: string,
  accessToken: string,
  caption: string
): Promise<{ success: boolean; postId?: string; error?: string }> {
  try {
    console.log(`[FB POST] Downloading video from signed R2 URL...`);

    // Download the video from R2
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) {
      throw new Error(`Failed to download video: ${videoRes.status}`);
    }
    const videoBuffer = await videoRes.arrayBuffer();
    const videoBlob = new Blob([videoBuffer], { type: "video/mp4" });
    console.log(`[FB POST] Video downloaded: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    // Upload as Facebook Reel — 3-step process
    // Step 1: Initialize upload
    console.log(`[FB POST] Initializing Facebook upload for page ${pageId}...`);
    const initRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_phase: "start",
          access_token: accessToken,
        }),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`Facebook init failed: ${initRes.status} ${err}`);
    }

    const initData = await initRes.json();
    const fbVideoId = initData.video_id;
    console.log(`[FB POST] Upload initialized, video_id: ${fbVideoId}`);

    // Step 2: Upload video binary
    const uploadUrl = `https://rupload.facebook.com/video-upload/v19.0/${fbVideoId}`;
    console.log(`[FB POST] Uploading video binary (${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)} MB)...`);
    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        offset: "0",
        file_size: String(videoBuffer.byteLength),
        "Content-Type": "application/octet-stream",
      },
      body: videoBlob,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`Facebook upload failed: ${uploadRes.status} ${err}`);
    }

    console.log(`[FB POST] Video binary uploaded successfully`);

    // Step 3: Publish the reel
    console.log(`[FB POST] Publishing reel...`);
    const publishRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}/video_reels`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          upload_phase: "finish",
          video_id: fbVideoId,
          access_token: accessToken,
          description: caption,
          video_state: "PUBLISHED",
        }),
      }
    );

    if (!publishRes.ok) {
      const err = await publishRes.text();
      throw new Error(`Facebook publish failed: ${publishRes.status} ${err}`);
    }

    const publishData = await publishRes.json();
    console.log(`[FB POST] Published! Post ID: ${publishData.id || publishData.post_id || fbVideoId}`);

    return {
      success: true,
      postId: publishData.id || publishData.post_id || fbVideoId,
    };
  } catch (err) {
    console.error(`[FB POST] Error:`, err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { posts } = body as {
      posts: Array<{
        videoId: string;
        userId: string;
        pageKey: string;
        caption: string;
      }>;
    };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "posts array required" }, { status: 400 });
    }

    const results: PostResult[] = [];

    for (const post of posts) {
      const page = FB_PAGES[post.pageKey];
      if (!page) {
        results.push({
          videoId: post.videoId,
          pageKey: post.pageKey,
          pageName: "Unknown",
          success: false,
          error: `Unknown page: ${post.pageKey}`,
        });
        continue;
      }

      const token = process.env[page.tokenEnv];
      if (!token) {
        results.push({
          videoId: post.videoId,
          pageKey: post.pageKey,
          pageName: page.name,
          success: false,
          error: `No token for ${post.pageKey} (env: ${page.tokenEnv})`,
        });
        continue;
      }

      // Generate signed R2 download URL for the video
      const r2Key = videoStorageKey(post.userId, post.videoId);
      let videoUrl: string;
      try {
        videoUrl = await getSignedDownloadUrl(r2Key, 3600); // 1 hour expiry
        console.log(`[FB POST] Generated signed URL for ${r2Key}`);
      } catch (e) {
        results.push({
          videoId: post.videoId,
          pageKey: post.pageKey,
          pageName: page.name,
          success: false,
          error: `Failed to get R2 URL: ${e instanceof Error ? e.message : String(e)}`,
        });
        continue;
      }

      console.log(`[FB POST] Posting to ${page.name} (${post.pageKey})...`);
      const result = await postVideoToFacebook(
        videoUrl,
        page.pageId,
        token.replace(/'/g, ""), // Remove quotes if present
        post.caption
      );

      results.push({
        videoId: post.videoId,
        pageKey: post.pageKey,
        pageName: page.name,
        ...result,
      });

      // 3s delay between posts to avoid rate limits
      if (posts.indexOf(post) < posts.length - 1) {
        await new Promise((r) => setTimeout(r, 3000));
      }
    }

    const successCount = results.filter((r) => r.success).length;

    return NextResponse.json({
      success: successCount > 0,
      posted: successCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("[FB POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
