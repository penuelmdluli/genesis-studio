import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY || "";

const SUPPORTED_LANGUAGES = [
  { code: "zu", name: "Zulu (isiZulu)" },
  { code: "af", name: "Afrikaans" },
  { code: "xh", name: "Xhosa (isiXhosa)" },
  { code: "st", name: "Sotho (Sesotho)" },
  { code: "tn", name: "Tswana (Setswana)" },
  { code: "nr", name: "Ndebele (isiNdebele)" },
  { code: "ss", name: "Swazi (siSwati)" },
  { code: "ts", name: "Tsonga (Xitsonga)" },
  { code: "ve", name: "Venda (Tshivenda)" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "pt", name: "Portuguese" },
  { code: "sw", name: "Swahili" },
  { code: "auto", name: "Auto-detect" },
];

export { SUPPORTED_LANGUAGES };

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limit: 30 per 10 minutes
    const rateCheck = checkRateLimit(userId, "translate:all");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Try again in a few minutes." },
        { status: 429 }
      );
    }

    // Daily budget guard
    const budgetCheck = checkBudget("claude:translate");
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: "Translation is temporarily unavailable. Please try again later." },
        { status: 503 }
      );
    }

    const { prompt, sourceLanguage = "auto" } = await req.json();

    if (!prompt || typeof prompt !== "string" || prompt.trim().length < 2) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    if (!ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: "Translation not configured" }, { status: 503 });
    }

    const langName = SUPPORTED_LANGUAGES.find(l => l.code === sourceLanguage)?.name || "the source language";
    const systemPrompt = sourceLanguage === "auto"
      ? "You are a translator. Detect the language of the input text and translate it to English. The text is a prompt for AI video generation, so preserve the visual and cinematic intent. Return ONLY the English translation, nothing else."
      : `You are a translator. Translate the following ${langName} text to English. The text is a prompt for AI video generation, so preserve the visual and cinematic intent. Return ONLY the English translation, nothing else.`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: prompt.trim() }],
      }),
    });

    if (!res.ok) {
      console.error("[TRANSLATE] Anthropic API error:", await res.text());
      return NextResponse.json({ error: "Translation failed" }, { status: 503 });
    }

    recordApiCall("claude:translate");

    const data = await res.json();
    const translated = data.content?.[0]?.text?.trim() || prompt;

    return NextResponse.json({
      translated,
      original: prompt.trim(),
      sourceLanguage: sourceLanguage === "auto" ? "auto-detected" : sourceLanguage,
    });
  } catch (error) {
    console.error("[TRANSLATE] Error:", error);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
