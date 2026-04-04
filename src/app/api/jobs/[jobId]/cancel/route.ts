import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, getJob, updateJobStatus } from "@/lib/db";
import { cancelRunPodJob } from "@/lib/runpod";
import { refundCredits } from "@/lib/credits";
import { ModelId } from "@/types";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const job = await getJob(jobId);
    if (!job || job.user_id !== user.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    // Can only cancel queued or processing jobs
    if (job.status !== "queued" && job.status !== "processing") {
      return NextResponse.json(
        { error: "Job cannot be cancelled — already " + job.status },
        { status: 400 }
      );
    }

    // Cancel on RunPod if there's a job ID
    if (job.runpod_job_id) {
      try {
        await cancelRunPodJob(job.model_id as ModelId, job.runpod_job_id);
      } catch (e) {
        console.error("RunPod cancel error (non-fatal):", e);
      }
    }

    // Mark as cancelled
    await updateJobStatus(job.id, {
      status: "cancelled",
      errorMessage: "Cancelled by user",
      completedAt: new Date().toISOString(),
    });

    // Refund credits
    await refundCredits(
      job.user_id,
      job.credits_cost,
      job.id,
      "Cancelled by user — credits refunded"
    );

    return NextResponse.json({
      id: job.id,
      status: "cancelled",
      creditsRefunded: job.credits_cost,
    });
  } catch (error) {
    console.error("Cancel job error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
