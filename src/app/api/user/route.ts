import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId, getAuthUserProfile } from "@/lib/auth";
import { getUserByClerkId, createUser } from "@/lib/db";
import { isOwnerClerkId } from "@/lib/credits";
import { sendWelcomeEmail } from "@/lib/email";
import { sendSlackAlert } from "@/lib/alerts";

export async function GET() {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let user = await getUserByClerkId(clerkId);

    // Auto-create user on first request
    if (!user) {
      const profile = await getAuthUserProfile();
      if (!profile) {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      const { email, name } = profile;

      user = await createUser({
        clerkId,
        email,
        name,
        avatarUrl: profile.avatarUrl,
      });

      // Send welcome email (fire-and-forget)
      if (email) {
        sendWelcomeEmail(email, name).catch((err) =>
          console.error("[USER] Welcome email failed:", err)
        );
      }

      // Notify Slack — new customer
      sendSlackAlert({
        level: "info",
        title: "New customer signed up",
        message: `${name} (${email}) just joined Genesis Studio with 100 free credits.`,
      }).catch(() => {});
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
      isOwner: isOwnerClerkId(clerkId),
    });
  } catch (error) {
    console.error("Get user error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
