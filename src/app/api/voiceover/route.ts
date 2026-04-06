import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, refundCredits, isOwnerClerkId } from "@/lib/credits";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { uploadAudio, audioStorageKey } from "@/lib/storage";
import { randomUUID } from "crypto";
import { checkRateLimit } from "@/lib/fraud";

const MIN_TEXT_LENGTH = 10;
const MAX_TEXT_LENGTH = 5000;
const CHARS_PER_30S = 150;
const CREDITS_PER_30S = 3;

// Map our voice IDs to Edge TTS voice names
const VOICE_MAP: Record<string, string> = {
  "voice-aria": "en-US-AriaNeural",
  "voice-james": "en-US-GuyNeural",
  "voice-luna": "en-US-JennyNeural",
  "voice-alex": "en-US-ChristopherNeural",
  "voice-sophia": "en-US-MichelleNeural",
  "voice-marcus": "en-US-DavisNeural",
  "voice-naledi": "en-ZA-LeahNeural",
  "voice-thabo": "en-ZA-LukeNeural",
  "voice-sakura": "ja-JP-NanamiNeural",
  "voice-carlos": "es-ES-AlvaroNeural",
  "voice-amelie": "fr-FR-DeniseNeural",
  "voice-hans": "de-DE-ConradNeural",
  // Edge TTS neural voice names (from Brain audio module)
  "en-US-GuyNeural": "en-US-GuyNeural",
  "en-US-JennyNeural": "en-US-JennyNeural",
  "en-US-AriaNeural": "en-US-AriaNeural",
  "en-US-DavisNeural": "en-US-DavisNeural",
  "en-GB-RyanNeural": "en-GB-RyanNeural",
  "en-GB-SoniaNeural": "en-GB-SoniaNeural",
  "es-ES-AlvaroNeural": "es-ES-AlvaroNeural",
  "es-ES-ElviraNeural": "es-ES-ElviraNeural",
  "fr-FR-HenriNeural": "fr-FR-HenriNeural",
  "fr-FR-DeniseNeural": "fr-FR-DeniseNeural",
  "zu-ZA-ThandoNeural": "zu-ZA-ThandoNeural",
  "zu-ZA-ThembaNeural": "zu-ZA-ThembaNeural",
  "af-ZA-WillemNeural": "af-ZA-WillemNeural",
  "af-ZA-AdriNeural": "af-ZA-AdriNeural",
};

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
    const { text, voiceId, speed, language } = body as {
      text: string;
      voiceId: string;
      speed?: number;
      language?: string;
    };

    // --- Validation ---
    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    if (text.length < MIN_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be at least ${MIN_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Text must be at most ${MAX_TEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    if (!voiceId || typeof voiceId !== "string") {
      return NextResponse.json({ error: "Voice ID is required" }, { status: 400 });
    }

    const safeSpeed = typeof speed === "number" ? Math.min(Math.max(speed, 0.5), 2.0) : 1.0;

    // --- Credit calculation ---
    const creditCost = Math.ceil(text.length / CHARS_PER_30S) * CREDITS_PER_30S;
    const estimatedDuration = Math.round((text.length / CHARS_PER_30S) * 30);

    const ownerAccount = isOwnerClerkId(clerkId);

    let newBalance: number | undefined;

    if (!ownerAccount) {
      const result = await deductCredits(
        user.id,
        creditCost,
        "",
        `Voiceover: ${voiceId} ${text.length} chars`
      );

      if (!result.success) {
        return NextResponse.json(
          {
            error: "Insufficient credits",
            required: creditCost,
            balance: result.newBalance,
          },
          { status: 402 }
        );
      }

      newBalance = result.newBalance;
    }

    // --- Generate with Edge TTS (free, no API key needed) ---
    try {
      const edgeVoice = VOICE_MAP[voiceId] || "en-US-GuyNeural";

      const tts = new MsEdgeTTS();
      await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

      // Adjust speech rate based on speed parameter
      const ratePercent = Math.round((safeSpeed - 1.0) * 100);
      const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;

      const { audioStream } = tts.toStream(text, { rate: rateStr, pitch: "+0Hz" });

      // Collect all audio chunks into a buffer
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        audioStream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        audioStream.on("end", () => resolve());
        audioStream.on("error", (err: Error) => reject(err));
        audioStream.on("close", () => resolve());
      });

      const audioBuffer = Buffer.concat(chunks);

      if (audioBuffer.length === 0) {
        throw new Error("Edge TTS returned empty audio");
      }

      // Upload to R2
      const jobId = randomUUID();
      const storageKey = audioStorageKey(user.id, jobId);
      await uploadAudio(storageKey, audioBuffer);

      const audioUrl = `/api/audio/${jobId}`;

      return NextResponse.json({
        jobId,
        audioUrl,
        estimatedDuration,
        creditsCost: creditCost,
        newBalance,
        status: "completed",
        voice: edgeVoice,
      });
    } catch (ttsError) {
      console.error("[voiceover] Edge TTS error:", ttsError);

      // Refund on failure
      if (!ownerAccount) {
        const refundedBalance = await refundCredits(
          user.id,
          creditCost,
          "",
          "Voiceover refund: Edge TTS generation failed"
        );
        newBalance = refundedBalance;
      }

      return NextResponse.json(
        { error: "Failed to generate voiceover. Please try again.", newBalance },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("[voiceover] Unhandled error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
