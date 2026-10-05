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
import { actionCartoonUpdate, androidBetaUpdate, inviteFriendsUpdate, newToolsUpdate, seriesStudioUpdate, starterOfferUpdate, weFixedItUpdate, sendProductUpdateEmail, type ProductUpdate } from "@/lib/email";
import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getOrCreateReferralCode, shareUrl, whatsappUrl } from "@/lib/referrals";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import { betaWhatsappUrl } from "@/lib/android-beta";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Each campaign tracks its own sends, so announcing Series Studio never
// re-mails the people who already got the tools announcement — and running
// either one twice is still harmless.
// A campaign builds the email for one recipient, so a campaign can be
// personal (the invite campaign carries each user's own link).
type Campaign = (appUrl: string, userId: string) => ProductUpdate | Promise<ProductUpdate>;

async function inviteFor(appUrl: string, userId: string): Promise<ProductUpdate> {
  const code = await getOrCreateReferralCode(userId);
  const c = code?.code || "";
  return inviteFriendsUpdate(appUrl, {
    shareUrl: c ? shareUrl(c) : `${appUrl}/invite`,
    whatsappUrl: c ? whatsappUrl(c) : `${appUrl}/invite`,
  });
}

const CAMPAIGNS: Record<string, Campaign> = {
  "2026-09-new-tools": (appUrl) => newToolsUpdate(appUrl),
  "2026-09-series-studio": (appUrl) => seriesStudioUpdate(appUrl),
  "2026-09-action-cartoon": (appUrl) => actionCartoonUpdate(appUrl),
  "2026-09-invite-friends": inviteFor,
  "2026-09-android-beta": (appUrl) => androidBetaUpdate(appUrl, betaWhatsappUrl(appUrl)),
  "2026-10-starter-offer": (appUrl) => starterOfferUpdate(appUrl),
  "2026-10-we-fixed-it": (appUrl) => weFixedItUpdate(appUrl),
};

// Campaigns meant for one group rather than everyone. The SQL returns the
// ids of the users who should get it; anyone else is skipped. Suspended
// accounts (credit farms) never qualify. Evaluated at send time, so someone
// who buys between batches drops out of the offer.
const AUDIENCES: Record<string, string> = {
  // Made at least one video, then ran (nearly) dry on free credits.
  "2026-10-starter-offer": `
    SELECT u.id FROM users u
    WHERE u.plan = 'free' AND COALESCE(u.suspended, 0) = 0 AND u.credit_balance < 30
      AND EXISTS (SELECT 1 FROM generation_jobs g WHERE g.user_id = u.id AND g.status = 'completed')`,
  // Every attempt failed, and the refunded credits are still there to use.
  "2026-10-we-fixed-it": `
    SELECT u.id FROM users u
    WHERE COALESCE(u.suspended, 0) = 0 AND u.credit_balance >= 30
      AND EXISTS (SELECT 1 FROM generation_jobs g WHERE g.user_id = u.id AND g.status = 'failed')
      AND NOT EXISTS (SELECT 1 FROM generation_jobs g WHERE g.user_id = u.id AND g.status = 'completed')`,
};

async function audienceFor(campaign: string): Promise<Set<string> | null> {
  const sql = AUDIENCES[campaign];
  if (!sql) return null;
  initCloudflareEnv();
  const { results } = await getD1().prepare(sql).all<{ id: string }>();
  return new Set((results || []).map((r) => r.id));
}

type CampaignId = string;

