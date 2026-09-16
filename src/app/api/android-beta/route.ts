// GET  /api/android-beta              → tester count, whether install link is live
// POST /api/android-beta {email,name} → join the tester list (guests welcome)

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { celebrate } from "@/lib/referrals";
import { rewardsAllowed } from "@/lib/signup-signals";
import {
  PLAY_OPT_IN_URL,
  TESTER_BONUS_CREDITS,
  TESTERS_NEEDED,
  betaWhatsappUrl,
  testingOpen,
  BETA_GROUP_URL,
} from "@/lib/android-beta";

export const dynamic = "force-dynamic";

async function count(): Promise<number> {
  const { data } = await getDb().from("android_testers").select("id").limit(10000);
  return data?.length || 0;
}

export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const clerkId = await getAuthUserId();
  const user = clerkId ? await getUserByClerkId(clerkId) : null;
  let joined = false;
  if (user) {
    const { data } = await getDb().from("android_testers").select("id").eq("user_id", user.id).maybeSingle();
    joined = !!data;
  }
  return NextResponse.json({
    testers: await count(),
    needed: TESTERS_NEEDED,
    open: testingOpen(),
    optInUrl: testingOpen() ? PLAY_OPT_IN_URL : null, groupUrl: testingOpen() ? BETA_GROUP_URL : null,
    whatsappUrl: betaWhatsappUrl(appUrl),
    bonusCredits: TESTER_BONUS_CREDITS,
    signedIn: !!user,
    email: user?.email || null,
    name: user?.name || null,
    joined,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as { email?: string; name?: string; source?: string; device?: string };
  const email = (body.email || "").toLowerCase().trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "Enter the email address you use on Google Play" }, { status: 400 });
  }

  const clerkId = await getAuthUserId();
  const user = clerkId ? await getUserByClerkId(clerkId) : null;
  const db = getDb();

  const { data: existing } = await db.from("android_testers").select("id").eq("email", email).maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, already: true, testers: await count(), open: testingOpen(), optInUrl: testingOpen() ? PLAY_OPT_IN_URL : null, groupUrl: testingOpen() ? BETA_GROUP_URL : null });
  }

  const { error } = await db.from("android_testers").insert({
    email,
    name: (body.name || user?.name || "").slice(0, 80) || null,
    user_id: user?.id || null,
    source: (body.source || "").slice(0, 60) || null,
    device: (body.device || req.headers.get("user-agent") || "").slice(0, 200),
  });
  // A second row for the same signed-in account fails on the unique index:
  // they already joined (with another address) and already got the bonus.
  if (error) {
    return NextResponse.json({ ok: true, already: true, testers: await count(), open: testingOpen(), optInUrl: testingOpen() ? PLAY_OPT_IN_URL : null, groupUrl: testingOpen() ? BETA_GROUP_URL : null });
  }

  let bonus = 0;
  // A flagged or suspended account joins the tester list but earns nothing:
  // the +50 credits are for real testers, not for a farm of throwaway accounts.
  const bonusAllowed = user ? await rewardsAllowed(user.id) : { ok: false };
  if (user && bonusAllowed.ok) {
    const { addCreditPackCredits } = await import("@/lib/credits");
    await addCreditPackCredits(user.id, TESTER_BONUS_CREDITS, "Thank you for testing the Android app");
    bonus = TESTER_BONUS_CREDITS;
    await celebrate(user.id, {
      kind: "reward",
      title: `You're an Android tester! +${TESTER_BONUS_CREDITS} credits`,
      message: "Thank you for helping us launch on Google Play. We'll email your install link as soon as Google approves the test. Please keep the app installed for 14 days.",
      credits: TESTER_BONUS_CREDITS,
      friends: 0,
    });
  }

  return NextResponse.json({ ok: true, bonus, testers: await count(), open: testingOpen(), optInUrl: testingOpen() ? PLAY_OPT_IN_URL : null, groupUrl: testingOpen() ? BETA_GROUP_URL : null });
}
