import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhook events: user.created, user.updated
 * Syncs user profile (name, email, avatar) to Supabase.
 *
 * Setup: Clerk Dashboard → Webhooks → Add Endpoint
 * URL: https://genesisstudio.app/api/webhooks/clerk
 * Events: user.created, user.updated
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const eventType = body.type;
    const userData = body.data;

    if (!userData?.id) {
      return NextResponse.json({ error: "No user data" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();
    const clerkId = userData.id;
    const email = userData.email_addresses?.[0]?.email_address || null;
    const firstName = userData.first_name || "";
    const lastName = userData.last_name || "";
    const fullName = `${firstName} ${lastName}`.trim() || null;
    const avatarUrl = userData.image_url || userData.profile_image_url || null;

    if (eventType === "user.created") {
      // Check if user already exists (race condition with auth flow)
      const { data: existing } = await supabase
        .from("users")
        .select("id")
        .eq("clerk_id", clerkId)
        .maybeSingle();

      if (existing) {
        // Update name/avatar if they signed up before webhook fired
        await supabase
          .from("users")
          .update({
            name: fullName || undefined,
            email: email || undefined,
            avatar_url: avatarUrl || undefined,
          })
          .eq("clerk_id", clerkId);
        console.log(`[CLERK WEBHOOK] Updated existing user: ${email}`);
      } else {
        // Create new user with signup credits
        await supabase.from("users").insert({
          clerk_id: clerkId,
          email,
          name: fullName,
          avatar_url: avatarUrl,
          credit_balance: 50,
          plan: "free",
        });
        console.log(`[CLERK WEBHOOK] Created new user: ${email}`);
      }
    } else if (eventType === "user.updated") {
      // Update profile fields
      const updates: Record<string, string | null> = {};
      if (fullName) updates.name = fullName;
      if (email) updates.email = email;
      if (avatarUrl) updates.avatar_url = avatarUrl;

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("users")
          .update(updates)
          .eq("clerk_id", clerkId);
        console.log(`[CLERK WEBHOOK] Profile updated: ${email} → ${fullName}`);
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("[CLERK WEBHOOK] Error:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
