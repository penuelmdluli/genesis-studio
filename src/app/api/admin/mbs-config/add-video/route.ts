import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";
import { downloadAndPersist } from "@/lib/mbs/scraper";
import { envString } from "@/lib/env";

/**
 * POST /api/admin/mbs-config/add-video
 * Add a Facebook (or any) video URL as an MBS candidate.
 * Downloads the video to R2 and creates a candidate ready for vetting.
 *
 * Body: { videoUrl, creatorHandle, platform? }
 * Auth: CRON_SECRET (for automation) or owner session
 */
export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const secret =
    req.headers.get("x-cron-secret") ||
    req.headers.get("authorization")?.replace("Bearer ", "");
  if (secret !== envString("CRON_SECRET")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { videoUrl, creatorHandle, platform = "facebook" } = body as {
    videoUrl: string;
    creatorHandle?: string;
    platform?: string;
  };

  if (!videoUrl) {
    return NextResponse.json({ error: "videoUrl required" }, { status: 400 });
  }

  const supabase = getDb();

  // Check for duplicate
  const { data: existing } = await supabase
    .from("mbs_candidates")
    .select("id")
    .eq("source_url", videoUrl)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ error: "Video already exists as candidate", id: existing.id }, { status: 409 });
  }

  // Find or create the creator
  let creatorId: string | null = null;
  if (creatorHandle) {
    const { data: creator } = await supabase
      .from("mbs_source_creators")
      .select("id")
      .eq("handle", creatorHandle)
      .maybeSingle();

    if (creator) {
      creatorId = creator.id;
    } else {
      // Auto-create creator
      const profileUrl = platform === "facebook"
        ? `https://www.facebook.com/${creatorHandle}/`
        : `https://www.tiktok.com/@${creatorHandle}`;

      const { data: newCreator } = await supabase
        .from("mbs_source_creators")
        .insert({
          handle: creatorHandle,
          platform,
          profile_url: profileUrl,
          active: true,
          verified: true,
        })
        .select("id")
        .single();
      creatorId = newCreator?.id ?? null;
    }
  }

  // Download video to R2
  let r2Key: string;
  let durationSec: number;
  try {
    const dl = await downloadAndPersist(videoUrl);
    r2Key = dl.r2Key;
    durationSec = dl.durationSec;
  } catch (dlErr) {
    return NextResponse.json({
      error: `Download failed: ${dlErr instanceof Error ? dlErr.message : "Unknown error"}`,
    }, { status: 500 });
  }

  // Create candidate — goes straight to "discovered" for vetting
  const { data: candidate, error } = await supabase
    .from("mbs_candidates")
    .insert({
      source_url: videoUrl,
      source_creator_id: creatorId,
      reference_video_r2_url: r2Key,
      duration_sec: durationSec,
      status: "discovered",
    })
    .select("id, status")
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    candidate: candidate,
    message: `Video added as candidate. Will be vetted in the next 15-minute cycle.`,
  });
}
