// ============================================
// GENESIS STUDIO — Cloudflare Environment Bindings
// ============================================
// Provides access to Cloudflare Workers bindings (D1, KV, R2)
// within Next.js API routes running on Cloudflare Workers.
//
// The OpenNext adapter stores the Cloudflare context via
// AsyncLocalStorage using Symbol.for("__cloudflare-context__").

import { setD1 } from "./d1";

interface CloudflareContext {
  env: CloudflareEnv;
  ctx: { waitUntil(promise: Promise<unknown>): void };
  cf: Record<string, unknown>;
}

function getContext(): CloudflareContext | undefined {
  const store = (globalThis as Record<symbol, unknown>)[
    Symbol.for("__cloudflare-context__")
  ] as CloudflareContext | undefined;
  return store;
}

/**
 * Initialize Cloudflare bindings from the request context.
 * Call this at the start of every API route or middleware.
 */
export function initCloudflareEnv() {
  const ctx = getContext();
  if (!ctx?.env) return;

  if (ctx.env.DB) setD1(ctx.env.DB);
}

/** Get the KV namespace binding */
export function getKV(): KVNamespace {
  const ctx = getContext();
  if (!ctx?.env?.KV) throw new Error("KV binding not available");
  return ctx.env.KV;
}

/** Get the R2 bucket binding */
export function getR2(): R2Bucket {
  const ctx = getContext();
  if (!ctx?.env?.R2) throw new Error("R2 binding not available");
  return ctx.env.R2;
}
