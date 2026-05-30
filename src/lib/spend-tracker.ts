// ============================================
// GENESIS STUDIO — Daily Spend Tracker (Cloudflare KV)
// Tracks per-provider daily GPU/API spend.
// Circuit breaker: auto-disables provider when cap hit.
// ============================================

import { sendSlackAlert } from "./alerts";
import { envNumber } from "./env";
import { getKV } from "./cf-env";

function todayKey(provider: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `spend:${provider}:${today}`;
}

export async function recordSpend(provider: string, costUsd: number): Promise<void> {
  try {
    const kv = getKV();
    const key = todayKey(provider);
    const current = await kv.get(key, { type: "text" });
    const newVal = (current ? parseFloat(current) : 0) + costUsd;
    await kv.put(key, String(newVal), { expirationTtl: 60 * 60 * 48 });
  } catch {
    // Graceful degradation
  }
}

export async function getDailySpend(provider: string): Promise<number> {
  try {
    const kv = getKV();
    const val = await kv.get(todayKey(provider), { type: "text" });
    return val ? parseFloat(val) : 0;
  } catch {
    return 0;
  }
}

export async function isOverDailyProviderCap(provider: string): Promise<{
  over: boolean;
  spent: number;
  cap: number;
}> {
  const DAILY_CAP_USD = envNumber("COMFYUI_DAILY_SPEND_CAP_USD", 25);
  const spent = await getDailySpend(provider);
  const over = spent >= DAILY_CAP_USD;

  if (over) {
    const today = new Date().toISOString().slice(0, 10);
    sendSlackAlert({
      level: "warning",
      title: "Provider daily spend cap hit",
      message: `${provider}: $${spent.toFixed(2)} / $${DAILY_CAP_USD} cap. Routing to FAL until midnight UTC.`,
      dedupeKey: `spend-cap-${provider}-${today}`,
    }).catch(() => {});
  }

  return { over, spent, cap: DAILY_CAP_USD };
}
