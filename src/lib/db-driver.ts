// ============================================
// GENESIS STUDIO — Database Driver (Cloudflare D1)
// ============================================

import { createD1Client, type D1SupabaseClient } from "./d1";
import { initCloudflareEnv } from "./cf-env";

/**
 * Returns a server-side database client.
 * Initializes Cloudflare bindings on first call.
 */
export function getDb(): D1SupabaseClient {
  initCloudflareEnv();
  return createD1Client();
}

/** @deprecated Use getDb() instead */
export const createSupabaseAdmin = getDb;
/** @deprecated Use getDb() instead */
export const createSupabaseClient = getDb;
/** @deprecated Use getDb() instead */
export const getClientDb = getDb;
