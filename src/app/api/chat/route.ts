import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are the Genesis Studio AI assistant. You help users with the AI video creation platform.

FEATURES:
- Video Generation: Text-to-video and image-to-video using Wan 2.2, Kling 2.6/3.0, Veo 3.1, Seedance 1.5
- Native Audio: Kling 2.6+ and Veo 3.1 generate videos WITH dialogue, sound effects, and lip sync
- Motion Control: Transfer dance/motion from reference video to any character
- Brain Studio: Write a script, AI creates a multi-scene short film with full audio
- Talking Avatar: Upload face photo + script for talking head video with lip sync
- Auto Captions: AI transcription and subtitle generation from video
- AI Voiceover: Add narration to any video with neural voices
- Upscaler: Enhance video to 1080p or 4K
- AI Thumbnails: Generate thumbnail images from prompts
- Explore: Public community feed where users share and recreate videos

PRICING (monthly):
- Free: 50 credits, Wan 2.2 + Seedance only, watermarked, 720p max
- Creator ($15/mo): 500 credits, + Kling 2.6, no watermark, 1080p
- Pro ($39/mo): 2,000 credits, + Kling 3.0, Veo 3.1, Brain Studio, 4K
- Studio ($99/mo): 10,000 credits, everything, API access, white-label

CREDIT COSTS (5 seconds):
- Wan 2.2 720p: 40 credits | Kling 2.6 720p: 50 credits
- Kling 3.0 720p: 70 credits | Veo 3.1 720p: 100 credits
- Captions: 2 credits/min | Voiceover: 3 credits/30s
- Thumbnails: 1-2 credits | Upscale: 5 credits/5s

Be friendly, concise, and helpful. Keep responses SHORT (2-3 sentences). If you don't know account-specific details, direct users to Settings.`;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { message } = await req.json();

    if (!message || typeof message !== "string" || message.trim().length === 0) {
      return NextResponse.json({ error: "Invalid message" }, { status: 400 });
    }

    if (message.length > 2000) {
      return NextResponse.json({ error: "Message too long (max 2000 characters)" }, { status: 400 });
    }

    // Rate limit: 20 messages per hour per user
    const rateCheck = checkRateLimit(userId, "chat:user");
    if (!rateCheck.allowed) {
      return NextResponse.json({
        reply: `You've reached the chat limit (20 messages/hour). Try again in ${Math.ceil((rateCheck.resetAt - Date.now()) / 60_000)} minutes, or email hello@genesis-studio.app for help.`,
      });
    }

    // Daily budget check
    const budgetCheck = checkBudget("claude:chat");
    if (!budgetCheck.allowed) {
      return NextResponse.json({
        reply: "The AI assistant is taking a break right now. For help, email hello@genesis-studio.app or check our docs at /docs.",
      });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({
        reply: "The AI assistant is not configured yet. Please contact support at hello@genesis-studio.app for help.",
      });
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 300,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: message.trim() }],
      }),
    });

    recordApiCall("claude:chat");

    if (!res.ok) {
      console.error("[chat] Anthropic API error:", res.status);
      return NextResponse.json({
        reply: "I'm having trouble connecting right now. Try again in a moment, or email hello@genesis-studio.app for help.",
      });
    }

    const data = await res.json();
    const reply = data.content?.[0]?.text || "I couldn't generate a response. Please try again.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json({
      reply: "Something went wrong. Please try again or contact support.",
    });
  }
}
