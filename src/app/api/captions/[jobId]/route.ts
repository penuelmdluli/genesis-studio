import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getWsPrediction, wsStatusOf, type WsPrediction } from "@/lib/wavespeed-tools";

// Poll a transcription and turn it into SRT + segments for the captions page.

interface Segment {
  start: number;
  end: number;
  text: string;
}

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)},${ms.toString().padStart(3, "0")}`;
}

function segmentsToSrt(segments: Segment[]): string {
  return segments
    .map((seg, i) => `${i + 1}\n${formatSrtTime(seg.start)} --> ${formatSrtTime(seg.end)}\n${seg.text.trim()}\n`)
    .join("\n");
}

/**
 * Whisper-style outputs vary by host: some return `segments`, some
 * `chunks` with `timestamp: [start, end]`, some only `text`, and some put a
 * JSON document behind `outputs[0]`. Accept all of them.
 */
async function extractSegments(
  p: WsPrediction
): Promise<{ segments: Segment[]; text: string; language: string; srt?: string }> {
  let doc: Record<string, unknown> = p as unknown as Record<string, unknown>;

  const first = p.outputs?.[0] as unknown;

  // The transcriber answers with an OBJECT here — { srt, text, text_details }
  // — not a string. Only string shapes were handled, so a perfectly good
  // transcript fell through every branch and every video came back as
  // "(No speech detected)".
  if (first && typeof first === "object") {
    const o = first as { srt?: string; text?: string; text_details?: Array<{ start: number; end: number; text: string }> };
    const segments: Segment[] = (o.text_details || [])
      .map((d) => ({ start: Number(d.start) || 0, end: Number(d.end) || 0, text: String(d.text || "").trim() }))
      .filter((d) => d.text);
    const text = String(o.text || segments.map((x) => x.text).join(" ")).trim();
    if (segments.length || text) {
      return { segments, text, language: String((doc.language ?? doc.detected_language) || "auto"), srt: o.srt };
    }
  }

  if (typeof first === "string" && /^https?:\/\//.test(first)) {
    try {
      const res = await fetch(first);
      const ct = res.headers.get("content-type") || "";
      const body = await res.text();
      if (ct.includes("json") || body.trim().startsWith("{")) {
        doc = { ...doc, ...(JSON.parse(body) as Record<string, unknown>) };
      } else {
        doc = { ...doc, text: body };
      }
    } catch {
      // fall through to whatever the prediction itself carries
    }
  } else if (typeof first === "string" && first.trim().startsWith("{")) {
    try {
      doc = { ...doc, ...(JSON.parse(first) as Record<string, unknown>) };
    } catch {
      doc = { ...doc, text: first };
    }
  } else if (typeof first === "string") {
    doc = { ...doc, text: first };
  }

  const output = (doc.output && typeof doc.output === "object" ? (doc.output as Record<string, unknown>) : null);
  if (output) doc = { ...doc, ...output };

  const segments: Segment[] = [];
  const rawSegments = (doc.segments || doc.chunks) as Array<Record<string, unknown>> | undefined;
  if (Array.isArray(rawSegments)) {
    for (const s of rawSegments) {
      const ts = s.timestamp as [number, number] | undefined;
      const start = Number(s.start ?? ts?.[0] ?? 0);
      const end = Number(s.end ?? ts?.[1] ?? start + 2);
      const text = String(s.text ?? "").trim();
      if (text) segments.push({ start, end, text });
    }
  }

  const text = String(doc.text ?? segments.map((s) => s.text).join(" ")).trim();
  if (segments.length === 0 && text) {
    // No timing information at all — chunk the text into readable lines,
    // ~3s each, so the SRT is still usable.
    const words = text.split(/\s+/);
    for (let i = 0, t = 0; i < words.length; i += 8, t += 3) {
      segments.push({ start: t, end: t + 3, text: words.slice(i, i + 8).join(" ") });
    }
  }
  const language = String(doc.language ?? doc.detected_language ?? "auto");
  return { segments, text, language };
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { jobId } = await params;

    try {
      const p = await getWsPrediction(jobId);
      const status = wsStatusOf(p);

      if (status === "COMPLETED") {
        const { segments, text, language, srt } = await extractSegments(p);

        if (segments.length === 0) {
          return NextResponse.json({
            status: "completed",
            output: {
              srt: "1\n00:00:00,000 --> 00:05:00,000\n(No speech detected)\n",
              segments: [],
              detectedLanguage: language,
              plainText: "(No speech detected)",
            },
          });
        }

        return NextResponse.json({
          status: "completed",
          output: {
            // Use the provider's own SRT when it gives us one; it already
            // handles line breaks and timing better than a rebuild.
            srt: srt || segmentsToSrt(segments),
            segments,
            detectedLanguage: language,
            plainText: text,
          },
        });
      }

      if (status === "FAILED") {
        const raw = p.error || "";
        const noAudio = /extract audio|no audio|audio stream/i.test(raw);
        return NextResponse.json({
          status: "failed",
          errorMessage: noAudio
            ? "This video has no audio track, so there is nothing to caption. Add a voiceover first, then run captions."
            : "Caption generation failed. Please try again.",
        });
      }

      return NextResponse.json({ status: "processing", progress: status === "IN_PROGRESS" ? 60 : 20 });
    } catch (pollError) {
      console.error("Caption status check error:", pollError);
      return NextResponse.json({ status: "processing", progress: 30 });
    }
  } catch (error) {
    console.error("Caption status error:", error);
    return NextResponse.json({ error: "Failed to check caption status" }, { status: 500 });
  }
}
