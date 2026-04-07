import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { uploadToR2, getSignedDownloadUrl } from "@/lib/storage";
import { fal } from "@fal-ai/client";

/**
 * POST /api/admin/hero-setup
 *
 * One-time admin endpoint to set up the hero video poster.
 * 1. Finds the best featured videos from explore_videos
 * 2. Extracts a poster frame from the top video via FAL FFmpeg
 * 3. Uploads the poster to R2 as permanent storage
 * 4. Returns all URLs ready to hardcode into hero-video.tsx
 *
 * Requires x-test-secret header (last 10 chars of SUPABASE_SERVICE_ROLE_KEY).
 */
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-test-secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(`[HERO SETUP] ${msg}`);
  };

  try {
    const supabase = createSupabaseAdmin();

    // Step 1: Find best featured videos
    log("Fetching featured videos...");
    const { data: featured, error: featuredErr } = await supabase
      .from("explore_videos")
      .select("id, video_url, thumbnail_url, prompt, views, likes, created_at")
      .eq("is_featured", true)
      .eq("is_published", true)
      .eq("is_flagged", false)
      .order("likes", { ascending: false })
      .limit(6);

    if (featuredErr) {
      log(`Featured query error: ${featuredErr.message}`);
    }

    // Fallback: get most popular videos if no featured
    let videos = featured || [];
    if (videos.length === 0) {
      log("No featured videos found, falling back to most popular...");
      const { data: popular } = await supabase
        .from("explore_videos")
        .select("id, video_url, thumbnail_url, prompt, views, likes, created_at")
        .eq("is_published", true)
        .eq("is_flagged", false)
        .order("views", { ascending: false })
        .limit(6);
      videos = popular || [];
    }

    if (videos.length === 0) {
      return NextResponse.json({
        error: "No videos found in explore_videos",
        logs,
        hint: "Create some videos first, then publish them to the explore feed",
      }, { status: 404 });
    }

    log(`Found ${videos.length} videos`);
    for (const v of videos) {
      log(`  - ${v.id}: ${v.likes || 0} likes, ${v.views || 0} views — "${(v.prompt || "").slice(0, 50)}..."`);
    }

    // Step 2: Build permanent video URLs
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app").trim();
    const heroVideoUrls = videos.map((v) => {
      // If video_url is already a proxy path, make it absolute
      if (v.video_url?.startsWith("/api/")) {
        return `${appUrl}${v.video_url}`;
      }
      // If it's an R2 key like "explore/xxx.mp4", construct proxy URL
      if (v.video_url && !v.video_url.startsWith("http")) {
        return `${appUrl}/api/explore/video/${v.id}`;
      }
      // External URL — use proxy for permanence
      return `${appUrl}/api/explore/video/${v.id}`;
    });

    log(`Hero video URLs:`);
    heroVideoUrls.forEach((u, i) => log(`  [${i}]: ${u}`));

    // Step 3: Extract poster frame from top video
    // FAL needs a publicly accessible URL. Our videos are in R2 behind a proxy,
    // so we generate a signed R2 URL that FAL can access directly.
    const topVideo = videos[0];
    let topVideoUrlForFal = "";

    // Try to get a signed URL from R2
    const r2Key = `explore/${topVideo.id}.mp4`;
    try {
      topVideoUrlForFal = await getSignedDownloadUrl(r2Key, 600); // 10 min expiry
      log(`Using signed R2 URL for poster extraction`);
    } catch {
      // Fallback to proxy URL (may not work with FAL)
      topVideoUrlForFal = topVideo.video_url?.startsWith("http")
        ? topVideo.video_url
        : `${appUrl}/api/explore/video/${topVideo.id}`;
      log(`R2 signed URL failed, using: ${topVideoUrlForFal}`);
    }

    let posterUrl = "";
    log(`Extracting poster frame...`);
    try {
      // Use FAL extract-frame endpoint
      const frameResult = await fal.run("fal-ai/ffmpeg-api/extract-frame", {
        input: {
          video_url: topVideoUrlForFal,
          frame_type: "middle", // Middle frame usually looks best
        },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      }) as any;

      log(`FAL extract-frame response keys: ${JSON.stringify(Object.keys(frameResult || {}))}`);
      log(`FAL extract-frame response: ${JSON.stringify(frameResult).slice(0, 500)}`);

      // FAL client wraps response in { data: ... }
      const responseData = frameResult?.data || frameResult;
      const frameUrl =
        responseData?.images?.[0]?.url ||
        responseData?.image?.url ||
        responseData?.frame?.url ||
        responseData?.url;

      if (frameUrl) {
        log(`Frame extracted: ${frameUrl}`);

        // Download the frame image
        const frameRes = await fetch(frameUrl);
        if (frameRes.ok) {
          const frameBuffer = Buffer.from(await frameRes.arrayBuffer());
          log(`Frame downloaded: ${frameBuffer.length} bytes`);

          // Upload to R2 as permanent poster
          const posterKey = "assets/hero-poster.jpg";
          await uploadToR2(posterKey, frameBuffer, "image/jpeg");
          log(`Poster uploaded to R2: ${posterKey}`);

          // Construct poster URL
          posterUrl = `${appUrl}/api/assets/hero-poster`;
          log(`Poster URL: ${posterUrl}`);
        } else {
          log(`Frame download failed: ${frameRes.status}`);
        }
      } else {
        log(`No frame URL found in FAL response`);

        // Alternative: use FAL metadata endpoint which also returns start_frame_url
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const metaResult = await fal.run("fal-ai/ffmpeg-api/metadata", {
            input: {
              media_url: topVideoUrlForFal,
              extract_frames: true,
            },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          }) as any;

          const metaData = metaResult?.data || metaResult;
          log(`Metadata response keys: ${JSON.stringify(Object.keys(metaData || {}))}`);
          const startFrameUrl = metaData?.start_frame_url || metaData?.end_frame_url;
          if (startFrameUrl) {
            log(`Got frame from metadata: ${startFrameUrl}`);
            const frameRes = await fetch(startFrameUrl);
            if (frameRes.ok) {
              const frameBuffer = Buffer.from(await frameRes.arrayBuffer());
              const posterKey = "assets/hero-poster.jpg";
              await uploadToR2(posterKey, frameBuffer, "image/jpeg");
              posterUrl = `${appUrl}/api/assets/hero-poster`;
              log(`Poster uploaded via metadata fallback: ${posterUrl}`);
            }
          } else {
            log(`Metadata also returned no frame URL`);
          }
        } catch (metaErr) {
          log(`Metadata fallback failed: ${metaErr instanceof Error ? metaErr.message : metaErr}`);
        }
      }
    } catch (err) {
      log(`Poster extraction failed: ${err instanceof Error ? err.message : err}`);
      log("Trying thumbnail as fallback poster...");

      // Try to download a thumbnail and upload to R2
      const thumbUrl = videos[0]?.thumbnail_url;
      if (thumbUrl && thumbUrl.startsWith("http")) {
        try {
          const thumbRes = await fetch(thumbUrl);
          if (thumbRes.ok) {
            const thumbBuffer = Buffer.from(await thumbRes.arrayBuffer());
            const posterKey = "assets/hero-poster.jpg";
            await uploadToR2(posterKey, thumbBuffer, "image/jpeg");
            posterUrl = `${appUrl}/api/assets/hero-poster`;
            log(`Thumbnail uploaded as poster: ${posterUrl} (${thumbBuffer.length} bytes)`);
          }
        } catch (thumbErr) {
          log(`Thumbnail fallback also failed: ${thumbErr instanceof Error ? thumbErr.message : thumbErr}`);
        }
      }
    }

    // Step 4: Return everything ready to hardcode
    const result = {
      status: "success",
      heroVideo: {
        // Primary video URL (the best one)
        src: heroVideoUrls[0],
        // Poster image URL
        poster: posterUrl,
        // All video URLs for crossfade rotation
        allVideoUrls: heroVideoUrls,
      },
      codeSnippet: `
// Copy this into src/components/hero-video.tsx
const HERO_VIDEO = {
  src: "${heroVideoUrls[0]}",
  poster: "${posterUrl}",
};
      `.trim(),
      logs,
    };

    return NextResponse.json(result);
  } catch (error) {
    log(`FATAL: ${error instanceof Error ? error.message : error}`);
    return NextResponse.json({ error: "Setup failed", logs }, { status: 500 });
  }
}

/**
 * GET /api/admin/hero-setup
 * Returns current hero video configuration status
 */
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-test-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.SUPABASE_SERVICE_ROLE_KEY?.slice(-10)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data: featured, error } = await supabase
    .from("explore_videos")
    .select("id, video_url, thumbnail_url, prompt, views, likes")
    .eq("is_featured", true)
    .eq("is_published", true)
    .eq("is_flagged", false)
    .order("likes", { ascending: false })
    .limit(10);

  return NextResponse.json({
    featuredCount: featured?.length || 0,
    videos: (featured || []).map(v => ({
      id: v.id,
      videoUrl: v.video_url,
      thumbnailUrl: v.thumbnail_url,
      prompt: (v.prompt || "").slice(0, 80),
      views: v.views,
      likes: v.likes,
    })),
    error: error?.message,
  });
}
