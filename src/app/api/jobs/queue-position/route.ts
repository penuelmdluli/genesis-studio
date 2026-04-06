import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    // Get user's active (queued/processing) jobs
    const { data: userJobs } = await supabase
      .from("generation_jobs")
      .select("id, status, model_id, created_at, duration")
      .eq("user_id", user.id)
      .in("status", ["queued", "processing"])
      .order("created_at", { ascending: true });

    if (!userJobs || userJobs.length === 0) {
      return NextResponse.json({ jobs: [] });
    }

    // Count total queued jobs ahead of each user job
    const jobPositions = await Promise.all(
      userJobs.map(async (job) => {
        const { count } = await supabase
          .from("generation_jobs")
          .select("id", { count: "exact", head: true })
          .eq("status", "queued")
          .lt("created_at", job.created_at);

        const position = job.status === "processing" ? 0 : (count || 0) + 1;

        // Estimate time based on average generation time per model
        const avgTimeMap: Record<string, number> = {
          "wan-2.2": 300,
          "hunyuan-video": 75,
          "ltx-video": 30,
          "wan-2.1-turbo": 60,
          "mochi-1": 180,
          "cogvideo-x": 90,
          "mimic-motion": 120,
          "kling-2.6": 120,
          "kling-3.0": 150,
          "veo-3.1": 180,
          "seedance-1.5": 90,
        };

        const modelAvg = avgTimeMap[job.model_id] || 90;
        const etaSeconds = job.status === "processing"
          ? Math.round(modelAvg * 0.5) // Assume halfway through
          : position * modelAvg;

        return {
          jobId: job.id,
          status: job.status,
          position,
          etaSeconds,
          etaFormatted: etaSeconds < 60
            ? `~${etaSeconds}s`
            : etaSeconds < 3600
            ? `~${Math.ceil(etaSeconds / 60)}min`
            : `~${Math.round(etaSeconds / 3600)}hr`,
        };
      })
    );

    return NextResponse.json({ jobs: jobPositions });
  } catch (error) {
    console.error("[QUEUE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
