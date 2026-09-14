// ============================================
// Invite friends: 5 friends join, you get 50 credits
// ============================================
// Every user has one referral code. A friend who signs up through the link
// gets a welcome bonus; every fifth friend who joins earns the inviter 50
// credits. The link is built to be shared on WhatsApp chats, groups and status.

import { getDb } from "@/lib/db-driver";
import { REFERRAL_REWARDS } from "@/lib/constants";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";

export interface ReferralCodeRow {
  id: string;
  user_id: string;
  code: string;
  credits_earned: number;
  referral_count: number;
}

function newCode(userId: string): string {
  return `IVS-${userId.slice(0, 4).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

/** The user's code, created on first use. */
export async function getOrCreateReferralCode(userId: string): Promise<ReferralCodeRow | null> {
  const db = getDb();
  const { data: existing } = await db.from("referral_codes").select("*").eq("user_id", userId).maybeSingle();
  if (existing) return existing as ReferralCodeRow;
  for (let i = 0; i < 3; i++) {
    const { error } = await db
      .from("referral_codes")
      .insert({ user_id: userId, code: newCode(userId), credits_earned: 0, referral_count: 0 });
    if (!error) break;
  }
  const { data } = await db.from("referral_codes").select("*").eq("user_id", userId).maybeSingle();
  return (data as ReferralCodeRow) || null;
}

export function shareUrl(code: string): string {
  return `${APP_URL}/sign-up?ref=${encodeURIComponent(code)}`;
}

/** The message people forward on WhatsApp: short, specific, link last. */
export function shareMessage(code: string): string {
  return (
    `🎬 I'm making AI videos with iVideo Studio: movies, cartoons, dance reels and ads, ` +
    `with characters that actually talk.\n\n` +
    `Join free with my link and get ${REFERRAL_REWARDS.refereeCredits} bonus credits on top of your free credits 👇\n` +
    shareUrl(code)
  );
}

export function whatsappUrl(code: string): string {
  return `https://wa.me/?text=${encodeURIComponent(shareMessage(code))}`;
}

/** Friends still needed before the next reward. */
export function friendsToNextReward(count: number): number {
  const step = REFERRAL_REWARDS.friendsPerReward;
  const r = count % step;
  return r === 0 ? step : step - r;
}
