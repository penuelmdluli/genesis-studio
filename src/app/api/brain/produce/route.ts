import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { getProduction, executeProduction, updateProduction } from "@/lib/genesis-brain/orchestrator";

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

    const { productionId, plan: updatedPlan } = await req.json();
    if (!productionId) {
      return NextResponse.json({ error: "productionId required" }, { status: 400 });
    }

    const production = await getProduction(productionId);
    if (!production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }
    if (production.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }
    if (production.status !== "planned") {
      return NextResponse.json(
        { error: `Cannot produce: production is ${production.status}` },
        { status: 400 }
      );
    }

    // If user sent an updated plan (edited scenes), use that
    const plan = updatedPlan || production.plan;
    if (!plan) {
      return NextResponse.json({ error: "No plan found" }, { status: 400 });
    }

    // If plan was updated, save it
    if (updatedPlan) {
      await updateProduction(productionId, {
        plan: JSON.stringify(updatedPlan),
      });
    }

    // Reconstruct input from production
    const input = {
      concept: production.concept,
      targetDuration: production.targetDuration,
      style: production.style,
      aspectRatio: production.aspectRatio,
      voiceover: production.voiceover,
      music: production.music,
      captions: production.captions,
    };

    // Execute in background (non-blocking)
    executeProduction(productionId, user.id, clerkId, plan, input).catch((err) => {
      console.error(`[BRAIN] Background execution failed for ${productionId}:`, err);
    });

    return NextResponse.json({
      productionId,
      status: "generating",
      message: "Production started. Track progress at /api/brain/status/" + productionId,
    });
  } catch (error) {
    console.error("Brain produce error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start production" },
      { status: 500 }
    );
  }
}
