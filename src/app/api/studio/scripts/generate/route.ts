import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireStudioOwner } from "@/lib/studio/auth";
import {
  getStudioTrends,
  createStudioVideo,
  markTrendUsed,
} from "@/lib/studio/db";
import { NICHE_PROMPTS, CAPTION_TEMPLATES } from "@/lib/studio/niche-prompts";

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireStudioOwner();
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const { trendId, niche, topic, headline } = body as {
      trendId?: string;
      niche?: string;
      topic?: string;
      headline?: string;
    };

    let resolvedNiche: string;
    let resolvedTopic: string;
    let resolvedHeadline: string;

    if (trendId) {
      // Look up the trend from DB — use today's date
      const today = new Date().toISOString().split("T")[0];
      const trends = await getStudioTrends(today);
      const trend = trends?.find((t) => t.id === trendId);
      if (!trend) {
        return NextResponse.json(
          { error: "Trend not found" },
          { status: 404 }
        );
      }
      resolvedNiche = trend.niche;
      resolvedTopic = trend.topic;
      resolvedHeadline = trend.headline;
    } else if (niche && topic && headline) {
      resolvedNiche = niche;
      resolvedTopic = topic;
      resolvedHeadline = headline;
    } else {
      return NextResponse.json(
        { error: "Provide either trendId or all of: niche, topic, headline" },
        { status: 400 }
      );
    }

    const systemPrompt = NICHE_PROMPTS[resolvedNiche];
    if (!systemPrompt) {
      return NextResponse.json(
        { error: `Unknown niche: ${resolvedNiche}` },
        { status: 400 }
      );
    }

    // Generate script via Claude API
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    const message = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Write a script about: ${resolvedHeadline}. Topic: ${resolvedTopic}`,
        },
      ],
    });

    const script =
      message.content[0].type === "text" ? message.content[0].text : "";

    if (!script) {
      return NextResponse.json(
        { error: "Failed to generate script" },
        { status: 500 }
      );
    }

    // Build caption from the first line of the script
    const firstLine = script.split("\n").find((line: string) => line.trim()) || resolvedHeadline;
    const captionFn = CAPTION_TEMPLATES[resolvedNiche] || CAPTION_TEMPLATES.news;
    const caption = captionFn(firstLine.slice(0, 100));

    // Create studio_video record
    const video = await createStudioVideo({
      trend_id: trendId || null,
      niche: resolvedNiche,
      script,
      caption,
      status: "scripted",
    });

    // Mark trend as used if applicable
    if (trendId) {
      await markTrendUsed(trendId);
    }

    return NextResponse.json({
      videoId: video.id,
      script,
      caption,
    });
  } catch (error) {
    console.error("[studio/scripts/generate] Error:", error);
    return NextResponse.json(
      { error: "Failed to generate script" },
      { status: 500 }
    );
  }
}
