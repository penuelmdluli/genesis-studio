import { NextRequest, NextResponse } from "next/server";
import { requireStudioOwner } from "@/lib/studio/auth";
import { updateStudioVideo } from "@/lib/studio/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const { videoId } = await params;

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

    // If generating and has a production_id, check Brain Studio status
    if (video.status === "generating" && video.production_id) {
      const siteUrl =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
      const authHeader = req.headers.get("authorization") || "";
      const cookieHeader = req.headers.get("cookie") || "";

      const statusResponse = await fetch(
        `${siteUrl}/api/brain/status?id=${video.production_id}`,
        {
          method: "GET",
          headers: {
            Authorization: authHeader,
            Cookie: cookieHeader,
          },
        }
      );

      if (statusResponse.ok) {
        const statusData = await statusResponse.json();

        if (statusData.status === "completed" || statusData.status === "done") {
          // Production is complete - get the output video URL
          const outputUrl =
            statusData.outputUrl ||
            statusData.output_url ||
            statusData.videoUrl ||
            statusData.video_url ||
            null;

          await updateStudioVideo(videoId, {
            raw_video_url: outputUrl,
            status: "branding",
          });

          return NextResponse.json({
            videoId,
            status: "branding",
            rawVideoUrl: outputUrl,
            productionStatus: statusData.status,
          });
        }

        if (statusData.status === "failed" || statusData.status === "error") {
          await updateStudioVideo(videoId, { status: "failed" });

          return NextResponse.json({
            videoId,
            status: "failed",
            productionStatus: statusData.status,
          });
        }

        // Still in progress
        return NextResponse.json({
          videoId,
          status: video.status,
          productionStatus: statusData.status,
          progress: statusData.progress || null,
        });
      }
    }

    // Return current status as-is
    return NextResponse.json({
      videoId,
      status: video.status,
      rawVideoUrl: video.raw_video_url || null,
      brandedVideoUrl: video.branded_video_url || null,
    });
  } catch (error) {
    console.error("[studio/videos/status] Error:", error);
    return NextResponse.json(
      { error: "Failed to check video status" },
      { status: 500 }
    );
  }
}
