import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { fal } from "@fal-ai/client";

fal.config({ credentials: process.env.FAL_KEY || "" });

// In-memory cache for generated previews (avoids regenerating same track)
const previewCache = new Map<string, { url: string; timestamp: number }>();
const CACHE_TTL = 1000 * 60 * 30; // 30 min (FAL URLs expire after ~1hr)

/**
 * POST /api/music-video/preview
 * Generates a 10-second music preview via FAL stable-audio.
 * Cached for 30 minutes to avoid re-generation.
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { mood, bpm, genre } = await req.json();
    if (!mood || !genre) {
      return NextResponse.json({ error: "mood and genre are required" }, { status: 400 });
    }

    // Check cache
    const cacheKey = `${genre}-${bpm}-${mood.slice(0, 30)}`;
    const cached = previewCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({ audioUrl: cached.url });
    }

    // Generate 10s preview
    const prompt = `${mood}, ${genre} style, ${bpm || 110} bpm, instrumental, professional production, radio quality`;

    const result = await fal.subscribe("fal-ai/stable-audio", {
      input: {
        prompt,
        seconds_total: 10,
      },
      logs: false,
    });

    const data = result.data as Record<string, unknown>;
    const audioUrl =
      (data?.audio_file as { url?: string })?.url ||
      (data?.audio_url as string) ||
      "";

    if (!audioUrl) {
      return NextResponse.json({ error: "Preview generation failed" }, { status: 503 });
    }

    // Cache it
    previewCache.set(cacheKey, { url: audioUrl, timestamp: Date.now() });

    // Clean old entries
    for (const [key, val] of previewCache.entries()) {
      if (Date.now() - val.timestamp > CACHE_TTL) previewCache.delete(key);
    }

    return NextResponse.json({ audioUrl });
  } catch (err) {
    console.error("[MUSIC-PREVIEW] Error:", err);
    return NextResponse.json({ error: "Preview generation failed" }, { status: 500 });
  }
}
