import { NextRequest, NextResponse } from "next/server";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

// Sample phrases per language for voice previews
const SAMPLE_TEXT: Record<string, string> = {
  en: "Hello! This is how my voice sounds. I can narrate your videos with clarity and expression.",
  "en-ZA": "Hello! This is how my voice sounds. I can narrate your videos with clarity and expression.",
  ja: "\u3053\u3093\u306b\u3061\u306f\uff01\u79c1\u306e\u58f0\u306f\u3053\u306e\u3088\u3046\u306b\u805e\u3053\u3048\u307e\u3059\u3002",
  es: "\u00a1Hola! As\u00ed es como suena mi voz. Puedo narrar tus videos con claridad.",
  fr: "Bonjour! Voici comment sonne ma voix. Je peux narrer vos vid\u00e9os avec clart\u00e9.",
  de: "Hallo! So klingt meine Stimme. Ich kann Ihre Videos klar und ausdrucksvoll vertonen.",
};

// Map voice IDs to Edge TTS voice names
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
};

// In-memory cache to avoid regenerating the same preview
const previewCache = new Map<string, { buffer: Buffer; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

export async function GET(req: NextRequest) {
  try {
    const voiceId = req.nextUrl.searchParams.get("voiceId");
    if (!voiceId || !VOICE_MAP[voiceId]) {
      return NextResponse.json({ error: "Invalid voiceId" }, { status: 400 });
    }

    // Check cache
    const cached = previewCache.get(voiceId);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        headers: {
          "Content-Type": "audio/mpeg",
          "Content-Length": cached.buffer.length.toString(),
          "Cache-Control": "public, max-age=3600",
        },
      });
    }

    const edgeVoice = VOICE_MAP[voiceId];
    const language = voiceId.includes("sakura")
      ? "ja"
      : voiceId.includes("carlos")
        ? "es"
        : voiceId.includes("amelie")
          ? "fr"
          : voiceId.includes("hans")
            ? "de"
            : voiceId.includes("naledi") || voiceId.includes("thabo")
              ? "en-ZA"
              : "en";

    const sampleText = SAMPLE_TEXT[language] || SAMPLE_TEXT["en"];

    const tts = new MsEdgeTTS();
    await tts.setMetadata(edgeVoice, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3);

    const { audioStream } = tts.toStream(sampleText, { rate: "+0%", pitch: "+0Hz" });

    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      audioStream.on("data", (chunk: Buffer) => chunks.push(chunk));
      audioStream.on("end", () => resolve());
      audioStream.on("error", (err: Error) => reject(err));
      audioStream.on("close", () => resolve());
    });

    const audioBuffer = Buffer.concat(chunks);

    if (audioBuffer.length === 0) {
      return NextResponse.json({ error: "Failed to generate preview" }, { status: 500 });
    }

    // Cache the result
    previewCache.set(voiceId, { buffer: audioBuffer, timestamp: Date.now() });

    return new NextResponse(new Uint8Array(audioBuffer), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.length.toString(),
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.error("[voiceover/preview] Error:", err);
    return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
  }
}
