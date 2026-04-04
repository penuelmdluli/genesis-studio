import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { planProduction, calculateBrainCredits, estimateBrainCredits } from "@/lib/genesis-brain/planner";
import { consistencyEngine } from "@/lib/genesis-brain/consistency";
import { createProduction, updateProduction } from "@/lib/genesis-brain/orchestrator";
import { BrainInput } from "@/types";

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

    const body: BrainInput = await req.json();

    // Validate input
    if (!body.concept || body.concept.trim().length < 10) {
      return NextResponse.json({ error: "Concept must be at least 10 characters" }, { status: 400 });
    }
    if (body.targetDuration < 15 || body.targetDuration > 120) {
      return NextResponse.json({ error: "Duration must be between 15 and 120 seconds" }, { status: 400 });
    }

    // Create initial production record
    const production = await createProduction(user.id, body);

    // Generate plan with Claude
    let plan = await planProduction(body);

    // Apply consistency engine
    plan = consistencyEngine.applyAll(plan, body.brandKit);

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
