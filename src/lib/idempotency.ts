// ============================================
// GENESIS STUDIO — Generation Idempotency
// Prevents duplicate generations from retries.
// Uses Upstash Redis with 1-hour dedupe window
// + Supabase generation_jobs table for header-based keys.
// ============================================

import crypto from "crypto";
import { Redis } from "@upstash/redis";
import { envString } from "./env";
import { createSupabaseAdmin } from "@/lib/supabase";

// --------------- Supabase-based idempotency (X-Idempotency-Key header) ---------------

type IdempotencyResult =
  | { exists: true; jobId: string }
  | { exists: false };

const IDEMPOTENCY_TTL_HOURS = 24;

/**
 * Check if a generation job already exists for the given user + idempotency key.
 * Key is supplied by the client via `X-Idempotency-Key` header (UUID v4).
 * Window: 24 hours — keys older than that are ignored.
 */
export async function checkIdempotencyKey(
  userId: string,
  idempotencyKey: string,
): Promise<IdempotencyResult> {
  const supabase = createSupabaseAdmin();

  const cutoff = new Date(
    Date.now() - IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data, error } = await supabase
    .from("generation_jobs")
    .select("id")
    .eq("idempotency_key", idempotencyKey)
    .eq("user_id", userId)
    .gt("created_at", cutoff)
    .limit(1)
    .maybeSingle();

  if (error) {
    // Log but don't block — treat as non-existent so the request proceeds
    console.error("[idempotency] Supabase lookup failed:", error.message);
    return { exists: false };
  }

  if (data) {
    return { exists: true, jobId: data.id };
  }

  return { exists: false };
}

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
