import { NextRequest, NextResponse } from "next/server";
import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";

// First-party product events — the "what did they do" half of the customer
// timeline (page views are the "where did they go" half). See
// migrations/0009_user_events.sql. Same contract as /api/track: public,
// consent-aware, and it never fails a page.

export const dynamic = "force-dynamic";

const NAME_RE = /^[a-z0-9_]{2,64}$/;

function safeVisitorId(v: unknown): string | null {
  return typeof v === "string" && /^[a-zA-Z0-9_-]{8,64}$/.test(v) ? v : null;
}

/** Keep props small and non-personal: short scalar values only, capped. */
function safeProps(v: unknown): string {
  if (!v || typeof v !== "object") return "{}";
  const out: Record<string, string | number | boolean> = {};
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (n >= 12 || !/^[a-zA-Z0-9_]{1,32}$/.test(k)) continue;
    if (typeof val === "number" || typeof val === "boolean") out[k] = val;
    else if (typeof val === "string") out[k] = val.slice(0, 120);
    else continue;
    n++;
  }
  return JSON.stringify(out);
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!NAME_RE.test(name)) return NextResponse.json({ ok: true });

    const path = typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 512) : null;

    initCloudflareEnv();

    let userId: string | null = null;
    try {
      const clerkId = await getAuthUserId();
      if (clerkId) userId = (await getUserByClerkId(clerkId))?.id ?? null;
    } catch {
      // Anonymous; fine.
    }

    await getD1()
      .prepare(`INSERT INTO user_events (id, user_id, visitor_id, name, path, props) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(crypto.randomUUID(), userId, safeVisitorId(body.visitorId), name, path, safeProps(body.props))
      .run();

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[TRACK] Failed to record event:", err);
    return NextResponse.json({ ok: true });
  }
}
