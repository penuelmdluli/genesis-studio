import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";
import { REFERRAL_REWARDS } from "@/lib/constants";
import {
  friendsToNextReward,
  getOrCreateReferralCode,
  shareMessage,
  shareUrl,
  whatsappUrl,
} from "@/lib/referrals";

// GET: the user's invite link, WhatsApp share link and progress.
export async function GET() {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const code = await getOrCreateReferralCode(user.id);
    if (!code) return NextResponse.json({ error: "Could not create your invite link" }, { status: 500 });

    const { data: referrals } = await getDb()
      .from("referrals")
      .select("id, referred_user_email, created_at")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    const count = code.referral_count || 0;
    return NextResponse.json({
      code: code.code,
      shareUrl: shareUrl(code.code),
      shareMessage: shareMessage(code.code),
      whatsappUrl: whatsappUrl(code.code),
      referralCount: count,
      creditsEarned: code.credits_earned || 0,
      friendsPerReward: REFERRAL_REWARDS.friendsPerReward,
      rewardCredits: REFERRAL_REWARDS.rewardCredits,
      refereeBonus: REFERRAL_REWARDS.refereeCredits,
      friendsToNextReward: friendsToNextReward(count),
      // Only the first part of the address, so friends' emails are not exposed.
      referrals: ((referrals || []) as Array<{ id: string; referred_user_email: string; created_at: string }>).map((r) => ({
        id: r.id,
        who: (r.referred_user_email || "").replace(/^(.{2}).*(@.*)$/, "$1•••$2"),
        joined: r.created_at,
      })),
    });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: a new user redeems the code they signed up with (from onboarding).
export async function POST(req: NextRequest) {
  try {
    const clerkId = await getAuthUserId();
    if (!clerkId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const user = await getUserByClerkId(clerkId);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const { code } = (await req.json().catch(() => ({}))) as { code?: string };
    if (!code) return NextResponse.json({ error: "Referral code required" }, { status: 400 });

    // Only brand-new accounts can join through a link, so existing users
    // cannot farm credits by redeeming each other's codes.
    const created = Date.parse(String(user.created_at || "").replace(" ", "T") + (String(user.created_at || "").endsWith("Z") ? "" : "Z"));
    if (Number.isFinite(created) && Date.now() - created > REFERRAL_REWARDS.newAccountDays * 86400_000) {
      return NextResponse.json({ error: "Invite links are for new accounts" }, { status: 400 });
    }

    const db = getDb();
    const { data: referralCode } = await db.from("referral_codes").select("*").eq("code", code).maybeSingle();
    if (!referralCode) return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    if (referralCode.user_id === user.id) {
      return NextResponse.json({ error: "Cannot use your own referral code" }, { status: 400 });
    }
    if ((referralCode.referral_count || 0) >= REFERRAL_REWARDS.maxReferrals) {
      return NextResponse.json({ error: "Referral code has reached maximum uses" }, { status: 400 });
    }

    // The unique index on referred_user_id makes this insert the claim: a
    // second attempt (double tap, second device) fails here and pays nothing.
    const { error: claimError } = await db.from("referrals").insert({
      referrer_user_id: referralCode.user_id,
      referred_user_id: user.id,
      referred_user_email: user.email,
      referral_code_id: referralCode.id,
      credits_granted: 0,
    });
    if (claimError) return NextResponse.json({ error: "Already used a referral code" }, { status: 400 });

    const { addCreditPackCredits } = await import("@/lib/credits");
    await addCreditPackCredits(user.id, REFERRAL_REWARDS.refereeCredits, `Welcome bonus from invite ${code}`);

    const count = (referralCode.referral_count || 0) + 1;
    const milestone = count % REFERRAL_REWARDS.friendsPerReward === 0;
    if (milestone) {
      await addCreditPackCredits(
        referralCode.user_id,
        REFERRAL_REWARDS.rewardCredits,
        `Invite reward: ${count} friends joined`
      );
    }
    await db
      .from("referral_codes")
      .update({
        referral_count: count,
        credits_earned: (referralCode.credits_earned || 0) + (milestone ? REFERRAL_REWARDS.rewardCredits : 0),
      })
      .eq("id", referralCode.id);

    return NextResponse.json({
      success: true,
      creditsGranted: REFERRAL_REWARDS.refereeCredits,
      message: `You earned ${REFERRAL_REWARDS.refereeCredits} bonus credits!`,
    });
  } catch (error) {
    console.error("Referral redeem error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
