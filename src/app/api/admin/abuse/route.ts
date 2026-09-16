// ============================================
// Admin: multi-account abuse
// ============================================
// Owner only.
//   GET                                   → clusters of accounts sharing a device,
//                                           network or browser fingerprint, newest first
//   POST {action:"suspend", userIds}      → block sign-in and zero the credits
//   POST {action:"restore", userIds}      → undo a suspension
//   POST {action:"backfill"}              → seed signals from old analytics rows,
//                                           so accounts created before this shipped
//                                           still cluster by device

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { initCloudflareEnv } from "@/lib/cf-env";
import { getD1 } from "@/lib/d1";
import { blockValue, emailLooksGenerated } from "@/lib/signup-signals";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function allowed(req: NextRequest): Promise<boolean> {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  if (process.env.CRON_SECRET && secret === process.env.CRON_SECRET) return true;
  const clerkId = await getAuthUserId();
  return !!clerkId && isOwnerClerkId(clerkId);
}

interface Member {
  userId: string;
  email: string;
  name: string | null;
  createdAt: string;
  credits: number;
  suspended: number;
  jobs: number;
  generatedEmail: boolean;
}

interface Cluster {
  kind: "device" | "network" | "fingerprint";
  key: string;
  accounts: number;
  creditsHeld: number;
  jobs: number;
  firstSeen: string;
  lastSeen: string;
  country: string | null;
  asn: string | null;
  members: Member[];
  reasons: string[];
}

export async function GET(req: NextRequest) {
  if (!(await allowed(req))) return new NextResponse("Not found", { status: 404 });
  initCloudflareEnv();
  const d1 = getD1();
  const days = Number(req.nextUrl.searchParams.get("days") || 60);
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  // One row per (grouping key, user): the same device is one cluster no matter
  // how many times each account signed in from it.
  const groups: Array<{ kind: Cluster["kind"]; column: string }> = [
    { kind: "device", column: "device_id" },
    { kind: "network", column: "ip_prefix" },
    { kind: "fingerprint", column: "fingerprint" },
  ];

  const clusters: Cluster[] = [];
  for (const g of groups) {
    const { results } = await d1
      .prepare(
        `SELECT s.${g.column} AS k, s.user_id, MIN(s.created_at) first_seen, MAX(s.created_at) last_seen,
                MAX(s.country) country, MAX(s.asn) asn
           FROM signup_signals s
          WHERE s.${g.column} IS NOT NULL AND s.${g.column} != '' AND s.created_at >= ?
          GROUP BY s.${g.column}, s.user_id`
      )
      .bind(since)
      .all<{ k: string; user_id: string; first_seen: string; last_seen: string; country: string; asn: string }>();

    type SignalRow = { k: string; user_id: string; first_seen: string; last_seen: string; country: string; asn: string };
    const byKey = new Map<string, SignalRow[]>();
    for (const row of (results || []) as SignalRow[]) {
      const list = byKey.get(row.k) || [];
      list.push(row);
      byKey.set(row.k, list);
    }

    for (const [key, rows] of byKey) {
      if (rows.length < 2) continue; // a single account per device is normal
      const ids = rows.map((r) => r.user_id);
      const placeholders = ids.map(() => "?").join(",");
      const { results: users } = await d1
        .prepare(
          `SELECT u.id, u.email, u.name, u.created_at, u.credit_balance, COALESCE(u.suspended,0) suspended,
                  (SELECT COUNT(*) FROM generation_jobs j WHERE j.user_id = u.id) jobs
             FROM users u WHERE u.id IN (${placeholders})`
        )
        .bind(...ids)
        .all<{ id: string; email: string; name: string; created_at: string; credit_balance: number; suspended: number; jobs: number }>();

      const members: Member[] = (users || []).map((u) => ({
        userId: u.id,
        email: u.email,
        name: u.name,
        createdAt: u.created_at,
        credits: u.credit_balance,
        suspended: u.suspended,
        jobs: u.jobs,
        generatedEmail: emailLooksGenerated(u.email || ""),
      }));
      if (members.length < 2) continue;

      const times = members.map((m) => Date.parse(m.createdAt)).filter((n) => !Number.isNaN(n));
      const spanHours = times.length > 1 ? (Math.max(...times) - Math.min(...times)) / 3_600_000 : 0;
      const reasons: string[] = [`${members.length} accounts share this ${g.kind}`];
      if (spanHours > 0 && spanHours < 24) reasons.push(`all created within ${spanHours.toFixed(1)} hours`);
      const generated = members.filter((m) => m.generatedEmail).length;
      if (generated >= 2) reasons.push(`${generated} machine-generated email addresses`);

      clusters.push({
        kind: g.kind,
        key,
        accounts: members.length,
        creditsHeld: members.reduce((n, m) => n + (m.credits || 0), 0),
        jobs: members.reduce((n, m) => n + (m.jobs || 0), 0),
        firstSeen: rows.map((r) => r.first_seen).sort()[0],
        lastSeen: rows.map((r) => r.last_seen).sort().slice(-1)[0],
        country: rows[0]?.country || null,
        asn: rows[0]?.asn || null,
        members: members.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
        reasons,
      });
    }
  }

  // Devices are the strongest evidence, then size, then recency.
  const rank = { device: 0, fingerprint: 1, network: 2 };
  clusters.sort((a, b) => rank[a.kind] - rank[b.kind] || b.accounts - a.accounts || b.lastSeen.localeCompare(a.lastSeen));

  const { results: blocks } = await d1
    .prepare(`SELECT kind, value, reason, hits, created_at FROM blocked_devices ORDER BY created_at DESC LIMIT 100`)
    .all<{ kind: string; value: string; reason: string; hits: number; created_at: string }>();

  return NextResponse.json({ days, clusters: clusters.slice(0, 100), blocks: blocks || [] });
}

