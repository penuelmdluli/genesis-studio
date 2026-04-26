// ============================================
// GENESIS STUDIO — Generation Idempotency
// Prevents duplicate generations from retries.
// Uses Upstash Redis with 1-hour dedupe window.
// ============================================

import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { envString } from "./env";

let redis: Redis | null = null;

function getRedis(): Redis | null {
  if (redis) return redis;
  try {
    const url = envString("UPSTASH_REDIS_REST_URL");
    const token = envString("UPSTASH_REDIS_REST_TOKEN");
    if (!url || !token) return null;
    redis = new Redis({ url, token });
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
  const r = getRedis();
  if (!r) return null;
  const cached = await r.get<{ r2Url: string }>(key);
  return cached?.r2Url ?? null;
}

export async function storeIdempotent(key: string, r2Url: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.set(key, JSON.stringify({ r2Url }), { ex: TTL_SECONDS });
}

export async function lockGeneration(key: string): Promise<boolean> {
  const r = getRedis();
  if (!r) return true; // No Redis = allow through (no distributed locking)
  const lockKey = `${key}:lock`;
  const acquired = await r.set(lockKey, "1", { ex: LOCK_TTL_SECONDS, nx: true });
  return acquired === "OK";
}

export async function unlockGeneration(key: string): Promise<void> {
  const r = getRedis();
  if (!r) return;
  await r.del(`${key}:lock`);
}
