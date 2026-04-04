import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { refundCredits } from "@/lib/credits";
import { updateJobStatus } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";
import { auditAllVideos } from "@/lib/video-health";

export async function POST(req: NextRequest) {
  try {
    // Owner-only access
    const { userId: clerkId } = await auth();
    if (!clerkId || !isOwnerClerkId(clerkId)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const fix = body.fix === true; // Only mark broken + refund if explicitly requested

    const auditResult = await auditAllVideos();

    if (!fix) {
      // Dry run — just return audit results without modifying anything
      return NextResponse.json({
        mode: "dry_run",
        summary: {
          total: auditResult.total,
          healthy: auditResult.healthy,
          broken: auditResult.broken,
        },
        broken: auditResult.results.filter((r) => r.status !== "healthy"),
      });
    }

    // Fix mode: mark broken videos' jobs as failed and refund credits
    const supabase = createSupabaseAdmin();
    const fixed: string[] = [];
    const fixErrors: { videoId: string; error: string }[] = [];

    const brokenVideos = auditResult.results.filter(
      (r) => r.status !== "healthy"
    );

    for (const broken of brokenVideos) {
      try {
        // Look up the job to get credits_cost and user_id
        const { data: video } = await supabase
          .from("videos")
          .select("user_id, job_id")
          .eq("id", broken.videoId)
          .single();

        if (!video) continue;

        const { data: job } = await supabase
          .from("generation_jobs")
          .select("id, user_id, credits_cost, status")
          .eq("id", video.job_id)
          .single();

        if (!job) continue;

        // Only fix jobs that are still marked as completed (avoid double-refund)
        if (job.status === "completed") {
          await updateJobStatus(job.id, {
            status: "failed",
            errorMessage: `Video file ${broken.status}: ${broken.error || "missing or corrupted"}`,
          });

          // Refund credits
          if (job.credits_cost > 0) {
            await refundCredits(
              job.user_id,
              job.credits_cost,
              job.id,
              `Audit fix: video file ${broken.status} — automatic refund`
            );
          }

          fixed.push(broken.videoId);
        }
      } catch (fixErr) {
        fixErrors.push({
          videoId: broken.videoId,
          error: fixErr instanceof Error ? fixErr.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({
      mode: "fix",
      summary: {
        total: auditResult.total,
        healthy: auditResult.healthy,
        broken: auditResult.broken,
        fixed: fixed.length,
        fixErrors: fixErrors.length,
      },
      fixed,
      fixErrors: fixErrors.length > 0 ? fixErrors : undefined,
    });
  } catch (error) {
    console.error("Video audit error:", error);
    return NextResponse.json(
      { error: "Audit failed" },
      { status: 500 }
    );
  }
}
