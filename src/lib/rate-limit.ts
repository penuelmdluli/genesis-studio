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

let redis: Redis | null = null;

try {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
} catch {
  // Silently fall back to no distributed rate limiting
}

type WindowSize = `${number} s` | `${number} m` | `${number} h` | `${number} d`;

function makeLimiter(tokens: number, window: WindowSize) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(tokens, window),
    analytics: true,
    prefix: "genesis",
  });
}

export const limiters = {
  generation: makeLimiter(10, "1 m"),
  generationHourly: makeLimiter(100, "1 h"),
  generationDaily: makeLimiter(500, "1 d"),
  freeTierDaily: makeLimiter(5, "1 d"),
  api: makeLimiter(60, "1 m"),
};

/**
 * Check the distributed rate limiter. Returns a 429 response if exceeded,
 * or null if the request should proceed.
 */
export async function enforceDistributedRateLimit(
  userId: string,
  plan: string
): Promise<NextResponse | null> {
  const limiter = plan === "free" ? limiters.freeTierDaily : limiters.generationDaily;
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
