import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { envString } from "@/lib/env";
import { submitWsModel, wsJobRef, WS_MODELS } from "@/lib/wavespeed-tools";
import { toUserFacingProviderError, isOperatorActionable } from "@/lib/user-errors";
import { sendSlackAlert } from "@/lib/alerts";
import { synthesiseSpeech } from "@/lib/edge-tts";

// Photo + script → talking video with real lip sync.
//
// Was Kling i2v on FAL with a "perfect lip synchronization" prompt, which
// produced a person mouthing nothing in particular, and FAL has been locked
// behind a 403 for months anyway. Now: Edge TTS makes the voice (free), the
// audio goes to R2, and a dedicated audio-driven lip-sync model animates the
// photo to it. The job is polled through /api/jobs/[id] like any other
// hosted job (the "ws:" reference tells it where to look).

// TTS generation + R2 upload can take 30-60s
export const maxDuration = 120;

const VOICE_MAP: Record<string, string> = {
  "voice-aria": "en-US-AriaNeural",
  "voice-james": "en-US-GuyNeural",
  "voice-luna": "en-US-JennyNeural",
  "voice-alex": "en-US-DavisNeural",
  "voice-sophia": "en-US-SaraNeural",
  "voice-marcus": "en-US-TonyNeural",
  "voice-naledi": "en-ZA-LeahNeural",
  "voice-thabo": "en-ZA-LukeNeural",
  "voice-thando": "zu-ZA-ThandoNeural",
    "voice-themba": "zu-ZA-ThembaNeural",
    "voice-adri": "af-ZA-AdriNeural",
    "voice-willem": "af-ZA-WillemNeural",
  "voice-sakura": "ja-JP-NanamiNeural",
  "voice-carlos": "es-MX-JorgeNeural",
  "voice-amelie": "fr-FR-DeniseNeural",
  "voice-hans": "de-DE-ConradNeural",
};

async function synthesise(text: string, voiceId: string | undefined, userId: string): Promise<string> {
  // Was `msedge-tts`, which cannot run in this runtime: it reaches the
  // service through a Node WebSocket built on `https.request`, so every
  // typed script failed here before producing a byte. Same protocol, spoken
  // directly.
  const ttsVoice = VOICE_MAP[voiceId || ""] || "en-US-AriaNeural";
  const audioBuffer = Buffer.from(await synthesiseSpeech(text, ttsVoice));
  if (audioBuffer.length === 0) throw new Error("TTS produced empty audio");

  const { uploadAudio, audioStorageKey, r2PublicUrl } = await import("@/lib/storage");
  const audioKey = audioStorageKey(userId, `avatar-${Date.now()}`);
  await uploadAudio(audioKey, audioBuffer);
  console.log(`[TALKING AVATAR] TTS audio generated: ${ttsVoice}, ${audioBuffer.length} bytes`);
  return r2PublicUrl(audioKey);
}

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

    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const { imageUrl, text, audioUrl, voiceId, duration, language, tone, aspectRatio } = body as {
      imageUrl: string;
      text?: string;
      audioUrl?: string;
      voiceId?: string;
      duration?: number;
      language?: string;
      tone?: string;
      aspectRatio?: string;
    };

    if (!imageUrl) {
      return NextResponse.json({ error: "Face image is required" }, { status: 400 });
    }
    if (!text && !audioUrl) {
      return NextResponse.json({ error: "Either text script or audio file is required" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount && !["creator", "pro", "studio"].includes(user.plan)) {
      return NextResponse.json({ error: "Talking Avatar requires a Creator or higher plan" }, { status: 403 });
    }

    // 150 credits per 10s. The lip-sync model bills per second of output
    // (~$0.075/s → 10s ≈ $0.75). Credits are worth $0.010–0.024 depending on
    // the plan, so 150 is 2x cost at the cheapest tier and 4.8x at Creator.
    const effectiveDuration = Math.min(Math.max(Number(duration) || 10, 5), 60);
    const creditsCost = Math.ceil(effectiveDuration / 10) * 150;

    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Talking Avatar: ${effectiveDuration}s ${language || "en"}`
      );
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: creditsCost, balance: newBalance }, { status: 402 });
      }
    }

    if (!envString("WAVESPEED_API_KEY")) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Talking Avatar service not configured — automatic refund");
      }
      return NextResponse.json({ error: "Talking Avatar is temporarily unavailable. Credits have been refunded." }, { status: 503 });
    }

    try {
      // Step 1: the voice. Uploaded audio wins; otherwise synthesise the script.
      let finalAudioUrl = audioUrl;
      if (!finalAudioUrl && text) {
        finalAudioUrl = await synthesise(text, voiceId, user.id);
      }
      if (!finalAudioUrl) throw new Error("No audio could be produced for the script");

      const toneDirections: Record<string, string> = {
        professional: "confident, composed, direct eye contact",
        friendly: "warm, natural smile, relaxed",
        urgent: "high energy, emphatic, leaning in",
        inspirational: "passionate, expressive, deliberate pauses",
        humorous: "playful, animated expressions",
        calm: "soothing, gentle, steady",
      };
      const avatarPrompt = `A person speaking naturally to camera, ${toneDirections[tone || ""] || toneDirections.professional}. Natural head movement and expressions, clear lip sync.`;

      type DbAR = "landscape" | "portrait" | "square";
      const arMap: Record<string, DbAR> = { "16:9": "landscape", "9:16": "portrait", "1:1": "square" };

      // Step 2: a job row the client can poll.
      const job = await createJob({
        userId: user.id,
        type: "i2v",
        modelId: "kling-2.6",
        prompt: avatarPrompt,
        inputImageUrl: imageUrl,
        inputVideoUrl: finalAudioUrl,
        resolution: "720p",
        duration: effectiveDuration,
        fps: 30,
        isDraft: false,
        creditsCost,
        aspectRatio: arMap[aspectRatio || ""] || "landscape",
        audioUrl: finalAudioUrl,
      });

      // Step 3: audio-driven lip sync.
      const prediction = await submitWsModel(WS_MODELS.lipsyncFromImage, {
        image: imageUrl,
        audio: finalAudioUrl,
        prompt: avatarPrompt,
      });

      await updateJobStatus(job.id, {
        runpodJobId: wsJobRef(prediction.id),
        status: "processing",
        provider: "wavespeed",
        startedAt: new Date().toISOString(),
      });

      return NextResponse.json({
        jobId: job.id,
        creditsCost,
        estimatedTime: Math.ceil(effectiveDuration / 10) * 60,
      });
    } catch (gpuError) {
      const raw = gpuError instanceof Error ? gpuError.message : String(gpuError);
      console.error("Talking Avatar error:", raw);

      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Talking Avatar submission failed — automatic refund");
      }
      sendSlackAlert({
        level: isOperatorActionable(raw) ? "critical" : "warning",
        title: "Talking Avatar failed",
        message: `User: ${user.email}\nError: ${raw}`,
      }).catch(() => {});

      return NextResponse.json({ error: toUserFacingProviderError(raw) }, { status: 503 });
    }
  } catch (error) {
    console.error("Talking Avatar error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
