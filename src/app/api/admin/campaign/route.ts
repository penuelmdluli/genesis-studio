// ============================================
// GENESIS STUDIO — Owner email campaigns
// ============================================
// Owner-only. Builds a recipient list from a named segment and, unless
// dryRun, sends one templated email per recipient. Every send is recorded in
// KV so re-running a campaign can never email the same person twice.
//
// POST /api/admin/campaign
//   { template: "new-tools", segment: "free-inactive" | "free-all" | "all",
//     dryRun: true, limit: 100 }

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { getKV } from "@/lib/cf-env";
import { sendNewToolsEmail } from "@/lib/email-retention";

export const dynamic = "force-dynamic";

type Template = "new-tools";
type Segment = "free-inactive" | "free-all" | "all";

interface Recipient {
  id: string;
  clerk_id: string;
  email: string;
  name: string;
  plan: string;
  credit_balance: number;
  updated_at: string;
}

const TEMPLATES: Record<Template, (r: Recipient) => Promise<void>> = {
  "new-tools": (r) => sendNewToolsEmail(r.email, r.name || "Creator", r.credit_balance),
};

async function recipientsFor(segment: Segment, limit: number): Promise<Recipient[]> {
  const db = getDb();
  let q = db
    .from("users")
    .select("id, clerk_id, email, name, plan, credit_balance, updated_at")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (segment === "free-all" || segment === "free-inactive") q = q.eq("plan", "free");
  if (segment === "free-inactive") {
    const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
    q = q.lt("updated_at", sevenDaysAgo);
  }

  const { data } = await q;
  return ((data || []) as Recipient[]).filter(
    (r) => r.email && r.email.includes("@") && !isOwnerClerkId(r.clerk_id)
  );
}

export async function POST(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = (await req.json().catch(() => ({}))) as {
    template?: Template;
    segment?: Segment;
    dryRun?: boolean;
    limit?: number;
  };
  const template = body.template ?? "new-tools";
  const segment = body.segment ?? "free-all";
  const dryRun = body.dryRun !== false; // default to a dry run — sending is the explicit choice
  const limit = Math.min(Math.max(body.limit ?? 200, 1), 500);

  if (!TEMPLATES[template]) {
    return NextResponse.json({ error: `Unknown template: ${template}` }, { status: 400 });
  }

  const recipients = await recipientsFor(segment, limit);
  const kv = getKV();
  const fresh: Recipient[] = [];
  let alreadySent = 0;
  for (const r of recipients) {
    const key = `campaign:${template}:${r.id}`;
    if (await kv.get(key)) {
      alreadySent++;
      continue;
    }
    fresh.push(r);
  }

  if (dryRun) {
    return NextResponse.json({
      dryRun: true,
      template,
      segment,
      wouldSend: fresh.length,
      alreadySent,
      sample: fresh.slice(0, 10).map((r) => ({ email: r.email, name: r.name, plan: r.plan })),
    });
  }

  let sent = 0;
  let failed = 0;
  for (const r of fresh) {
    try {
      await TEMPLATES[template](r);
      await kv.put(`campaign:${template}:${r.id}`, new Date().toISOString(), {
        expirationTtl: 60 * 60 * 24 * 90,
      });
      sent++;
    } catch (err) {
      failed++;
      console.error(`[CAMPAIGN] ${template} → ${r.email} failed:`, err);
    }
  }

  return NextResponse.json({ dryRun: false, template, segment, sent, failed, alreadySent });
}
