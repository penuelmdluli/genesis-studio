import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { getAffiliateStats, AFFILIATE_CONFIG } from "@/lib/affiliate";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const appUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const stats = await getAffiliateStats(user.id, appUrl);

    return NextResponse.json({
      ...stats,
      config: AFFILIATE_CONFIG,
    });
  } catch (error) {
    console.error("[AFFILIATE] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
