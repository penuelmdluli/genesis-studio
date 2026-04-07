import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    try {
      const statusResult = await fal.queue.status("fal-ai/workflow-utilities/auto-subtitle", {
        requestId: jobId,
        logs: false,
      });

      if (statusResult.status === "COMPLETED") {
        const result = await fal.queue.result("fal-ai/workflow-utilities/auto-subtitle", {
          requestId: jobId,
        });

        const data = result.data as Record<string, unknown>;
        const video = data?.video as { url: string } | undefined;

        if (!video?.url) {
          return NextResponse.json({
            status: "failed",
            errorMessage: "No video returned from caption burn.",
          });
        }

        return NextResponse.json({
          status: "completed",
          output: {
            videoUrl: video.url,
          },
        });
      }

      if ((statusResult.status as string) === "FAILED") {
        return NextResponse.json({
          status: "failed",
          errorMessage: "Caption burn failed. Please try again.",
        });
      }

      const progress = statusResult.status === "IN_PROGRESS" ? 60 : 20;
      return NextResponse.json({
        status: "processing",
        progress,
      });
    } catch (falError) {
      console.error("Caption burn status error:", falError);
      return NextResponse.json({ status: "processing", progress: 30 });
    }
  } catch (error) {
    console.error("Caption burn status error:", error);
    return NextResponse.json({ error: "Failed to check burn status" }, { status: 500 });
  }
}
