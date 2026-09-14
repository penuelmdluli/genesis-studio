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
import { actionCartoonUpdate, inviteFriendsUpdate, newToolsUpdate, seriesStudioUpdate, sendProductUpdateEmail, type ProductUpdate } from "@/lib/email";
import { getOrCreateReferralCode, shareUrl, whatsappUrl } from "@/lib/referrals";
import { unsubscribeUrl } from "@/lib/unsubscribe";

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
};

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
  const remaining = Math.max(0, (allWithEmail?.length || 0) - (sentRows?.length || 0) - out.size);

  return NextResponse.json({ campaign: CAMPAIGN_ID, sent, skipped, failures, remaining });
}
