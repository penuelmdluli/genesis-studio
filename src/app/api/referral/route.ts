import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";
import { REFERRAL_REWARDS } from "@/lib/constants";

// GET: Get user's referral code + stats
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

    const supabase = createSupabaseAdmin();

    // Get or create referral code
    const { data: existingCode } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("user_id", user.id)
      .single();

    let referralCode = existingCode;

    if (!referralCode) {
      // Generate a unique referral code
      const code = `GS-${user.id.slice(0, 4).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
      const { data: newCode } = await supabase
        .from("referral_codes")
        .insert({
          user_id: user.id,
          code,
          credits_earned: 0,
          referral_count: 0,
        })
        .select()
        .single();
      referralCode = newCode;
    }

    // Get referral history
    const { data: referrals } = await supabase
      .from("referrals")
      .select("id, referred_user_email, credits_granted, created_at")
      .eq("referrer_user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    return NextResponse.json({
      code: referralCode?.code || "",
      creditsEarned: referralCode?.credits_earned || 0,
      referralCount: referralCode?.referral_count || 0,
      maxReferrals: REFERRAL_REWARDS.maxReferrals,
      rewardPerReferral: REFERRAL_REWARDS.referrerCredits,
      refereeBonus: REFERRAL_REWARDS.refereeCredits,
      referrals: referrals || [],
      shareUrl: `${process.env.NEXT_PUBLIC_APP_URL || "https://genesis-studio-hazel.vercel.app"}/sign-up?ref=${referralCode?.code || ""}`,
    });
  } catch (error) {
    console.error("Referral error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: Redeem a referral code (called during signup)
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

    const { code } = await req.json();
    if (!code) {
      return NextResponse.json({ error: "Referral code required" }, { status: 400 });
    }

    const supabase = createSupabaseAdmin();

    // Find the referral code
    const { data: referralCode } = await supabase
      .from("referral_codes")
      .select("*")
      .eq("code", code)
      .single();

    if (!referralCode) {
      return NextResponse.json({ error: "Invalid referral code" }, { status: 404 });
    }

    // Can't refer yourself
    if (referralCode.user_id === user.id) {
      return NextResponse.json({ error: "Cannot use your own referral code" }, { status: 400 });
    }

    // Check if user already used a referral code
    const { data: existingReferral } = await supabase
      .from("referrals")
      .select("id")
      .eq("referred_user_id", user.id)
      .single();

    if (existingReferral) {
      return NextResponse.json({ error: "Already used a referral code" }, { status: 400 });
    }

    // Check max referrals
    if (referralCode.referral_count >= REFERRAL_REWARDS.maxReferrals) {
      return NextResponse.json({ error: "Referral code has reached maximum uses" }, { status: 400 });
    }

    // Grant credits to both users
    const { addCreditPackCredits } = await import("@/lib/credits");

    await addCreditPackCredits(
      referralCode.user_id,
      REFERRAL_REWARDS.referrerCredits,
      `Referral reward: ${user.email} joined`
    );

    await addCreditPackCredits(
      user.id,
      REFERRAL_REWARDS.refereeCredits,
      `Welcome bonus from referral code ${code}`
    );

    // Record the referral
    await supabase.from("referrals").insert({
      referrer_user_id: referralCode.user_id,
      referred_user_id: user.id,
      referred_user_email: user.email,
      referral_code_id: referralCode.id,
      credits_granted: REFERRAL_REWARDS.referrerCredits,
    });

    // Update referral code stats
    await supabase
      .from("referral_codes")
      .update({
        referral_count: referralCode.referral_count + 1,
        credits_earned: referralCode.credits_earned + REFERRAL_REWARDS.referrerCredits,
      })
      .eq("id", referralCode.id);

    return NextResponse.json({
      success: true,
      creditsEarned: REFERRAL_REWARDS.refereeCredits,
      message: `You earned ${REFERRAL_REWARDS.refereeCredits} bonus credits!`,
    });
  } catch (error) {
    console.error("Referral redeem error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
