// ============================================
// GENESIS STUDIO — Stamp a video with the creator's own branding
// ============================================
// POST /api/videos/<id>/brand
//
// Included with a paid plan rather than charged for: the compute is our own
// ffmpeg service, and a creator being able to put their name on their work
// is what the plan is for. Free accounts are told what it costs to get it.
//
// The original is never overwritten — a branded copy is saved alongside it,
// so a bad logo or the wrong corner is not destructive.

import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createVideo } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { envString } from "@/lib/env";
import { r2PublicUrl, videoStorageKey } from "@/lib/storage";
import { extractAndUploadThumbnail } from "@/lib/thumbnails";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: NextRequest, { params }: { params: Promise<{ videoId: string }> }) {
  const { videoId } = await params;

  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const isOwner = isOwnerClerkId(clerkId);

  // Two different jobs behind one endpoint.
  //
  //   "own"    — a paying creator puts THEIR mark on their work. This is what
  //              they upgraded for.
  //   "studio" — we put OUR mark on our own work, because the clips we post
  //              are how people find the product. Owner only, and never
  //              applied to a customer's video: a paid creator seeing our
  //              logo on their export is the exact complaint that started
  //              this work.
  const body = (await req.json().catch(() => ({}))) as { mode?: string };
  const studioBranding = body.mode === "studio";

  if (studioBranding && !isOwner) {
    return NextResponse.json({ error: "Not available on this account" }, { status: 403 });
  }

  if (!studioBranding && !isOwner && !["creator", "pro", "studio"].includes(user.plan)) {
    return NextResponse.json(
      { error: "Your own branding is part of the Creator plan and up.", upgrade: true },
      { status: 403 }
    );
  }

  if (!studioBranding && !user.brand_logo_url && !user.brand_name) {
    return NextResponse.json(
      { error: "Add a logo or brand name in Settings first." },
      { status: 400 }
    );
  }

  const db = getDb();
  const { data: video } = await db
    .from("videos")
    .select("id, user_id, job_id, title, prompt, model_id, resolution, duration, fps, aspect_ratio")
    .eq("id", videoId)
    .maybeSingle();

  if (!video || video.user_id !== user.id) {
    return NextResponse.json({ error: "That video is not in your gallery" }, { status: 404 });
  }

  const scraperUrl = envString("SCRAPER_SERVICE_URL");
  const scraperSecret = envString("SCRAPER_SERVICE_SECRET");
  if (!scraperUrl || !scraperSecret) {
    return NextResponse.json(
      { error: "Branding is temporarily unavailable. Nothing was charged — please try again shortly." },
      { status: 503 }
    );
  }

  const brandedId = randomUUID();
  const outputKey = videoStorageKey(user.id, `branded-${brandedId}`);

  try {
    const inputVideoUrl = r2PublicUrl(videoStorageKey(video.user_id, video.job_id));

    // `/brand-genesis` applies our watermark and outro; `/brand-custom`
    // applies the creator's own.
    const res = await fetch(`${scraperUrl}${studioBranding ? "/brand-genesis" : "/brand-custom"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-scraper-secret": scraperSecret },
      body: studioBranding
        ? JSON.stringify({ inputVideoUrl, outputR2Key: outputKey })
        : JSON.stringify({
            inputVideoUrl,
            logoUrl: user.brand_logo_url || undefined,
            brandName: user.brand_name || undefined,
            position: user.brand_position || "bottom-right",
            outputR2Key: outputKey,
          }),
    });

    if (!res.ok) {
      const detail = (await res.text()).slice(0, 200);
      console.error(`[BRAND] scraper ${res.status}: ${detail}`);
      return NextResponse.json(
        { error: "Could not stamp this video right now. Your original is untouched — please try again." },
        { status: 503 }
      );
    }

    const thumbnailUrl = await extractAndUploadThumbnail(outputKey, user.id, brandedId).catch(() => "");
    const url = `/api/videos/${brandedId}`;

    await createVideo({
      id: brandedId,
      userId: user.id,
      jobId: video.job_id,
      title: `${video.title} (${studioBranding ? "iVideo Studio" : "branded"})`.slice(0, 100),
      url,
      thumbnailUrl,
      modelId: video.model_id,
      prompt: video.prompt,
      resolution: video.resolution,
      duration: video.duration,
      fps: video.fps,
      fileSize: 0,
      aspectRatio: video.aspect_ratio,
    });

    return NextResponse.json({ ok: true, videoId: brandedId, url });
  } catch (err) {
    console.error("[BRAND] failed:", err);
    return NextResponse.json(
      { error: "Could not stamp this video right now. Your original is untouched — please try again." },
      { status: 503 }
    );
  }
}
