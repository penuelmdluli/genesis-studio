/**
 * Genesis Studio — API Budget Protection
 *
 * Tracks daily spend per service and blocks requests when budgets are exceeded.
 * Uses in-memory counters (resets on deploy / restart) as a circuit breaker.
 *
 * Costs are estimated per-call based on model and max_tokens.
 */

interface DailyBucket {
  date: string; // YYYY-MM-DD
  spendCents: number;
  requestCount: number;
}

const dailyBuckets = new Map<string, DailyBucket>();

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function getBucket(service: string): DailyBucket {
  const key = `${service}:${todayKey()}`;
  let bucket = dailyBuckets.get(key);
  if (!bucket) {
    bucket = { date: todayKey(), spendCents: 0, requestCount: 0 };
    dailyBuckets.set(key, bucket);
  }
  return bucket;
}

// Daily budget caps in cents
const DAILY_BUDGETS: Record<string, number> = {
  "claude:chat": 500,      // $5/day for chatbot
  "claude:enhance": 300,   // $3/day for prompt enhancement
  "claude:moderate": 200,   // $2/day for moderation
};

// Estimated cost per call in cents (based on model + typical usage)
const COST_ESTIMATES: Record<string, number> = {
  // Claude Haiku: ~$0.001 per call (short prompts)
  "claude:enhance": 0.1,   // ~0.1 cents per enhance call
  "claude:moderate": 0.05,  // ~0.05 cents per moderate call
  // Claude Sonnet (chatbot): ~$0.003 per call
  "claude:chat": 0.3,      // ~0.3 cents per chat call
};

/**
 * Check if a service is within its daily budget.
 * Returns { allowed, remainingBudgetCents, dailySpendCents }.
 */
export function checkBudget(service: string): {
  allowed: boolean;
  remainingBudgetCents: number;
  dailySpendCents: number;
} {
  const budget = DAILY_BUDGETS[service];
  if (!budget) {
    // No budget configured = always allowed
    return { allowed: true, remainingBudgetCents: Infinity, dailySpendCents: 0 };
  }

  const bucket = getBucket(service);
  const remaining = budget - bucket.spendCents;

  return {
    allowed: bucket.spendCents < budget,
    remainingBudgetCents: Math.max(0, remaining),
    dailySpendCents: bucket.spendCents,
  };
}

/**
 * Record a service call (adds estimated cost to daily total).
 */
export function recordApiCall(service: string): void {
  const bucket = getBucket(service);
  const cost = COST_ESTIMATES[service] || 0.1;
  bucket.spendCents += cost;
  bucket.requestCount++;
}

/**
 * Get summary of all daily budgets (for admin dashboard).
 */
export function getBudgetSummary(): Record<string, {
  budgetCents: number;
  spentCents: number;
  requests: number;
  percentUsed: number;
}> {
  const summary: Record<string, { budgetCents: number; spentCents: number; requests: number; percentUsed: number }> = {};
  const today = todayKey();

  for (const [service, budget] of Object.entries(DAILY_BUDGETS)) {
    const bucket = dailyBuckets.get(`${service}:${today}`);
    summary[service] = {
      budgetCents: budget,
      spentCents: bucket?.spendCents ?? 0,
      requests: bucket?.requestCount ?? 0,
      percentUsed: bucket ? Math.round((bucket.spendCents / budget) * 100) : 0,
    };
  }

  return summary;
}

// Cleanup old daily buckets every hour
setInterval(() => {
  const today = todayKey();
  for (const key of dailyBuckets.keys()) {
    if (!key.endsWith(today)) {
      dailyBuckets.delete(key);
    }
  }
}, 3_600_000);
