import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are a content moderation system for a video generation platform. Your job is to evaluate whether a user's prompt would result in harmful video content.

You MUST block prompts that fall into any of these categories:
- **Deepfakes**: Prompts requesting realistic depictions of real public figures (politicians, celebrities, etc.) in fabricated scenarios.
- **Violence/Gore/Weapons**: Prompts depicting graphic violence, gore, torture, or detailed weapon usage/creation.
- **Sexual/NSFW**: Prompts requesting sexually explicit, pornographic, or nudity-focused content.
- **Hate Speech/Discrimination**: Prompts promoting hatred, discrimination, or dehumanization based on race, ethnicity, religion, gender, sexual orientation, disability, or other protected characteristics.
- **Child Exploitation**: ANY prompt involving minors in harmful, sexual, or exploitative contexts. This is an ABSOLUTE block with zero tolerance.
- **Terrorism/Extremism**: Prompts promoting terrorist acts, radicalization, or extremist ideologies.
- **Harassment/Bullying**: Prompts targeting specific real individuals for harassment, intimidation, or bullying.

Respond ONLY with a JSON object (no markdown, no code fences):
{ "safe": boolean, "reason": "string if unsafe", "category": "string if unsafe" }

If the prompt is safe, respond: { "safe": true }
If the prompt is unsafe, respond with safe: false, a brief reason, and the category name from the list above.`;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Missing or invalid prompt" },
        { status: 400 }
      );
    }

    if (!ANTHROPIC_API_KEY) {
      // Fail open so generation isn't blocked
      return NextResponse.json({ safe: true });
    }

    // Daily budget check — fail open if exceeded
    const budgetCheck = checkBudget("claude:moderate");
    if (!budgetCheck.allowed) {
      return NextResponse.json({ safe: true });
    }

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 150,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: "user",
            content: `Evaluate this video generation prompt for harmful content:\n\n"${prompt}"`,
          },
        ],
      }),
    });

    recordApiCall("claude:moderate");

    if (!response.ok) {
      console.error(
        "Anthropic API error:",
        response.status,
        await response.text()
      );
      // Fail open so generation isn't blocked
      return NextResponse.json({ safe: true });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text ?? "";

    const result = JSON.parse(text) as {
      safe: boolean;
      reason?: string;
      category?: string;
    };

    return NextResponse.json({
      safe: result.safe,
      ...(result.reason && { reason: result.reason }),
    });
  } catch (error) {
    console.error("Moderation check failed:", error);
    // Fail open so generation isn't blocked
    return NextResponse.json({ safe: true });
  }
}
