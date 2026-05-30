import { NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export async function POST() {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = getDb();

    // Delete user data in order (respecting foreign keys)
    // 1. Credit transactions
    await supabase.from("credit_transactions").delete().eq("user_id", user.id);

    // 2. API keys
    await supabase.from("api_keys").delete().eq("user_id", user.id);

    // 3. Explore videos
    await supabase.from("explore_videos").delete().eq("user_id", user.id);

    // 4. Videos
    await supabase.from("videos").delete().eq("user_id", user.id);

    // 5. Generation jobs
    await supabase.from("generation_jobs").delete().eq("user_id", user.id);

    // 6. Referral data
    await supabase.from("referrals").delete().eq("referrer_user_id", user.id);
    await supabase.from("referrals").delete().eq("referred_user_id", user.id);
    await supabase.from("referral_codes").delete().eq("user_id", user.id);

    // 7. Delete user record
    await supabase.from("users").delete().eq("id", user.id);

    // Note: Clerk account deletion should be handled separately by the user
    // through Clerk's account management UI, or via a Clerk API call if needed.

    return NextResponse.json({
      success: true,
      message: "Account data deleted. Sign out to complete the process.",
    });
  } catch (error) {
    console.error("Account deletion error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
