import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { STORAGE_LIMITS } from "@/lib/profitability";
import { deleteFile } from "@/lib/storage";

// Verify cron secret to prevent unauthorized access
const CRON_SECRET = process.env.CRON_SECRET;

/**
 * Daily storage cleanup cron job
 * Deletes expired videos based on plan retention policies
 *
 * Run via: Vercel Cron or external scheduler
 * Schedule: Daily at 3:00 AM UTC
 */
export async function GET(req: Request) {
  // Verify authorization
  const authHeader = req.headers.get("authorization");
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results = { checked: 0, deleted: 0, errors: 0, plans: {} as Record<string, number> };

  // Process each plan tier with retention limits
  for (const [plan, limits] of Object.entries(STORAGE_LIMITS)) {
    if (limits.retentionDays === -1) continue; // Skip unlimited plans

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - limits.retentionDays);

    // Find expired videos for this plan tier
    const { data: expiredJobs, error } = await supabase
      .from("generation_jobs")
      .select("id, user_id, output_video_url, created_at")
      .lt("created_at", cutoffDate.toISOString())
      .not("output_video_url", "is", null)
      .eq("status", "completed")
      .limit(100); // Process in batches

    if (error) {
      console.error(`[cleanup] Error fetching ${plan} jobs:`, error);
      continue;
    }

    if (!expiredJobs || expiredJobs.length === 0) continue;

    results.checked += expiredJobs.length;

    for (const job of expiredJobs) {
      try {
        // Check if user is actually on this plan (they may have upgraded)
        const { data: user } = await supabase
          .from("users")
          .select("plan")
          .eq("id", job.user_id)
          .single();

        // Skip if user has upgraded to a plan with longer retention
        if (user) {
          const userLimits = STORAGE_LIMITS[user.plan as keyof typeof STORAGE_LIMITS] || STORAGE_LIMITS.free;
          if (userLimits.retentionDays === -1) continue;

          const userCutoff = new Date();
          userCutoff.setDate(userCutoff.getDate() - userLimits.retentionDays);
          if (new Date(job.created_at) > userCutoff) continue;
        }

        // Delete from R2 storage
        if (job.output_video_url) {
          await deleteFile(job.output_video_url);
        }

        // Mark as expired in database
        await supabase
          .from("generation_jobs")
          .update({
            output_video_url: null,
            status: "expired",
          })
          .eq("id", job.id);

        // Remove from explore feed if published
        await supabase
          .from("explore_videos")
          .delete()
          .eq("job_id", job.id);

        results.deleted++;
        results.plans[plan] = (results.plans[plan] || 0) + 1;
      } catch (err) {
        console.error(`[cleanup] Error deleting job ${job.id}:`, err);
        results.errors++;
      }
    }
  }

  console.log(`[cleanup] Done: checked=${results.checked}, deleted=${results.deleted}, errors=${results.errors}`);

  return NextResponse.json({
    success: true,
    ...results,
    timestamp: new Date().toISOString(),
  });
}
