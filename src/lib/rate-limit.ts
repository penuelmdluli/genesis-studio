// ============================================
// GENESIS STUDIO — Distributed Rate Limiting (Upstash)
// Supplements the in-memory rate limiter in fraud.ts.
// Provides cross-instance persistence in serverless.
// Gracefully degrades: if Upstash not configured,
// falls back to in-memory only (fraud.ts handles that).
// ============================================

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { envString } from "./env";

let redis: Redis | null = null;
let redisInitialized = false;

function getRedis(): Redis | null {
  if (redisInitialized) return redis;
  redisInitialized = true;
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

type WindowSize = `${number} s` | `${number} m` | `${number} h` | `${number} d`;

const limiterCache = new Map<string, Ratelimit>();

function getLimiter(name: string, tokens: number, window: WindowSize): Ratelimit | null {
  if (limiterCache.has(name)) return limiterCache.get(name)!;
  const r = getRedis();
  if (!r) return null;
  const limiter = new Ratelimit({
    redis: r,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "genesis",
  });
  limiterCache.set(name, limiter);
  return limiter;
}

/**
 * Check the distributed rate limiter. Returns a 429 response if exceeded,
 * or null if the request should proceed.
 */
export async function enforceDistributedRateLimit(
  userId: string,
  plan: string
): Promise<NextResponse | null> {
  const limiter = plan === "free"
    ? getLimiter("freeTierDaily", 5, "1 d")
    : getLimiter("generationDaily", 500, "1 d");
  if (!limiter) return null;

  const result = await limiter.limit(userId);
  if (!result.success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Please wait before trying again.",
        retryAfter: Math.ceil((result.reset - Date.now()) / 1000),
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((result.reset - Date.now()) / 1000)) },
      }
    );
  }
  return null;
}
