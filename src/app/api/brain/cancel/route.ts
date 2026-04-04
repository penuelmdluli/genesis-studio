import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { cancelProduction } from "@/lib/genesis-brain/orchestrator";

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

    const { productionId } = await req.json();
    if (!productionId) {
      return NextResponse.json({ error: "productionId required" }, { status: 400 });
    }

    await cancelProduction(productionId, user.id);

    return NextResponse.json({
      productionId,
      status: "cancelled",
      message: "Production cancelled. Credits have been refunded.",
    });
  } catch (error) {
    console.error("Brain cancel error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to cancel" },
      { status: 500 }
    );
  }
}
