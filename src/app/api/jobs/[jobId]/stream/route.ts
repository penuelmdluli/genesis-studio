// ============================================
// GENESIS STUDIO — Server-Sent Events for Job Progress
// ============================================

import { NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, getJob } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    return new Response("Unauthorized", { status: 401 });
  }

  const user = await getUserByClerkId(clerkId);
  if (!user) {
    return new Response("User not found", { status: 404 });
  }

  // Create SSE stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const sendEvent = (data: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
        );
      };

      // Poll job status every 2 seconds
      let isTerminal = false;
      while (!isTerminal) {
        try {
          const job = await getJob(jobId);

          if (!job || job.user_id !== user.id) {
            sendEvent({ error: "Job not found" });
            break;
          }

          sendEvent({
            id: job.id,
            status: job.status,
            progress: job.progress,
            outputVideoUrl: job.output_video_url,
            thumbnailUrl: job.thumbnail_url,
            errorMessage: job.error_message,
          });

          isTerminal = ["completed", "failed", "cancelled"].includes(job.status);

          if (!isTerminal) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        } catch {
          sendEvent({ error: "Internal error" });
          break;
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
