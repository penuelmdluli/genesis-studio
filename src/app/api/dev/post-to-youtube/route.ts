/**
 * Dev Post to YouTube Shorts API
 *
 * POST /api/dev/post-to-youtube
 * Body: { posts: [{ videoId, userId, title, description, tags }] }
 * Auth: CRON_SECRET
 *
 * Uploads videos as YouTube Shorts using YouTube Data API v3 with OAuth2.
 * Requires: YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN
 *
 * YouTube Shorts: vertical video (9:16), ≤60 seconds, #Shorts in title/description.
 */

import { NextRequest, NextResponse } from "next/server";
import { getSignedDownloadUrl, videoStorageKey } from "@/lib/storage";

export const maxDuration = 120;

interface PostResult {
  videoId: string;
  success: boolean;
  youtubeVideoId?: string;
  error?: string;
}

async function getAccessToken(): Promise<string> {
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("YouTube OAuth2 credentials not configured. Set YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET, YOUTUBE_REFRESH_TOKEN");
  }

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`YouTube token refresh failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.access_token;
}

async function uploadToYouTube(
  videoUrl: string,
  title: string,
  description: string,
  tags: string[],
  accessToken: string
): Promise<{ success: boolean; youtubeVideoId?: string; error?: string }> {
  try {
    // Download video from R2
    console.log(`[YT POST] Downloading video...`);
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new Error(`Failed to download: ${videoRes.status}`);
    const videoBuffer = await videoRes.arrayBuffer();
    console.log(`[YT POST] Downloaded: ${(videoBuffer.byteLength / 1024 / 1024).toFixed(1)} MB`);

    // Step 1: Initialize resumable upload
    const metadata = {
      snippet: {
        title: title.slice(0, 100), // YouTube title max 100 chars
        description,
        tags,
        categoryId: "22", // People & Blogs
      },
      status: {
        privacyStatus: "public",
        selfDeclaredMadeForKids: false,
        embeddable: true,
      },
    };

    console.log(`[YT POST] Initializing upload: "${title.slice(0, 50)}..."`);
    const initRes = await fetch(
      "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
          "X-Upload-Content-Length": String(videoBuffer.byteLength),
          "X-Upload-Content-Type": "video/mp4",
        },
        body: JSON.stringify(metadata),
      }
    );

    if (!initRes.ok) {
      const err = await initRes.text();
      throw new Error(`YouTube init failed: ${initRes.status} ${err}`);
    }

    const uploadUrl = initRes.headers.get("location");
    if (!uploadUrl) throw new Error("No upload URL returned");

    // Step 2: Upload video binary
    console.log(`[YT POST] Uploading video binary...`);
    const uploadRes = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Length": String(videoBuffer.byteLength),
        "Content-Type": "video/mp4",
      },
      body: videoBuffer,
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      throw new Error(`YouTube upload failed: ${uploadRes.status} ${err}`);
    }

    const uploadData = await uploadRes.json();
    const youtubeVideoId = uploadData.id;
    console.log(`[YT POST] Published! YouTube ID: ${youtubeVideoId}`);

    return { success: true, youtubeVideoId };
  } catch (err) {
    console.error(`[YT POST] Error:`, err);
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
    // Check credentials first
    if (!process.env.YOUTUBE_CLIENT_ID || !process.env.YOUTUBE_CLIENT_SECRET || !process.env.YOUTUBE_REFRESH_TOKEN) {
      return NextResponse.json({
        error: "YouTube not configured",
        setup: {
          required: ["YOUTUBE_CLIENT_ID", "YOUTUBE_CLIENT_SECRET", "YOUTUBE_REFRESH_TOKEN"],
          instructions: "1. Go to Google Cloud Console → APIs → YouTube Data API v3. 2. Create OAuth2 credentials (Desktop app). 3. Run OAuth consent to get refresh_token. 4. Add all 3 to .env.local",
        },
      }, { status: 503 });
    }

    const body = await req.json();
    const { posts } = body as {
      posts: Array<{
        videoId: string;
        userId: string;
        title: string;
        description: string;
        tags?: string[];
      }>;
    };

    if (!posts || !Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "posts array required" }, { status: 400 });
    }

    // Get access token once for all uploads
    const accessToken = await getAccessToken();
    const results: PostResult[] = [];

    for (const post of posts) {
      // Generate signed R2 URL
      const r2Key = videoStorageKey(post.userId, post.videoId);
      let videoUrl: string;
      try {
        videoUrl = await getSignedDownloadUrl(r2Key, 3600);
      } catch (e) {
        results.push({
          videoId: post.videoId,
          success: false,
          error: `R2 URL failed: ${e instanceof Error ? e.message : String(e)}`,
        });
        continue;
      }

      // Ensure #Shorts is in title for YouTube Shorts detection
      let title = post.title;
      if (!title.includes("#Shorts")) {
        title = `${title} #Shorts`;
      }

      const result = await uploadToYouTube(
        videoUrl,
        title,
        post.description,
        post.tags || [],
        accessToken
      );

      results.push({ videoId: post.videoId, ...result });

      // 2s delay between uploads
      if (posts.indexOf(post) < posts.length - 1) {
        await new Promise((r) => setTimeout(r, 2000));
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
    console.error("[YT POST] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}
