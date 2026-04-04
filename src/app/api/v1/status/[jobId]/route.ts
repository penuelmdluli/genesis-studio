import { NextRequest, NextResponse } from "next/server";
import { validateApiKey, getJob } from "@/lib/db";
import { createHash } from "crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { jobId } = await params;

    // API Key authentication
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Missing API key" }, { status: 401 });
    }

    const apiKey = authHeader.slice(7);
    const keyHash = createHash("sha256").update(apiKey).digest("hex");
    const keyRecord = await validateApiKey(keyHash);

    if (!keyRecord) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    const job = await getJob(jobId);

    if (!job || job.user_id !== keyRecord.users.id) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json({
      id: job.id,
      status: job.status,
      progress: job.progress,
      model: job.model_id,
      resolution: job.resolution,
      duration: job.duration,
      output: job.status === "completed"
        ? {
            video_url: job.output_video_url,
            thumbnail_url: job.thumbnail_url,
          }
        : undefined,
      error: job.status === "failed" ? job.error_message : undefined,
      gpu_time_seconds: job.gpu_time,
      created_at: job.created_at,
      completed_at: job.completed_at,
    });
  } catch (error) {
    console.error("API v1 status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
