import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { submitAceStepJob, submitSadTalkerJob } from "@/lib/runpod-singer";

// Async submit-and-return pattern (Cloudflare Workers compatible).
// Pipeline is advanced by /api/cron/check-singer.
//
// Progress stages:
//   10 = ACE-Step (song generation) submitted on RunPod
//   50 = SadTalker (lip-sync) submitted on RunPod
//  100 = completed

const GENRE_TAGS: Record<string, string> = {
  pop: "pop, catchy, upbeat, melodic, polished vocals",
  hiphop: "hip hop, rap, trap, hard bass, rhythmic flow",
  rnb: "r&b, smooth, soulful, sensual, groove",
  afrobeats: "afrobeats, dancehall, tropical, percussion, vibrant",
  gospel: "gospel, spiritual, choir, uplifting, powerful vocals",
  rock: "rock, electric guitar, drums, powerful, raw energy",
  jazz: "jazz, smooth, saxophone, piano, sophisticated",
  electronic: "electronic, synth, dance, EDM, bass drop",
  acoustic: "acoustic, folk, guitar, intimate, warm",
  amapiano: "amapiano, log drum, south african house, piano, bass",
};

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const rateCheck = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const {
      faceImageUrl,
      lyrics,
      genre,
      songUrl,
      songTitle,
      duration,
      aspectRatio,
    } = body as {
      faceImageUrl: string;
      lyrics?: string;
      genre?: string;
      songUrl?: string;
      songTitle?: string;
      duration?: number;
      aspectRatio?: string;
    };

    if (!faceImageUrl) {
      return NextResponse.json({ error: "Face image is required" }, { status: 400 });
    }
    if (!lyrics && !songUrl) {
      return NextResponse.json({ error: "Provide lyrics or upload a song" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    const targetDuration = Math.min(duration || 30, 60);
    const ar = aspectRatio === "16:9" ? "16:9" : "9:16";
    const creditsCost = 30 + targetDuration;

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id, creditsCost, "",
        `AI Singer: ${targetDuration}s ${genre || "custom"}`
      );
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    // ────────────────────────────────────────────────────────────────
    // Create job — store everything the cron needs to advance pipeline
    // ────────────────────────────────────────────────────────────────
    const jobTitle = songTitle || `AI Singer: ${genre || "Custom"}`;

    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "ai-singer",
      prompt: jobTitle,
      negativePrompt: lyrics || undefined, // full lyrics stored here for cron
      inputImageUrl: faceImageUrl,
      resolution: "720p",
      duration: targetDuration,
      fps: 30,
      isDraft: false,
      creditsCost,
      aspectRatio: ar === "9:16" ? "portrait" : "landscape",
      audioUrl: songUrl || undefined,
    });

    try {
      if (!songUrl && lyrics) {
        // ── Submit ACE-Step on RunPod ─────────────────────────────
        const genreTags = GENRE_TAGS[genre || "pop"] || GENRE_TAGS.pop;

        const runpodJobId = await submitAceStepJob({
          tags: genreTags,
          lyrics: lyrics,
          duration: targetDuration,
        });

        await updateJobStatus(job.id, {
          status: "processing",
          runpodJobId: runpodJobId,
          progress: 10,
          startedAt: new Date().toISOString(),
        });

        console.log(`[AI-SINGER] ACE-Step submitted on RunPod: ${runpodJobId}`);
      } else if (songUrl) {
        // ── Song provided — submit SadTalker directly ────────────
        const runpodJobId = await submitSadTalkerJob({
          faceImageUrl,
          audioUrl: songUrl,
        });

        await updateJobStatus(job.id, {
          status: "processing",
          runpodJobId: runpodJobId,
          progress: 50,
          startedAt: new Date().toISOString(),
        });

        console.log(`[AI-SINGER] SadTalker submitted on RunPod (user song): ${runpodJobId}`);
      }
    } catch (submitErr) {
      console.error("[AI-SINGER] Submit error:", submitErr);
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, job.id, "AI Singer submit failed — automatic refund");
      }
      await updateJobStatus(job.id, {
        status: "failed",
        errorMessage: submitErr instanceof Error ? submitErr.message : "Submission failed",
      });
      return NextResponse.json(
        { error: `AI Singer submission failed. Credits refunded. ${submitErr instanceof Error ? submitErr.message : ""}`.trim() },
        { status: 503 }
      );
    }

    return NextResponse.json({
      jobId: job.id,
      status: "processing",
      creditsCost,
      duration: targetDuration,
      genre,
    });
  } catch (error) {
    console.error("[AI-SINGER] API error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
