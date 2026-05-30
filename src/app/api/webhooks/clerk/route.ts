import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { getDb } from "@/lib/db-driver";

/**
 * POST /api/webhooks/clerk
 * Handles Clerk webhook events: user.created, user.updated
 * Syncs user profile (name, email, avatar) to Supabase.
 *
 * Setup: Clerk Dashboard → Webhooks → Add Endpoint
 * URL: https://ivideostudio.ai/api/webhooks/clerk
 * Events: user.created, user.updated
 *
 * Security: Svix HMAC-SHA256 signature is verified using
 * CLERK_WEBHOOK_SECRET (whsec_...) before any DB writes. Without
 * the env var configured, this route fail-closed with 500.
 */

interface ClerkUserData {
  id: string;
  email_addresses?: Array<{ email_address?: string | null }>;
  first_name?: string | null;
  last_name?: string | null;
  image_url?: string | null;
  profile_image_url?: string | null;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CLERK_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[CLERK WEBHOOK] CLERK_WEBHOOK_SECRET is not configured — rejecting request");
      return NextResponse.json({ error: "Webhook secret not configured" }, { status: 500 });
    }

    const svixId = req.headers.get("svix-id");
    const svixTimestamp = req.headers.get("svix-timestamp");
    const svixSignature = req.headers.get("svix-signature");

    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json({ error: "Missing Svix headers" }, { status: 400 });
    }

    // Verify signature against the RAW request body
    const rawBody = await req.text();
    const wh = new Webhook(secret);
    let evt: ClerkWebhookEvent;
    try {
      evt = wh.verify(rawBody, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      }) as ClerkWebhookEvent;
    } catch (verifyErr) {
      console.error("[CLERK WEBHOOK] Signature verification failed:", verifyErr);
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    const eventType = evt.type;
    const userData = evt.data;

    if (!userData?.id) {
      return NextResponse.json({ error: "No user data" }, { status: 400 });
    }

    const supabase = getDb();
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
          credit_balance: 100,
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
