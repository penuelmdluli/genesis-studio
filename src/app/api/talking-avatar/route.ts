import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId, createJob, updateJobStatus } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// TTS generation + R2 upload can take 30-60s
export const maxDuration = 120;

const FAL_AVATAR_MODEL = "fal-ai/kling-video/v2.6/pro/image-to-video";

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Rate limiting
    const rateCategory = user.plan === "free" ? "feature:free" : "feature:paid";
    const rateCheck = checkRateLimit(user.id, rateCategory);
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded. Please wait before trying again.", resetAt: rateCheck.resetAt }, { status: 429 });
    }

    const body = await req.json();
    const { imageUrl, text, audioUrl, voiceId, duration, language, tone, aspectRatio, background } = body as {
      imageUrl: string;
      text?: string;
      audioUrl?: string;
      voiceId?: string;
      duration?: number;
      language?: string;
      tone?: string;
      aspectRatio?: string;
      background?: string;
    };

    // Validate required fields
    if (!imageUrl) {
      return NextResponse.json(
        { error: "Face image is required" },
        { status: 400 }
      );
    }

    if (!text && !audioUrl) {
      return NextResponse.json(
        { error: "Either text script or audio file is required" },
        { status: 400 }
      );
    }

    // Plan check: must be creator+, or owner
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const allowedPlans = ["creator", "pro", "studio"];
      if (!allowedPlans.includes(user.plan)) {
        return NextResponse.json(
          { error: "Talking Avatar requires a Creator or higher plan" },
          { status: 403 }
        );
      }
    }

    // Calculate credit cost: 120 credits per 10 seconds
    // Uses Kling 2.6 Pro (~$0.065/sec) → 10s = $0.65 → 120 credits ($2.88) = 4.4x markup
    const effectiveDuration = duration || 10;
    const creditsCost = Math.ceil(effectiveDuration / 10) * 120;

    // Deduct credits (owners skip)
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        creditsCost,
        "",
        `Talking Avatar: ${effectiveDuration}s ${language || "en"}`
      );

      if (!success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditsCost,
            balance: newBalance,
          },
          { status: 402 }
        );
      }
    }

    // Check FAL key
    if (!process.env.FAL_KEY) {
      if (!ownerAccount) {
        await refundCredits(user.id, creditsCost, "", "Talking Avatar service not configured — automatic refund");
      }
      return NextResponse.json(
        { error: "Talking Avatar is temporarily unavailable. Credits have been refunded." },
        { status: 503 }
      );
    }

    try {
      // Step 1: Generate TTS audio from text if no audio file provided
      let finalAudioUrl = audioUrl;
      if (text && !audioUrl) {
        try {
          // Use Edge TTS (free) to generate speech from the script
          const { MsEdgeTTS, OUTPUT_FORMAT } = await import("msedge-tts");
          const tts = new MsEdgeTTS();
          const voiceMap: Record<string, string> = {
            "voice-aria": "en-US-AriaNeural",
            "voice-james": "en-US-GuyNeural",
            "voice-luna": "en-US-JennyNeural",
            "voice-alex": "en-US-DavisNeural",
            "voice-sophia": "en-US-SaraNeural",
            "voice-marcus": "en-US-TonyNeural",
            "voice-naledi": "en-ZA-LeahNeural",
            "voice-thabo": "en-ZA-LukeNeural",
            "voice-sakura": "ja-JP-NanamiNeural",
            "voice-carlos": "es-MX-JorgeNeural",
            "voice-amelie": "fr-FR-DeniseNeural",
            "voice-hans": "de-DE-ConradNeural",
          };
          const ttsVoice = voiceMap[voiceId || ""] || "en-US-AriaNeural";
          await tts.setMetadata(ttsVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);
          const { audioStream } = tts.toStream(text);
          const chunks: Buffer[] = [];
          for await (const chunk of audioStream) {
            if (Buffer.isBuffer(chunk)) chunks.push(chunk);
          }
          const audioBuffer = Buffer.concat(chunks);

          // Upload TTS audio to R2
          const { uploadAudio, audioStorageKey } = await import("@/lib/storage");
          const audioKey = audioStorageKey(user.id, `avatar-${Date.now()}`);
          await uploadAudio(audioKey, audioBuffer);
          const { r2PublicUrl } = await import("@/lib/storage");
          finalAudioUrl = r2PublicUrl(audioKey);
          console.log(`[TALKING AVATAR] TTS audio generated: ${ttsVoice}, ${audioBuffer.length} bytes`);
        } catch (ttsErr) {
          console.warn("[TALKING AVATAR] TTS failed, falling back to prompt-only:", ttsErr);
        }
      }

      // Step 2: Build prompt with tone, background, and delivery style
      const toneDirections: Record<string, string> = {
        professional: "Confident, authoritative delivery. Measured pace, composed facial expressions, direct eye contact.",
        friendly: "Warm, approachable delivery. Natural smile, relaxed demeanor, conversational pace.",
        urgent: "High-energy, compelling delivery. Leaning slightly forward, emphatic gestures, faster pace.",
        inspirational: "Passionate, motivational delivery. Expressive eyes, deliberate pauses for impact, sweeping gestures.",
        humorous: "Light-hearted, witty delivery. Playful expressions, comedic timing, animated facial reactions.",
        calm: "Soothing, reassuring delivery. Gentle pace, soft expressions, steady eye contact.",
      };
      const toneDirection = toneDirections[tone || ""] || toneDirections.professional;

      const bgScene = background
        ? `Setting: ${background}.`
        : "Professional studio setting with soft lighting.";

      const avatarPrompt = text
        ? `A person speaking directly to camera: "${text.slice(0, 300)}". ${toneDirection} ${bgScene} Perfect lip synchronization, natural head movement, eye contact with viewer.`
        : `A person speaking naturally to camera. ${toneDirection} ${bgScene} Expressive facial movement, gestures, and lip sync.`;

      // Map aspect ratio to FAL format and DB format
      type DbAR = "landscape" | "portrait" | "square";
      const arMap: Record<string, { fal: string; db: DbAR }> = {
        "16:9": { fal: "16:9", db: "landscape" },
        "9:16": { fal: "9:16", db: "portrait" },
        "1:1": { fal: "1:1", db: "square" },
      };
      const ar = arMap[aspectRatio || ""] || arMap["16:9"];

      // Create a job record in the database for polling
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
        aspectRatio: ar.db,
        audioUrl: finalAudioUrl,
      });

      // Step 3: Submit to Kling with native audio for lip sync
      const result = await fal.queue.submit(FAL_AVATAR_MODEL, {
        input: {
          prompt: avatarPrompt,
          image_url: imageUrl,
          duration: String(Math.min(effectiveDuration, 10)),
          aspect_ratio: ar.fal,
          native_audio: true,
        },
      });

      // Store the FAL request ID on the job for polling
      await updateJobStatus(job.id, {
        runpodJobId: result.request_id,
      });

      return NextResponse.json({
        jobId: job.id,
        creditsCost,
        estimatedTime: Math.ceil(effectiveDuration / 10) * 60,
      });
    } catch (gpuError) {
      console.error("Talking Avatar FAL error:", gpuError);

      // Refund credits on failure
      if (!ownerAccount) {
        await refundCredits(
          user.id,
          creditsCost,
          "",
          "Talking Avatar submission failed — automatic refund"
        );
      }

      return NextResponse.json(
        { error: "Submission failed. Credits refunded." },
        { status: 503 }
      );
    }
  } catch (error) {
    console.error("Talking Avatar error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
