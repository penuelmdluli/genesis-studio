import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { getProduction, getProductionScenes } from "@/lib/genesis-brain/orchestrator";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const productionId = req.nextUrl.searchParams.get("id");
    if (!productionId) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const production = await getProduction(productionId);
    if (!production) {
      return NextResponse.json({ error: "Production not found" }, { status: 404 });
    }
    if (production.userId !== user.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get scene statuses
    const scenes = await getProductionScenes(productionId);

    // Calculate overall progress
    const totalScenes = scenes.length || 1;
    const completedScenes = scenes.filter((s) => s.status === "completed").length;
    const failedScenes = scenes.filter((s) => s.status === "failed").length;

    let progress = production.progress;
    if (production.status === "generating") {
      // 10% for planning, 60% for scene generation, 30% for assembly
      const sceneProgress = totalScenes > 0 ? (completedScenes / totalScenes) * 60 : 0;
      progress = Math.round(10 + sceneProgress);
    } else if (production.status === "assembling") {
      progress = 70 + Math.round((production.progress - 70) || 0);
    } else if (production.status === "completed") {
      progress = 100;
    }

    return NextResponse.json({
      id: production.id,
      status: production.status,
      progress,
      concept: production.concept,
      style: production.style,
      targetDuration: production.targetDuration,
      totalCredits: production.totalCredits,
      outputVideoUrls: production.outputVideoUrls,
      thumbnailUrl: production.thumbnailUrl,
      gifPreviewUrl: production.gifPreviewUrl,
      voiceoverUrl: production.voiceoverUrl,
      musicUrl: production.musicUrl,
      errorMessage: production.errorMessage,
      plan: production.plan,
      scenes: scenes.map((s) => ({
        id: s.id,
        sceneNumber: s.sceneNumber,
        status: s.status,
        progress: s.progress,
        modelId: s.modelId,
        duration: s.duration,
        outputVideoUrl: s.outputVideoUrl,
        errorMessage: s.errorMessage,
      })),
      completedScenes,
      totalScenes,
      failedScenes,
      createdAt: production.createdAt,
      startedAt: production.startedAt,
      completedAt: production.completedAt,
    });
  } catch (error) {
    console.error("Brain status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
