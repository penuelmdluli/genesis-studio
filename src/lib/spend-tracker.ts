// ============================================
// GENESIS STUDIO — Daily Spend Tracker (Upstash)
// Tracks per-provider daily GPU/API spend.
// Circuit breaker: auto-disables provider when cap hit.
// ============================================

import { Redis } from "@upstash/redis";
import { sendSlackAlert } from "./alerts";

const DAILY_CAP_USD = parseFloat(process.env.COMFYUI_DAILY_SPEND_CAP_USD ?? "25");

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  } catch {
    return null;
  }
}

function todayKey(provider: string): string {
  const today = new Date().toISOString().slice(0, 10);
  return `spend:${provider}:${today}`;
}

export async function recordSpend(provider: string, costUsd: number): Promise<void> {
  const r = getRedis();
  if (!r) return;
  const key = todayKey(provider);
  await r.incrbyfloat(key, costUsd);
  await r.expire(key, 60 * 60 * 48);
}

export async function getDailySpend(provider: string): Promise<number> {
  const r = getRedis();
  if (!r) return 0;
  const val = await r.get<string>(todayKey(provider));
  return val ? parseFloat(String(val)) : 0;
}

export async function isOverDailyProviderCap(provider: string): Promise<{
  over: boolean;
  spent: number;
  cap: number;
}> {
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
