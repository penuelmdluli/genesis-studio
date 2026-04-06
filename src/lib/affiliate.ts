// ============================================
// GENESIS STUDIO — Affiliate Program
// ============================================

import { createSupabaseAdmin } from "./supabase";

export const AFFILIATE_CONFIG = {
  commissionRate: 0.20, // 20% recurring commission
  cookieDurationDays: 30, // Attribution window
  minPayoutUSD: 50, // Minimum payout threshold
  payoutSchedule: "monthly", // When commissions are paid
  maxTierDepth: 1, // Single-tier only (no MLM)
};

export interface AffiliateStats {
  totalReferrals: number;
  activeSubscribers: number;
  totalEarnings: number;
  pendingPayout: number;
  conversionRate: number;
  referralLink: string;
}

export interface AffiliateReferral {
  id: string;
  affiliateUserId: string;
  referredUserId: string;
  referredEmail: string;
  plan: string;
  status: "signed_up" | "subscribed" | "churned";
  commissionEarned: number;
  createdAt: string;
}

/**
 * Generate a unique affiliate link for a user.
 */
export function generateAffiliateLink(userId: string, baseUrl: string): string {
  // Use a short hash of the user ID for cleaner URLs
  const code = Buffer.from(userId).toString("base64url").slice(0, 8);
  return `${baseUrl}/?ref=${code}`;
}

/**
 * Decode an affiliate code back to a user ID prefix for lookup.
 */
export function decodeAffiliateCode(code: string): string {
  try {
    return Buffer.from(code, "base64url").toString();
  } catch {
    return "";
  }
}

/**
 * Record a new referral when someone signs up via an affiliate link.
 */
export async function recordReferral(affiliateUserId: string, referredUserId: string, referredEmail: string) {
  const supabase = createSupabaseAdmin();

  const { error } = await supabase
    .from("affiliate_referrals")
    .insert({
      affiliate_user_id: affiliateUserId,
      referred_user_id: referredUserId,
      referred_email: referredEmail,
      status: "signed_up",
      commission_earned: 0,
    });

  if (error) {
    console.error("[AFFILIATE] Failed to record referral:", error.message);
  }
}

/**
 * When a referred user subscribes, calculate and record commission.
 */
export async function recordCommission(referredUserId: string, paymentAmountUSD: number) {
  const supabase = createSupabaseAdmin();

  // Find the affiliate who referred this user
  const { data: referral } = await supabase
    .from("affiliate_referrals")
    .select("*")
    .eq("referred_user_id", referredUserId)
    .single();

  if (!referral) return; // User was not referred

  const commission = paymentAmountUSD * AFFILIATE_CONFIG.commissionRate;

  await supabase
    .from("affiliate_referrals")
    .update({
      status: "subscribed",
      commission_earned: (referral.commission_earned || 0) + commission,
    })
    .eq("id", referral.id);

  // Add to affiliate's pending balance
  await supabase
    .from("affiliate_payouts")
    .insert({
      affiliate_user_id: referral.affiliate_user_id,
      amount: commission,
      referred_user_id: referredUserId,
      payment_amount: paymentAmountUSD,
      status: "pending",
    });

  console.log(`[AFFILIATE] Commission $${commission.toFixed(2)} earned by ${referral.affiliate_user_id} from ${referredUserId}`);
}

/**
 * Get affiliate stats for a user's dashboard.
 */
export async function getAffiliateStats(userId: string, baseUrl: string): Promise<AffiliateStats> {
  const supabase = createSupabaseAdmin();

  const { data: referrals } = await supabase
    .from("affiliate_referrals")
    .select("*")
    .eq("affiliate_user_id", userId);

  const allReferrals = referrals || [];
  const activeSubscribers = allReferrals.filter(r => r.status === "subscribed").length;
  const totalEarnings = allReferrals.reduce((sum, r) => sum + (r.commission_earned || 0), 0);

  // Get pending payout
  const { data: payouts } = await supabase
    .from("affiliate_payouts")
    .select("amount")
    .eq("affiliate_user_id", userId)
    .eq("status", "pending");

  const pendingPayout = (payouts || []).reduce((sum, p) => sum + (p.amount || 0), 0);

  return {
    totalReferrals: allReferrals.length,
    activeSubscribers,
    totalEarnings,
    pendingPayout,
    conversionRate: allReferrals.length > 0 ? (activeSubscribers / allReferrals.length) * 100 : 0,
    referralLink: generateAffiliateLink(userId, baseUrl),
  };
}
