import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getDb } from "@/lib/db-driver";
import { headObject } from "@/lib/storage";
const OWNER_IDS = (process.env.OWNER_CLERK_IDS || "").split(",").filter(s => s.trim());

/**
 * GET /api/admin/video-health
 *
 * Returns a health report for all completed videos:
 * - Checks if the URL format is correct (/api/videos/{uuid})
 * - Checks if the corresponding R2 file exists and has size > 0
 * - Reports duration validity
 */
export async function GET(req: NextRequest) {
  // Auth: owner only
  const clerkId = await getAuthUserId();
  if (!clerkId || !OWNER_IDS.includes(clerkId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = getDb();

  // Get all completed videos with their jobs
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, url, duration, file_size, user_id, job_id, model_id, created_at")
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const video of videos || []) {
    const result: Record<string, unknown> = {
      id: video.id,
      createdAt: video.created_at,
      url: video.url,
      duration: video.duration,
      modelId: video.model_id,
    };

    // Check 1: URL format
    const hasValidUrlFormat = video.url?.startsWith("/api/videos/");
    result.urlFormatValid = hasValidUrlFormat;

    if (!video.url) {
      result.status = "BROKEN";
      result.reason = "No URL";
    } else if (!hasValidUrlFormat) {
      result.status = "BROKEN";
      result.reason = `Bad URL format: ${video.url.substring(0, 60)}`;
    } else {
      // Check 2: R2 file exists
      const r2Key = `videos/${video.user_id}/${video.job_id}.mp4`;
      const head = await headObject(r2Key);
      if (!head) {
        result.status = "BROKEN";
        result.reason = `R2 file not found: ${r2Key}`;
      } else {
        result.r2FileSize = head.size;
        result.r2ContentType = head.contentType;

        if (head.size < 1000) {
          result.status = "BROKEN";
          result.reason = `R2 file too small: ${head.size} bytes`;
        } else if (!head.contentType?.includes("video")) {
          result.status = "BROKEN";
          result.reason = `Wrong content type: ${head.contentType}`;
        } else {
          result.status = "HEALTHY";
        }
      }
    }

    // Check 3: Duration
    if (video.duration === 0 || video.duration === null) {
      result.durationWarning = "Duration is 0 or null";
    }

    results.push(result);
  }

  const healthy = results.filter((r) => r.status === "HEALTHY").length;
  const broken = results.filter((r) => r.status === "BROKEN").length;

  return NextResponse.json({
    summary: {
      total: results.length,
      healthy,
      broken,
      healthRate:
        results.length > 0
          ? `${Math.round((healthy / results.length) * 100)}%`
          : "N/A",
    },
    videos: results,
  });
}
