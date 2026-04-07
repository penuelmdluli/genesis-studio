import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { updateStudioVideo } from "@/lib/studio/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const { videoId } = (await req.json()) as { videoId: string };
    if (!videoId) {
      return NextResponse.json(
        { error: "videoId is required" },
        { status: 400 }
      );
    }

    // Fetch the studio_video record
    const supabase = createSupabaseAdmin();
    const { data: video, error: fetchError } = await supabase
      .from("studio_videos")
      .select("*")
      .eq("id", videoId)
      .single();

    if (fetchError || !video) {
      return NextResponse.json(
        { error: "Video not found" },
        { status: 404 }
      );
    }

    if (video.status !== "scripted") {
      return NextResponse.json(
        { error: `Cannot generate: video status is ${video.status}` },
        { status: 400 }
      );
    }

    // Update status to generating
    await updateStudioVideo(videoId, { status: "generating" });

    // Map niche to a Brain Studio style
    const styleMap: Record<string, string> = {
      news: "cinematic",
      finance: "cinematic",
      motivation: "cinematic",
      entertainment: "cinematic",
    };

    // Call the Brain Studio plan endpoint to create a production
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    // Forward auth headers from the incoming request
    const authHeader = req.headers.get("authorization") || "";
    const cookieHeader = req.headers.get("cookie") || "";

    // Step 1: Plan the production
    const planResponse = await fetch(`${siteUrl}/api/brain/plan`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({
        concept: video.script,
        targetDuration: 30,
        style: styleMap[video.niche] || "cinematic",
        aspectRatio: "portrait",
        voiceover: true,
        voiceoverVoice: "voice-aria",
        captions: true,
        music: true,
        soundEffects: false,
      }),
    });

    if (!planResponse.ok) {
      const planError = await planResponse.json().catch(() => ({}));
      console.error("[studio/videos/generate] Plan failed:", planError);
      await updateStudioVideo(videoId, { status: "failed" });
      return NextResponse.json(
        { error: "Failed to plan production", details: planError },
        { status: 500 }
      );
    }

    const planData = await planResponse.json();
    const productionId = planData.productionId;

    if (!productionId) {
      await updateStudioVideo(videoId, { status: "failed" });
      return NextResponse.json(
        { error: "No production ID returned from planner" },
        { status: 500 }
      );
    }

    // Step 2: Kick off production
    const produceResponse = await fetch(`${siteUrl}/api/brain/produce`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
        Cookie: cookieHeader,
      },
      body: JSON.stringify({ productionId }),
    });

    if (!produceResponse.ok) {
      const produceError = await produceResponse.json().catch(() => ({}));
      console.error("[studio/videos/generate] Produce failed:", produceError);
      await updateStudioVideo(videoId, { status: "failed" });
      return NextResponse.json(
        { error: "Failed to start production", details: produceError },
        { status: 500 }
      );
    }

    // Store production_id on the studio_video
    await updateStudioVideo(videoId, { production_id: productionId });

    return NextResponse.json({
      videoId,
      productionId,
      status: "generating",
    });
  } catch (error) {
    console.error("[studio/videos/generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to trigger video generation" },
      { status: 500 }
    );
  }
}
