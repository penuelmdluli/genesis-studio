import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { submitWsModel, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError } from "@/lib/user-errors";

// AI Singer: lyrics + genre → song → your face sings it.
//
// Async submit-and-return; /api/cron/check-singer advances the pipeline
// every minute. Both stages run on the hosted provider now — the RunPod
// ACE-Step/SadTalker endpoints this used to depend on were never deployed,
// so "Coming soon" was permanent.
//
// Progress stages (runpod_job_id holds the current provider prediction id):
//   10 = song generation submitted
//   50 = lip-sync submitted
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
  amapiano: "amapiano, log drum, south african house, piano, deep bass",
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
    const { faceImageUrl, lyrics, genre, songUrl, songTitle, duration, aspectRatio } = body as {
      faceImageUrl: string;
      lyrics?: string;
      genre?: string;
      songUrl?: string;
      songTitle?: string;
      duration?: number;
      aspectRatio?: string;
    };

    if (!faceImageUrl || !/^https:\/\//.test(faceImageUrl)) {
      return NextResponse.json({ error: "Face image is required" }, { status: 400 });
    }
    if (!lyrics && !songUrl) {
      return NextResponse.json({ error: "Provide lyrics or upload a song" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    const targetDuration = Math.min(Math.max(Number(duration) || 30, 10), 60);
    const ar = aspectRatio === "16:9" ? "16:9" : "9:16";
    // Song ≈ $0.02 flat; lip-sync ≈ $0.075/s → 30s ≈ $2.27. At the cheapest
    // credit tier ($0.01) that needs 230+ credits just to break even, so the
    // rate is 10/s + 30: 30s = 330 credits ($3.30 floor, $7.90 at Creator).
    const creditsCost = 30 + targetDuration * 10;

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(user.id, creditsCost, "", `AI Singer: ${targetDuration}s ${genre || "custom"}`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    const jobTitle = songTitle || `AI Singer: ${genre || "Custom"}`;

    const job = await createJob({
      userId: user.id,
      type: "i2v",
      modelId: "ai-singer",
      prompt: jobTitle,
      negativePrompt: lyrics || undefined, // full lyrics stored here for the cron
      inputImageUrl: faceImageUrl,
      resolution: "720p",
      duration: targetDuration,
      fps: 30,
      isDraft: false,
      creditsCost: ownerAccount ? 0 : creditsCost,
      aspectRatio: ar === "9:16" ? "portrait" : "landscape",
      audioUrl: songUrl || undefined,
    });

    try {
      if (!songUrl && lyrics) {
        const tags = GENRE_TAGS[genre || "pop"] || GENRE_TAGS.pop;
        const prediction = await submitWsModel(WS_MODELS.music, { tags, lyrics, duration: targetDuration });
        await updateJobStatus(job.id, {
          status: "processing",
          runpodJobId: prediction.id,
          provider: "wavespeed",
          progress: 10,
          startedAt: new Date().toISOString(),
        });
        console.log(`[AI-SINGER] Song submitted: ${prediction.id}`);
      } else if (songUrl) {
        const prediction = await submitWsModel(WS_MODELS.lipsyncFromImage, {
          image: faceImageUrl,
          audio: songUrl,
          prompt: "A person singing passionately to camera, expressive, natural head movement",
        });
        await updateJobStatus(job.id, {
          status: "processing",
          runpodJobId: prediction.id,
          provider: "wavespeed",
          progress: 50,
          startedAt: new Date().toISOString(),
        });
        console.log(`[AI-SINGER] Lip-sync submitted (user song): ${prediction.id}`);
      }
    } catch (submitErr) {
      const raw = submitErr instanceof Error ? submitErr.message : String(submitErr);
      console.error("[AI-SINGER] Submit error:", raw);
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, job.id, "AI Singer submit failed — automatic refund");
      }
      const msg = toUserFacingProviderError(raw);
      await updateJobStatus(job.id, { status: "failed", errorMessage: msg });
      return NextResponse.json({ error: msg }, { status: 503 });
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
