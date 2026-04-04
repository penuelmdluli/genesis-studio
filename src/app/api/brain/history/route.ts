import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { getUserProductions } from "@/lib/genesis-brain/orchestrator";

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

    const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
    const offset = parseInt(req.nextUrl.searchParams.get("offset") || "0");

    const productions = await getUserProductions(user.id, limit, offset);

    return NextResponse.json({
      productions: productions.map((p) => ({
        id: p.id,
        status: p.status,
        concept: p.concept,
        style: p.style,
        targetDuration: p.targetDuration,
        totalCredits: p.totalCredits,
        thumbnailUrl: p.thumbnailUrl,
        progress: p.progress,
        createdAt: p.createdAt,
        completedAt: p.completedAt,
      })),
    });
  } catch (error) {
    console.error("Brain history error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
