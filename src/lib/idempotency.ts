// ============================================
// GENESIS STUDIO — Generation Idempotency
// Prevents duplicate generations from retries.
// Uses Upstash Redis with 1-hour dedupe window.
// ============================================

import crypto from "crypto";

let redis: {
  get: <T>(key: string) => Promise<T | null>;
  set: (key: string, value: unknown, opts?: { ex?: number; nx?: boolean }) => Promise<string | null>;
  del: (...keys: string[]) => Promise<number>;
} | null = null;

async function getRedis() {
  if (redis) return redis;
  try {
    if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
    const { Redis } = await import("@upstash/redis");
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redis;
  } catch {
    return null;
  }
}

const TTL_SECONDS = 60 * 60; // 1 hour dedupe window
const LOCK_TTL_SECONDS = 600; // 10 min lock for in-flight generations

export function buildIdempotencyKey(input: {
  userId: string;
  prompt: string;
  modelId: string;
  duration: number;
  resolution: string;
}): string {
  const hash = crypto
    .createHash("sha256")
    .update(JSON.stringify(input, Object.keys(input).sort()))
    .digest("hex")
    .slice(0, 16);
  return `idem:${input.userId}:${hash}`;
}

export async function checkIdempotent(key: string): Promise<string | null> {
  const r = await getRedis();
  if (!r) return null;
  const cached = await r.get<{ r2Url: string }>(key);
  return cached?.r2Url ?? null;
}

export async function storeIdempotent(key: string, r2Url: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  await r.set(key, JSON.stringify({ r2Url }), { ex: TTL_SECONDS });
}

export async function lockGeneration(key: string): Promise<boolean> {
  const r = await getRedis();
  if (!r) return true; // No Redis = allow through (no distributed locking)
  const lockKey = `${key}:lock`;
  const acquired = await r.set(lockKey, "1", { ex: LOCK_TTL_SECONDS, nx: true });
  return acquired === "OK";
}

export async function unlockGeneration(key: string): Promise<void> {
  const r = await getRedis();
  if (!r) return;
  await r.del(`${key}:lock`);
}
