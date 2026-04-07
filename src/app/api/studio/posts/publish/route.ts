import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import {
  getReadyUnpostedVideos,
  getStudioPages,
  createStudioPost,
  updateStudioVideo,
} from "@/lib/studio/db";

/**
 * Auto-poster endpoint. Can be called by cron (CRON_SECRET) or by an authenticated owner.
 * GET /api/studio/posts/publish
 */
export async function GET(req: NextRequest) {
  try {
    // Accept either owner auth or CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get("authorization") || "";
    const isCronAuth =
      cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCronAuth) {
      const authResult = await requireStudioOwner();
      if (authResult instanceof NextResponse) return authResult;
    }

    // Get all ready, unposted videos
    const videos = await getReadyUnpostedVideos();

    if (!videos || videos.length === 0) {
      return NextResponse.json({ posted: 0, errors: [] });
    }

    // Get active pages (use owner env var since cron may not have clerkId)
    const ownerIds = process.env.OWNER_CLERK_IDS?.split(",").map(s => s.trim()) || [];
    const ownerId = ownerIds[0] || "";
    const pages = await getStudioPages(ownerId);
    const activePages = pages?.filter(
      (p: { is_active: boolean }) => p.is_active
    );

    if (!activePages || activePages.length === 0) {
      return NextResponse.json({
        posted: 0,
        errors: ["No active pages configured"],
      });
    }

    const errors: string[] = [];
    let postedCount = 0;

    for (const video of videos) {
      try {
        // Find matching page by niche
        const page = activePages.find(
          (p: { niche: string }) => p.niche === video.niche
        );

        if (!page) {
          errors.push(
            `No active page found for niche "${video.niche}" (video ${video.id})`
          );
          continue;
        }

        // Post video to Facebook via Graph API
        const videoUrl = video.branded_video_url || video.raw_video_url;
        if (!videoUrl) {
          errors.push(`Video ${video.id} has no video URL`);
          continue;
        }

        const fbResponse = await fetch(
          `https://graph.facebook.com/v19.0/${page.page_id}/videos`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              file_url: videoUrl,
              description: video.caption || "",
              access_token: page.page_access_token,
            }),
          }
        );

        if (!fbResponse.ok) {
          const fbError = await fbResponse.json().catch(() => ({}));
          errors.push(
            `Facebook API error for video ${video.id}: ${JSON.stringify(fbError)}`
          );
          continue;
        }

        const fbData = await fbResponse.json();
        const facebookPostId = fbData.id || fbData.post_id || null;

        // Create studio_post record
        await createStudioPost({
          video_id: video.id,
          page_id: page.id,
          facebook_post_id: facebookPostId,
          status: "posted",
          posted_at: new Date().toISOString(),
        });

        // Update video status
        await updateStudioVideo(video.id, { status: "posted" });

        postedCount++;
      } catch (videoError) {
        const msg =
          videoError instanceof Error ? videoError.message : String(videoError);
        errors.push(`Error posting video ${video.id}: ${msg}`);
      }
    }

    return NextResponse.json({ posted: postedCount, errors });
  } catch (error) {
    console.error("[studio/posts/publish] Error:", error);
    return NextResponse.json(
      { error: "Failed to run auto-poster" },
      { status: 500 }
    );
  }
}
