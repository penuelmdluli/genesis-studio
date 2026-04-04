import { NextRequest, NextResponse } from "next/server";
import { auth, currentUser } from "@clerk/nextjs/server";
import { getUserByClerkId, createUser } from "@/lib/db";

export async function GET() {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = await getUserByClerkId(clerkId);

    // Auto-create user on first request
    if (!user) {
      const clerkUser = await currentUser();
      if (!clerkUser) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      user = await createUser({
        clerkId,
        email: clerkUser.emailAddresses[0]?.emailAddress || "",
        name: `${clerkUser.firstName || ""} ${clerkUser.lastName || ""}`.trim() || "User",
        avatarUrl: clerkUser.imageUrl,
      });
    }

    return NextResponse.json({
      id: user.id,
      clerkId: user.clerk_id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatar_url,
      plan: user.plan,
      creditBalance: user.credit_balance,
      monthlyCreditsUsed: user.monthly_credits_used,
      monthlyCreditsLimit: user.monthly_credits_limit,
      createdAt: user.created_at,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
