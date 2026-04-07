import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { fal } from "@fal-ai/client";

// Ensure FAL client is configured
fal.config({ credentials: process.env.FAL_KEY || "" });

/**
 * Convert FAL Whisper chunks to SRT subtitle format.
 * FAL Whisper output: { chunks: [{ timestamp: [0.0, 2.5], text: "Hello" }, ...] }
 */
function chunksToSrt(
  chunks: Array<{ timestamp: [number, number]; text: string }>
): string {
  return chunks
    .map((chunk, i) => {
      const startTime = formatSrtTime(chunk.timestamp[0]);
      const endTime = formatSrtTime(chunk.timestamp[1]);
      return `${i + 1}\n${startTime} --> ${endTime}\n${chunk.text.trim()}\n`;
    })
    .join("\n");
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad3(ms)}`;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}
function pad3(n: number): string {
  return n.toString().padStart(3, "0");
}

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

    // Poll FAL for job status
    try {
      const statusResult = await fal.queue.status("fal-ai/whisper", {
        requestId: jobId,
        logs: false,
      });

      if (statusResult.status === "COMPLETED") {
        // Fetch the actual result
        const result = await fal.queue.result("fal-ai/whisper", {
          requestId: jobId,
        });

        const data = result.data as Record<string, unknown>;
        const chunks = data?.chunks as Array<{ timestamp: [number, number]; text: string }> | undefined;

        if (!chunks || chunks.length === 0) {
          return NextResponse.json({
            status: "completed",
            output: {
              srt: "1\n00:00:00,000 --> 00:05:00,000\n(No speech detected)\n",
              segments: [],
              detectedLanguage: "auto",
              plainText: "(No speech detected)",
            },
          });
        }

        const srt = chunksToSrt(chunks);
        const segments = chunks.map((chunk) => ({
          start: chunk.timestamp[0],
          end: chunk.timestamp[1],
          text: chunk.text.trim(),
        }));
        const plainText = segments.map((s) => s.text).join(" ");

        return NextResponse.json({
          status: "completed",
          output: {
            srt,
            segments,
            detectedLanguage: (data?.detected_language as string) || "auto",
            plainText,
          },
        });
      }

      if ((statusResult.status as string) === "FAILED") {
        return NextResponse.json({
          status: "failed",
          errorMessage: "Caption generation failed. Please try again.",
        });
      }

      // Still processing
      const progress = statusResult.status === "IN_PROGRESS" ? 60 : 20;
      return NextResponse.json({
        status: "processing",
        progress,
      });
    } catch (falError) {
      console.error("FAL status check error:", falError);
      // Return processing status if we can't reach FAL (transient error)
      return NextResponse.json({
        status: "processing",
        progress: 30,
      });
    }
  } catch (error) {
    console.error("Caption status error:", error);
    return NextResponse.json(
      { error: "Failed to check caption status" },
      { status: 500 }
    );
  }
}