export async function POST(req: NextRequest) {
  if (!(await allowed(req))) return new NextResponse("Not found", { status: 404 });
  initCloudflareEnv();
  const d1 = getD1();
  const body = (await req.json().catch(() => ({}))) as { action?: string; userIds?: string[]; reason?: string; kind?: string; key?: string };

  if (body.action === "backfill") {
    // Older accounts have no signals, but analytics recorded the browser id
    // that was used. That is enough to cluster sign-ups that already happened.
    const { results } = await d1
      .prepare(
        `SELECT visitor_id, user_id, MIN(created_at) first_seen
           FROM page_views
          WHERE visitor_id IS NOT NULL AND user_id IS NOT NULL
          GROUP BY visitor_id, user_id`
      )
      .all<{ visitor_id: string; user_id: string; first_seen: string }>();
    let added = 0;
    for (const r of results || []) {
      const existing = await d1
        .prepare(`SELECT id FROM signup_signals WHERE user_id = ? AND device_id = ? LIMIT 1`)
        .bind(r.user_id, `pv_${r.visitor_id}`)
        .first();
      if (existing) continue;
      await d1
        .prepare(
          `INSERT INTO signup_signals (id, user_id, event, device_id, risk_reasons, created_at)
           VALUES (?, ?, 'login', ?, 'backfilled from analytics visitor id', ?)`
        )
        .bind(crypto.randomUUID(), r.user_id, `pv_${r.visitor_id}`, r.first_seen)
        .run();
      added++;
    }
    return NextResponse.json({ ok: true, added });
  }

  if (body.action === "block") {
    // Ban the device/network itself: no new account can be opened from it.
    await blockValue(
      (body.kind || "device") as "device" | "ip_prefix" | "fingerprint",
      body.key || "",
      body.reason || "blocked by owner"
    );
    return NextResponse.json({ ok: true, blocked: body.key });
  }

  if (body.action === "unblock") {
    await d1
      .prepare(`DELETE FROM blocked_devices WHERE kind = ? AND value = ?`)
      .bind(body.kind || "device", body.key || "")
      .run();
    return NextResponse.json({ ok: true, unblocked: body.key });
  }

  const ids = (body.userIds || []).filter(Boolean);
  if (!ids.length) return NextResponse.json({ error: "userIds required" }, { status: 400 });

  if (body.action === "suspend") {
    for (const id of ids) {
      await d1
        .prepare(`UPDATE users SET suspended = 1, suspended_reason = ?, credit_balance = 0 WHERE id = ?`)
        .bind((body.reason || "multi-account abuse").slice(0, 200), id)
        .run();
    }
    return NextResponse.json({ ok: true, suspended: ids.length });
  }

  if (body.action === "restore") {
    for (const id of ids) {
      await d1.prepare(`UPDATE users SET suspended = 0, suspended_reason = NULL WHERE id = ?`).bind(id).run();
    }
    return NextResponse.json({ ok: true, restored: ids.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
