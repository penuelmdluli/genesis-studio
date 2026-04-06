import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

const SYSTEM_PROMPT = `You are a cinematic video prompt enhancer. Your job is to take a user's basic video generation prompt and transform it into a richly detailed, cinematic prompt optimized for AI video generation.

Rules:
- Keep the enhanced prompt under 500 characters.
- Do NOT change the subject or core concept of the original prompt.
- Focus on enhancing with: camera angles, lighting, mood, motion, textures, and visual style.
- Write in a direct, descriptive style — no preamble, no quotes, just the enhanced prompt text.
- Output ONLY the enhanced prompt, nothing else.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { prompt, type } = body as {
      prompt: string;
      type: "t2v" | "i2v" | "v2v";
    };

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    if (!type || !["t2v", "i2v", "v2v"].includes(type)) {
      return NextResponse.json(
        { error: "Invalid type. Must be t2v, i2v, or v2v" },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      console.error("ANTHROPIC_API_KEY is not configured");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const typeContext =
      type === "t2v"
        ? "text-to-video generation"
        : type === "i2v"
          ? "image-to-video generation"
          : "video-to-video generation";

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Enhance this prompt for ${typeContext}:\n\n${prompt}`,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error("Anthropic API error:", response.status, errorData);
      return NextResponse.json(
        { error: "Failed to enhance prompt" },
        { status: 502 }
      );
    }

    const data = await response.json();
    const enhanced =
      data?.content?.[0]?.text?.trim() ?? "Failed to generate enhanced prompt";

    return NextResponse.json({ enhanced, original: prompt });
  } catch (error) {
    console.error("Prompt enhance error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
