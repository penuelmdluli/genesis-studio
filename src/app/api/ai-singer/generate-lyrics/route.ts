import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";

const CREDIT_COST = 5;

const MOOD_HINTS: Record<string, string> = {
  hype: "energetic, confident, celebratory, party anthem vibes",
  emotional: "deep feelings, vulnerability, heartfelt, tears and truth",
  romantic: "love, passion, desire, intimate connection",
  dark: "moody, intense, raw pain, shadows and struggle",
  motivational: "uplifting, empowering, overcoming obstacles, rise up",
  fun: "playful, witty, catchy hooks, smile-inducing",
  spiritual: "faith, gratitude, higher power, peace and purpose",
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

    const rateCheck = checkRateLimit(user.id, "feature:paid");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { theme, genre, mood, duration } = (await req.json()) as {
      theme: string;
      genre?: string;
      mood?: string;
      duration?: number;
    };

    if (!theme || theme.length < 5) {
      return NextResponse.json({ error: "Describe what your song should be about (at least 5 characters)" }, { status: 400 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const { success } = await deductCredits(user.id, CREDIT_COST, "", `AI Lyrics: "${theme.slice(0, 50)}"`);
      if (!success) {
        return NextResponse.json({ error: "Insufficient credits", required: CREDIT_COST }, { status: 402 });
      }
    }

    const apiKey = process.env.ANTHROPIC_API_KEY || process.env.GENESIS_CLAUDE_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "Lyrics service not configured" }, { status: 503 });
    }

    const targetDuration = duration || 30;
    const verses = targetDuration <= 15 ? 1 : targetDuration <= 30 ? 2 : 3;
    const moodHint = MOOD_HINTS[mood || "fun"] || MOOD_HINTS.fun;
    const genreHint = genre || "pop";

    const systemPrompt = `You are a world-class songwriter who writes viral hit songs. Write lyrics that are catchy, emotional, and memorable. Use modern slang and references that resonate with Gen Z and content creators. Every line should be quotable.`;

    const userPrompt = `Write a ${genreHint} song about: ${theme}

Mood: ${moodHint}
Structure: ${verses} verse(s) + 1 chorus (repeat chorus after each verse)
Length: Short enough for a ${targetDuration}-second video

Rules:
- Use [Verse 1], [Chorus], [Verse 2], [Bridge] tags
- Keep lines short and punchy (great for lip sync)
- Make the chorus the catchiest part — it should stick in your head
- Include ad-libs in parentheses where they fit naturally (yeah, oh, uh)
- ${genreHint === "afrobeats" || genreHint === "amapiano" ? "Mix English with a few Zulu/Xhosa words for authenticity" : ""}
- NO explanations, just the lyrics
- Start with a suggested song title on the first line: "Title: ..."`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        messages: [
          { role: "user", content: userPrompt },
        ],
        system: systemPrompt,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[LYRICS] Claude API error:", err);
      return NextResponse.json({ error: "Lyrics generation failed" }, { status: 503 });
    }

    const data = (await res.json()) as {
      content: Array<{ type: string; text?: string }>;
    };

    const lyricsText = data.content
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n")
      .trim();

    // Extract title if present
    let title = "";
    let lyrics = lyricsText;
    const titleMatch = lyricsText.match(/^Title:\s*["']?([^"'\n]+)["']?\s*\n/i);
    if (titleMatch) {
      title = titleMatch[1].trim();
      lyrics = lyricsText.replace(titleMatch[0], "").trim();
    }

    return NextResponse.json({
      lyrics,
      title,
      genre: genreHint,
      mood: mood || "fun",
      creditsCost: CREDIT_COST,
    });
  } catch (error) {
    console.error("[LYRICS] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
