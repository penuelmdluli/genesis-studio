// ============================================
// GENESIS STUDIO — AI Action Figure: write the special features
// ============================================
// POST /api/action-figure/features → { features: string[] }
//
// The "write them for me" button next to the features box, built the same way
// as AI Singer's "write lyrics for me": a small Claude call, a flat 5 credits,
// and the result dropped straight into the field for the creator to edit. The
// text still goes through the same blocklist the generate route uses, because
// a name typed here reaches the packaging art just as surely as one typed
// there.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { deductCredits, isOwnerClerkId } from "@/lib/credits";
import { checkRateLimit } from "@/lib/fraud";
import { checkBudget, recordApiCall } from "@/lib/api-budget";
import {
  MAX_FEATURES,
  MIN_FEATURES,
  blockedPublicFigure,
  normaliseFeatures,
  normaliseFigureName,
  PUBLIC_FIGURE_MESSAGE,
} from "@/lib/action-figure";

const CREDIT_COST = 5;

const SYSTEM_PROMPT = `You write the "special features" printed on the back of a toy action figure box, in the voice of an over-excited 1990s toy commercial announcer.

Rules:
- Return exactly ${MAX_FEATURES} features, one per line, nothing else.
- No numbering, no bullets, no quotation marks, no headings.
- Each line is at most 8 words and reads well shouted out loud.
- Each line describes a power, an accessory or a catchphrase — something a toy would have.
- Keep it warm and funny. Never insulting, never sexual, never about real public figures.`;

export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const rateCheck = checkRateLimit(user.id, user.plan === "free" ? "feature:free" : "feature:paid");
    if (!rateCheck.allowed) {
      return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
    }

    const { figureName, about } = (await req.json().catch(() => ({}))) as {
      figureName?: string;
      about?: string;
    };

    const name = normaliseFigureName(figureName || "");
    if (!name) {
      return NextResponse.json({ error: "Name your figure first — it goes on the box" }, { status: 400 });
    }

    const description = String(about || "").replace(/\s+/g, " ").trim().slice(0, 300);

    const blocked = blockedPublicFigure(name, description);
    if (blocked) {
      return NextResponse.json({ error: PUBLIC_FIGURE_MESSAGE }, { status: 403 });
    }

    const apiKey = process.env.GENESIS_CLAUDE_KEY || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "This helper is not available right now" }, { status: 503 });
    }

    const budget = checkBudget("claude:chat");
    if (!budget.allowed) {
      return NextResponse.json({ error: "This helper is busy — type your own features for now" }, { status: 503 });
    }

    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount) {
      const { success, newBalance } = await deductCredits(
        user.id,
        CREDIT_COST,
        "",
        `Action Figure features: ${name}`
      );
      if (!success) {
        return NextResponse.json(
          { error: "Insufficient credits", required: CREDIT_COST, balance: newBalance },
          { status: 402 }
        );
      }
    }

    const res = await fetch("https://api.anthropic.com/v1/messages", {
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
            content: description
              ? `The figure is called "${name}". About them: ${description}`
              : `The figure is called "${name}".`,
          },
        ],
      }),
    });

    recordApiCall("claude:chat");

    if (!res.ok) {
      console.error("[ACTION-FIGURE] features API error:", res.status, (await res.text()).slice(0, 200));
      return NextResponse.json({ error: "Couldn't write the features right now" }, { status: 503 });
    }

    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = (data.content || [])
      .filter((c) => c.type === "text")
      .map((c) => c.text || "")
      .join("\n");

    const features = normaliseFeatures(text);
    if (features.length < MIN_FEATURES) {
      return NextResponse.json({ error: "Couldn't write the features right now" }, { status: 502 });
    }

    // Claude was told not to name anyone real, but the check is here anyway:
    // the list is what the box gets printed from either way.
    const blockedOutput = blockedPublicFigure(features.join(" "));
    if (blockedOutput) {
      return NextResponse.json({ error: "Couldn't write the features right now" }, { status: 502 });
    }

    return NextResponse.json({ features, creditsCost: ownerAccount ? 0 : CREDIT_COST });
  } catch (error) {
    console.error("[ACTION-FIGURE] features error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
