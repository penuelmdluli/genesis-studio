import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId, deductCredits, getCreditBalance } from "@/lib/credits";
import { planProduction, calculateBrainCredits, estimateBrainCredits } from "@/lib/genesis-brain/planner";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import { createProduction, updateProduction } from "@/lib/genesis-brain/orchestrator";
import { checkBudget, recordApiCall } from "@/lib/api-budget";
import { checkRateLimit } from "@/lib/fraud";
import { BrainInput } from "@/types";

const PLANNING_FEE_CREDITS = 5; // Claude Sonnet is expensive — charge upfront

export async function POST(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Plan access: Creator+ only (free plan is locked)
    const ownerAccount = isOwnerClerkId(clerkId);
    if (!ownerAccount && user.plan === "free") {
      return NextResponse.json(
        { error: "Brain Studio requires Creator plan or higher. Upgrade to unlock the AI Director." },
        { status: 403 }
      );
    }

    // Rate limit: 10 plans per hour
    const rateCheck = checkRateLimit(clerkId, "brain:plan");
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many plan requests. Try again in a few minutes." },
        { status: 429 }
      );
    }

    // Budget guard: Claude Sonnet is expensive
    const budgetCheck = checkBudget("claude:brain");
    if (!budgetCheck.allowed) {
      return NextResponse.json(
        { error: "Brain Studio planning is temporarily unavailable. Try again later." },
        { status: 503 }
      );
    }

    const body: BrainInput = await req.json();

    // Validate input
    if (!body.concept || body.concept.trim().length < 10) {
      return NextResponse.json({ error: "Concept must be at least 10 characters" }, { status: 400 });
    }
    if (body.targetDuration < 15 || body.targetDuration > 120) {
      return NextResponse.json({ error: "Duration must be between 15 and 120 seconds" }, { status: 400 });
    }

    // Charge planning fee upfront (Claude Sonnet costs ~$0.01-0.03 per plan)
    if (!ownerAccount) {
      const balance = await getCreditBalance(user.id);
      if (balance < PLANNING_FEE_CREDITS) {
        return NextResponse.json(
          { error: `Insufficient credits. Planning requires ${PLANNING_FEE_CREDITS} credits.`, required: PLANNING_FEE_CREDITS, balance },
          { status: 402 }
        );
      }
      await deductCredits(user.id, PLANNING_FEE_CREDITS, `brain-plan-${Date.now()}`, "Brain Studio AI planning fee");
    }

    // Create initial production record
    const production = await createProduction(user.id, body);

    // Generate plan with Claude
    let plan = await planProduction(body);
    recordApiCall("claude:brain");

    // Apply consistency engine
    plan = consistencyEngine.applyAll(plan, body.brandKit);

    // Store voice settings in the plan so produce route can access them
    if (body.voiceoverVoice) {
      (plan as unknown as Record<string, unknown>).voiceoverVoice = body.voiceoverVoice;
    }
    if (body.voiceoverLanguage) {
      (plan as unknown as Record<string, unknown>).voiceoverLanguage = body.voiceoverLanguage;
    }

    // Calculate credit cost
    const totalCredits = calculateBrainCredits(plan, body);

    // Update production with plan
    await updateProduction(production.id, {
      status: "planned",
      plan: JSON.stringify(plan),
      total_credits: totalCredits,
    });

    return NextResponse.json({
      productionId: production.id,
      plan,
      totalCredits,
      estimatedTime: plan.scenes.length * 60 + 30, // rough estimate in seconds
    });
  } catch (error) {
    console.error("Brain plan error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate plan" },
      { status: 500 }
    );
  }
}
