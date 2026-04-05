import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Convert Whisper segments to SRT subtitle format.
 * Whisper output: { segments: [{ start: 0.0, end: 2.5, text: "Hello" }, ...] }
 */
function segmentsToSrt(
  segments: Array<{ start: number; end: number; text: string }>
): string {
  return segments
    .map((seg, i) => {
      const startTime = formatSrtTime(seg.start);
      const endTime = formatSrtTime(seg.end);
      return `${i + 1}\n${startTime} --> ${endTime}\n${seg.text.trim()}\n`;
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

    const captionsEndpoint = process.env.RUNPOD_ENDPOINT_CAPTIONS;
    const runpodApiKey = process.env.RUNPOD_API_KEY;

    if (!captionsEndpoint || !runpodApiKey) {
      return NextResponse.json(
        { error: "Captions endpoint not configured" },
        { status: 503 }
      );
    }

    // Poll RunPod for job status
    const statusRes = await fetch(
      `https://api.runpod.ai/v2/${captionsEndpoint}/status/${jobId}`,
      {
        headers: { Authorization: `Bearer ${runpodApiKey}` },
      }
    );

    if (!statusRes.ok) {
      return NextResponse.json(
        { status: "processing", progress: 50 }
      );
    }

    const statusData = await statusRes.json();

    if (statusData.status === "COMPLETED") {
      const output = statusData.output;

      // RunPod ai-api-faster-whisper output formats:
      // - SRT format: { transcription: "1\n00:00:00,000 --> ...\ntext\n\n..." }
      // - Plain text: { transcription: "text..." }
      // - Segments: { segments: [{start, end, text}...] }
      // - Direct string: "text..."
      let srt = "";
      let segments = output?.segments || output?.transcription?.segments || [];
      let plainText = "";

      if (typeof output === "string") {
        // Direct string output — could be SRT or plain text
        srt = output.includes("-->") ? output : "";
        plainText = output;
      } else if (output?.transcription && typeof output.transcription === "string") {
        // Transcription as string — SRT or plain text
        srt = output.transcription.includes("-->") ? output.transcription : "";
        plainText = output.transcription;
      } else if (segments.length > 0) {
        // Segments array — convert to SRT
        srt = segmentsToSrt(segments);
        plainText = segments.map((s: { text: string }) => s.text).join(" ");
      }

      // Fallback: if we got plain text but no SRT, wrap it
      if (!srt && plainText) {
        srt = `1\n00:00:00,000 --> 00:05:00,000\n${plainText}\n`;
      }

      return NextResponse.json({
        status: "completed",
        output: {
          srt,
          segments,
          detectedLanguage: output?.detected_language || output?.language || "auto",
          plainText,
        },
      });
    }

    if (statusData.status === "FAILED") {
      return NextResponse.json({
        status: "failed",
        errorMessage: statusData.error || "Caption generation failed on GPU",
      });
    }

    // Still processing
    const progress = statusData.status === "IN_PROGRESS" ? 60 : 20;
    return NextResponse.json({
      status: "processing",
      progress,
    });
  } catch (error) {
    console.error("Caption status error:", error);
    return NextResponse.json(
      { error: "Failed to check caption status" },
      { status: 500 }
    );
  }
}
