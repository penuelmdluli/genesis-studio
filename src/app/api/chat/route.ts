import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";

const ANTHROPIC_API_KEY = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are Genesis — the AI assistant for Genesis Studio (ivideostudio.ai), an AI video platform.

RULES:
1. MAX 2 sentences per response. Never more. Be direct.
2. Always include a relevant link when applicable:
   - Create video: /generate
   - Brain Studio (multi-scene films): /brain
   - Mimic Studio (dance transfer): /mimic
   - Voiceover: /voiceover
   - Captions: /captions
   - Gallery: /gallery
   - Pricing/upgrade: /pricing
   - Settings: /settings
3. Understand what they ACTUALLY need before answering.
4. Sell only when natural — don't push on every message.

QUICK ANSWERS (match and respond directly):
- "how to create/make video" → "Head to /generate — type your prompt and pick a model. Seedance is fastest, Kling has lip-sync!"
- "pricing/cost/credits/how much" → "Check /pricing — Free gets 100 credits, Creator (R220/mo) gets 500. One video = 80-100 credits."
- "stuck/not working/error/bug" → "Sorry about that! Try refreshing. If it persists, I'll connect you with our team. [ESCALATE]"
- "brain studio/short film" → "Go to /brain — write one concept, get a full film with voiceover, music and captions."
- "cancel/refund/payment issue" → "[ESCALATE] I'll get our team to help with your account right away."
- "what can I do/features" → "You can create AI videos (/generate), full films (/brain), dance transfers (/mimic), voiceovers (/voiceover), and auto-captions (/captions)."
- "quality/best model" → "Kling 2.6 (Creator plan) has the best quality with native audio and lip-sync. Check /pricing to upgrade."
- "hello/hi/hey" → "Hey! What would you like to create today? Head to /generate to start or /brain for a full production."

ESCALATION: Start with [ESCALATE] for: payment issues, account problems, bugs after retry, angry users, legal matters.

Tone: Helpful, brief, warm. Like a friend who knows the product well.`;

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthUserId();
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

    // Detect if this is an internal tool request (script writing, translation, etc.)
    // These come from Avatar Ad Studio, Brain Studio, and other internal AI tools
    const isCreativeRequest =
      message.startsWith("Write a") ||
      message.startsWith("Rewrite") ||
      message.startsWith("Shorten this") ||
      message.startsWith("Make this") ||
      message.startsWith("Add a strong") ||
      message.startsWith("Translate this") ||
      message.startsWith("You are a world-class") ||
      message.startsWith("You are a casting") ||
      message.includes("talking-head script") ||
      message.includes("Return ONLY the script") ||
      message.includes("Return ONLY the") ||
      message.includes("image generation prompt");

    const effectiveSystem = isCreativeRequest
      ? "You are a world-class creative writer and advertising expert. Follow the user's instructions exactly. Return ONLY what they ask for — no preamble, no explanation, no meta-commentary. Do not identify yourself or refuse the request."
      : SYSTEM_PROMPT;

    const effectiveMaxTokens = isCreativeRequest ? 800 : 150;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: effectiveMaxTokens,
        system: effectiveSystem,
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
    let reply = data.content?.[0]?.text || "I couldn't generate a response. Please try again.";

    // Detect escalation — AI flagged this conversation for human attention
    const needsEscalation = reply.includes("[ESCALATE]");
    if (needsEscalation) {
      // Clean the [ESCALATE] tag from user-facing response
      reply = reply.replace("[ESCALATE]", "").trim();

      // Get user info for the escalation
      const { getUserByClerkId } = await import("@/lib/db");
      const user = await getUserByClerkId(userId);

      // Send Slack alert to operator
      try {
        const { sendSlackAlert } = await import("@/lib/alerts");
        await sendSlackAlert({
          level: "warning",
          title: "🚨 Chat Escalation — Human Support Needed",
          message: [
            `*User:* ${user?.name || "Unknown"} (${user?.email || userId})`,
            `*Plan:* ${user?.plan || "free"} | Credits: ${user?.creditBalance ?? "?"}`,
            `*Their message:* "${message.slice(0, 300)}"`,
            `*AI response:* "${reply.slice(0, 300)}"`,
            `*Action needed:* Reply to this user directly`,
          ].join("\n"),
        });
      } catch {
        // Slack alert failed — non-critical
      }

      // Save ticket to database for admin support inbox
      try {
        const { getDb } = await import("@/lib/db-driver");
        const sb = getDb();
        await sb.from("support_tickets").insert({
          user_id: user?.id || userId,
          user_email: user?.email || null,
          user_name: user?.name || null,
          user_plan: user?.plan || "free",
          message: message.slice(0, 2000),
          ai_response: reply.slice(0, 2000),
          status: "open",
          source: "chat",
        });
      } catch {
        // DB insert failed — Slack alert is the fallback
      }

      console.warn(`[CHAT ESCALATION] User: ${user?.email || userId} | Message: ${message.slice(0, 200)}`);
    }

    return NextResponse.json({ reply, escalated: needsEscalation });
  } catch (err) {
    console.error("[chat] Error:", err);
    return NextResponse.json({
      reply: "Something went wrong. Please try again or contact support.",
    });
  }
}
