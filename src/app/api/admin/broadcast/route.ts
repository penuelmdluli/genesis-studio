// ============================================
// GENESIS STUDIO — Admin: product-update broadcast
// ============================================
// POST { test?: true, to?: string, limit?: number }
//   test → sends the current campaign to `to` (or the caller) only.
//   otherwise → sends to every user with an email who has not opted out,
//   in batches, and records each send so a re-run never double-sends.
//
// Owner session or cron secret. Never sends the same campaign twice to the
// same address (email_sends table).

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { newToolsUpdate, sendProductUpdateEmail } from "@/lib/email";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CAMPAIGN_ID = "2026-09-new-tools";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as { test?: boolean; to?: string; limit?: number };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";
  const update = newToolsUpdate(appUrl);

  if (body.test) {
    const to = body.to || process.env.OWNER_EMAIL || "";
    if (!to) return NextResponse.json({ error: "to required for a test send" }, { status: 400 });
    const ok = await sendProductUpdateEmail(to, "Creator", update, `${appUrl}/settings`);
    return NextResponse.json({ ok, test: true, to, subject: update.subject });
  }

  const db = getDb();
  const limit = Math.min(Math.max(Number(body.limit) || 200, 1), 500);

  const { data: users } = await db
    .from("users")
    .select("id, email, name")
    .not("email", "is", null)
    .limit(limit * 3);

  const { data: already } = await db.from("email_sends").select("user_id").eq("campaign", CAMPAIGN_ID);
  const done = new Set((already || []).map((r: { user_id: string }) => r.user_id));

  const { data: optedOut } = await db.from("email_optouts").select("user_id");
  const out = new Set((optedOut || []).map((r: { user_id: string }) => r.user_id));

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const u of users || []) {
    if (sent >= limit) break;
    if (!u.email || done.has(u.id) || out.has(u.id)) {
      skipped++;
      continue;
    }
    const ok = await sendProductUpdateEmail(u.email, u.name || "Creator", update, `${appUrl}/settings`);
    if (ok) {
      sent++;
      await db.from("email_sends").insert({ id: crypto.randomUUID(), user_id: u.id, campaign: CAMPAIGN_ID });
    } else {
      failures.push(u.email);
    }
  }

  return NextResponse.json({ campaign: CAMPAIGN_ID, sent, skipped, failures, remaining: Math.max(0, (users?.length || 0) - sent - skipped) });
}
