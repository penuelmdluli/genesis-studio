// ============================================
// GENESIS STUDIO — Distributed Rate Limiting (Cloudflare KV)
// ============================================
// Supplements the in-memory rate limiter in fraud.ts.
// Uses Cloudflare KV with TTL for sliding window rate limiting.
// Gracefully degrades: if KV not available, falls back to
// in-memory only (fraud.ts handles that).

import { NextResponse } from "next/server";
import { getKV } from "./cf-env";

interface RateLimitConfig {
  tokens: number;
  windowSeconds: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  freeTierDaily: { tokens: 5, windowSeconds: 86400 },
  generationDaily: { tokens: 500, windowSeconds: 86400 },
};

/**
 * Check the distributed rate limiter. Returns a 429 response if exceeded,
 * or null if the request should proceed.
 */
export async function enforceDistributedRateLimit(
  userId: string,
  plan: string
): Promise<NextResponse | null> {
  const config = plan === "free"
    ? RATE_LIMITS.freeTierDaily
    : RATE_LIMITS.generationDaily;

  try {
    const kv = getKV();
    const windowKey = Math.floor(Date.now() / (config.windowSeconds * 1000));
    const key = `ratelimit:${userId}:${windowKey}`;

    const current = await kv.get(key, { type: "text" });
    const count = current ? parseInt(current, 10) : 0;

    if (count >= config.tokens) {
      const retryAfter = config.windowSeconds;
      return NextResponse.json(
        {
          error: "Rate limit exceeded. Please wait before trying again.",
          retryAfter,
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfter) },
        }
      );
    }

    // Increment counter with TTL
    await kv.put(key, String(count + 1), {
      expirationTtl: config.windowSeconds,
    });

    return null;
  } catch {
    // KV not available — gracefully degrade (allow request through)
    return null;
  }
}