const DEFAULT_CAMPAIGN: CampaignId = "2026-09-invite-friends";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  const viaSecret = !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
  if (!viaSecret) {
    const clerkId = await getAuthUserId();
    if (!clerkId || !isOwnerClerkId(clerkId)) return new NextResponse("Not found", { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    test?: boolean;
    to?: string;
    limit?: number;
    campaign?: string;
    dryRun?: boolean;
  };
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://ivideostudio.ai";

  const CAMPAIGN_ID: CampaignId =
    body.campaign && body.campaign in CAMPAIGNS ? (body.campaign as CampaignId) : DEFAULT_CAMPAIGN;
  const build = CAMPAIGNS[CAMPAIGN_ID];

  if (body.test) {
    const to = body.to || process.env.OWNER_EMAIL || "";
    if (!to) return NextResponse.json({ error: "to required for a test send" }, { status: 400 });
    // A test goes out exactly as that address's owner would receive it.
    const { data: tester } = await getDb().from("users").select("id").eq("email", to).maybeSingle();
    const update = await build(appUrl, tester?.id || "test");
    const r = await sendProductUpdateEmail(to, "Creator", update, `${appUrl}/settings`);
    return NextResponse.json({ ...r, test: true, to, subject: update.subject });
  }

  const db = getDb();
  // Small batches on purpose: Resend rate-limits at ~2 requests a second and
  // a Worker invocation is capped at 60s, so a single greedy run would drop
  // recipients silently. The caller repeats until `remaining` is 0.
  const limit = Math.min(Math.max(Number(body.limit) || 25, 1), 50);

  const { data: users } = await db
    .from("users")
    .select("id, email, name")
    .not("email", "is", null)
    // All of them: already-sent and opted-out users are skipped below, so a
    // short page could hold nobody still owed the campaign.
    .limit(20000);

  const { data: already } = await db.from("email_sends").select("user_id").eq("campaign", CAMPAIGN_ID);
  const done = new Set((already || []).map((r: { user_id: string }) => r.user_id));

  const { data: optedOut } = await db.from("email_optouts").select("user_id");
  const out = new Set((optedOut || []).map((r: { user_id: string }) => r.user_id));

  const audience = await audienceFor(CAMPAIGN_ID);

  // Who would get it, without sending anything.
  if (body.dryRun) {
    const pool = (users || []).filter(
      (u: { id: string; email: string | null }) => u.email && !done.has(u.id) && !out.has(u.id) && (!audience || audience.has(u.id))
    );
    return NextResponse.json({ campaign: CAMPAIGN_ID, dryRun: true, wouldSend: pool.length, alreadySent: done.size, optedOut: out.size });
  }

  let sent = 0;
  let skipped = 0;
  const failures: string[] = [];
  for (const u of users || []) {
    if (sent >= limit) break;
    if (!u.email || done.has(u.id) || out.has(u.id) || (audience && !audience.has(u.id))) {
      skipped++;
      continue;
    }
    // Pace to stay inside the provider's rate limit, and give a throttled
    // send one more chance before writing the recipient off.
    if (sent > 0) await new Promise((r) => setTimeout(r, 600));

    const update = await build(appUrl, u.id);
    const unsub = await unsubscribeUrl(appUrl, u.id);
    let r = await sendProductUpdateEmail(u.email, u.name || "Creator", update, unsub);
    if (!r.ok && /429|rate/i.test(r.error || "")) {
      await new Promise((res) => setTimeout(res, 1500));
      r = await sendProductUpdateEmail(u.email, u.name || "Creator", update, unsub);
    }

    if (r.ok) {
      sent++;
      await db.from("email_sends").insert({ id: crypto.randomUUID(), user_id: u.id, campaign: CAMPAIGN_ID });
    } else {
      failures.push(`${u.email}: ${r.error || "unknown"}`);
    }
  }

  // How many are still owed this campaign, so the caller knows to run again.
  const { data: allWithEmail } = await db.from("users").select("id").not("email", "is", null);
  const { data: sentRows } = await db.from("email_sends").select("user_id").eq("campaign", CAMPAIGN_ID);
  const remaining = audience
    ? [...audience].filter((id) => !out.has(id) && !(sentRows || []).some((r: { user_id: string }) => r.user_id === id)).length
    : Math.max(0, (allWithEmail?.length || 0) - (sentRows?.length || 0) - out.size);

  return NextResponse.json({ campaign: CAMPAIGN_ID, sent, skipped, failures, remaining });
}
