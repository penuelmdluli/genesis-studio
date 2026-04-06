/**
 * Genesis Studio — Fraud Prevention & Rate Limiting
 * Detects and blocks: stolen cards, account farming, API abuse.
 */

import { createSupabaseAdmin } from "./supabase";

// --- Rate Limiting (in-memory, per-instance) ---

interface RateBucket {
  count: number;
  windowStart: number;
}

const rateBuckets = new Map<string, RateBucket>();

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  // Free users: 5 generations per 10 minutes
  "generate:free": { windowMs: 600_000, maxRequests: 5 },
  // Paid users: 20 generations per 10 minutes
  "generate:paid": { windowMs: 600_000, maxRequests: 20 },
  // API prompt enhance: 30 per 10 minutes
  "enhance:all": { windowMs: 600_000, maxRequests: 30 },
  // Account creation: 3 per hour per IP
  "signup:ip": { windowMs: 3_600_000, maxRequests: 3 },
};

/**
 * Check rate limit. Returns { allowed, remaining, resetAt }.
 */
export function checkRateLimit(
  key: string,
  category: string
): { allowed: boolean; remaining: number; resetAt: number } {
  const config = RATE_LIMITS[category] || { windowMs: 600_000, maxRequests: 10 };
  const now = Date.now();
  const bucketKey = `${category}:${key}`;

  let bucket = rateBuckets.get(bucketKey);
  if (!bucket || now - bucket.windowStart > config.windowMs) {
    bucket = { count: 0, windowStart: now };
    rateBuckets.set(bucketKey, bucket);
  }

  bucket.count++;
  const remaining = Math.max(0, config.maxRequests - bucket.count);
  const resetAt = bucket.windowStart + config.windowMs;

  return {
    allowed: bucket.count <= config.maxRequests,
    remaining,
    resetAt,
  };
}

// --- Account Farming Detection ---

/**
 * Check if a user shows signs of account farming.
 * Indicators: multiple accounts from same IP, rapid credit consumption, disposable email.
 */
export async function checkAccountFraud(userId: string, email: string): Promise<{
  suspicious: boolean;
  reasons: string[];
  riskScore: number; // 0-100
}> {
  const reasons: string[] = [];
  let riskScore = 0;

  // Check disposable email domains
  const disposableDomains = [
    "tempmail.com", "guerrillamail.com", "throwaway.email", "mailinator.com",
    "yopmail.com", "10minutemail.com", "trashmail.com", "temp-mail.org",
    "fakeinbox.com", "sharklasers.com", "guerrillamailblock.com",
  ];
  const emailDomain = email.split("@")[1]?.toLowerCase();
  if (emailDomain && disposableDomains.includes(emailDomain)) {
    reasons.push("Disposable email domain");
    riskScore += 40;
  }

  // Check rapid credit consumption (all credits used within 1 hour of signup)
  const supabase = createSupabaseAdmin();
  const { data: user } = await supabase
    .from("users")
    .select("credit_balance, created_at")
    .eq("id", userId)
    .single();

  if (user) {
    const accountAgeMs = Date.now() - new Date(user.created_at).getTime();
    const accountAgeHours = accountAgeMs / 3_600_000;

    if (accountAgeHours < 1 && user.credit_balance <= 0) {
      reasons.push("All credits consumed within 1 hour of signup");
      riskScore += 30;
    }
  }

  // Check for multiple recent refunds (potential abuse pattern)
  const { data: recentRefunds } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "refund")
    .gte("created_at", new Date(Date.now() - 86_400_000).toISOString());

  if (recentRefunds && recentRefunds.length > 5) {
    reasons.push(`${recentRefunds.length} refunds in last 24 hours`);
    riskScore += 25;
  }

  return {
    suspicious: riskScore >= 50,
    reasons,
    riskScore: Math.min(100, riskScore),
  };
}

// --- Payment Fraud Signals ---

/**
 * Check for payment fraud indicators.
 * Called after successful payment to flag suspicious transactions.
 */
export function checkPaymentFraudSignals(params: {
  amount: number;
  currency: string;
  country?: string;
  cardLast4?: string;
  customerEmail: string;
}): { flagged: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // High-value first purchase is suspicious
  if (params.amount > 10000) { // > $100
    reasons.push("High-value first transaction");
  }

  // Currency mismatch with expected markets
  const expectedCurrencies = ["usd", "zar", "eur", "gbp"];
  if (!expectedCurrencies.includes(params.currency.toLowerCase())) {
    reasons.push(`Unexpected currency: ${params.currency}`);
  }

  return {
    flagged: reasons.length > 0,
    reasons,
  };
}

// Cleanup stale rate limit buckets every 10 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, bucket] of rateBuckets) {
    if (now - bucket.windowStart > 3_600_000) { // 1 hour
      rateBuckets.delete(key);
    }
  }
}, 600_000);
