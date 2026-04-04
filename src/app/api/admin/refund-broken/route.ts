import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { refundCredits } from "@/lib/credits";
import { checkVideoHealth } from "@/lib/video-health";

const OWNER_IDS = (process.env.OWNER_CLERK_IDS || "").split(",");

/**
 * POST /api/admin/refund-broken
 *
 * Scans all completed videos, finds broken ones (missing/empty R2 files),
 * refunds credits for their jobs, and marks the jobs as failed.
 * Owner-only endpoint.
 */
export async function POST(req: NextRequest) {
  const { userId: clerkId } = await auth();
  if (!clerkId || !OWNER_IDS.includes(clerkId)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();

  // Get all videos that have an associated job
  const { data: videos, error } = await supabase
    .from("videos")
    .select("id, job_id, user_id, url")
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const refunded: { videoId: string; jobId: string; credits: number }[] = [];
  const alreadyRefunded: string[] = [];
  let scanned = 0;

  for (const video of videos || []) {
    scanned++;
    const health = await checkVideoHealth(video.id);

    if (health.status === "healthy") continue;

    // Check if this job was already refunded
    const { data: existingRefund } = await supabase
      .from("credit_transactions")
      .select("id")
      .eq("job_id", video.job_id)
      .eq("type", "generation_refund")
      .maybeSingle();

    if (existingRefund) {
      alreadyRefunded.push(video.id);
      continue;
    }

    // Get the job to find credit cost
    const { data: job } = await supabase
      .from("generation_jobs")
      .select("id, credits_cost, user_id, status")
      .eq("id", video.job_id)
      .single();

    if (!job || !job.credits_cost) continue;

    // Refund credits
    await refundCredits(
      job.user_id,
      job.credits_cost,
      job.id,
      `Broken video refund (${health.status}: ${health.error || "unknown"}) — admin audit`
    );

    // Mark job as failed
    await supabase
      .from("generation_jobs")
      .update({
        status: "failed",
        error_message: `Broken video detected by admin audit: ${health.error || health.status}`,
      })
      .eq("id", job.id);

    refunded.push({
      videoId: video.id,
      jobId: job.id,
      credits: job.credits_cost,
    });
  }

  const totalRefunded = refunded.reduce((sum, r) => sum + r.credits, 0);

  return NextResponse.json({
    scanned,
    refunded: refunded.length,
    totalCreditsRefunded: totalRefunded,
    alreadyRefunded: alreadyRefunded.length,
    details: refunded,
  });
}
