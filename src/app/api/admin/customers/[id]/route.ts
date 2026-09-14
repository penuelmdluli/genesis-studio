// ============================================
// GENESIS STUDIO — One customer's full timeline (owner only)
// ============================================
// Every record we hold about one account, merged into a single time-ordered
// stream: sessions (sign-ins), page views, product events, generation jobs
// with their outcome, credit movements, checkouts and payments.
//
// GET /api/admin/customers/:id?limit=400

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";

export const dynamic = "force-dynamic";

interface TimelineItem {
  at: string;
  kind: "session" | "page" | "event" | "job" | "credit" | "checkout" | "payment";
  title: string;
  detail?: string;
  status?: "ok" | "fail" | "neutral";
  meta?: Record<string, unknown>;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const { id } = await ctx.params;
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 400, 50), 1000);

  initCloudflareEnv();
  const d1 = getD1();

  const user = await d1
    .prepare(
      `SELECT id, email, name, plan, credit_balance, monthly_credits_used, monthly_credits_limit,
              plan_expires_at, auth_provider, created_at, updated_at
       FROM users WHERE id = ?`
    )
    .bind(id)
    .first<Record<string, unknown>>();
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const per = Math.ceil(limit / 4);
  const [sessions, views, events, jobs, credits, checkouts, payments] = await Promise.all([
    d1.prepare(`SELECT created_at, last_active_at, expires_at FROM sessions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(id, per).all<Record<string, string>>(),
    d1.prepare(`SELECT created_at, path, referrer_host, device, country, utm_source FROM page_views WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(id, limit).all<Record<string, string>>(),
    d1.prepare(`SELECT created_at, name, path, props FROM user_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(id, limit).all<Record<string, string>>(),
    d1.prepare(`SELECT id, created_at, completed_at, status, type, model_id, resolution, duration, credits_cost, error_message, provider, is_draft FROM generation_jobs WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(id, per).all<Record<string, unknown>>(),
    d1.prepare(`SELECT created_at, type, amount, balance, description FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`).bind(id, per).all<Record<string, unknown>>(),
    d1.prepare(`SELECT id, created_at, completed_at, provider, type, product_id, amount, currency, status FROM pending_checkouts WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`).bind(id).all<Record<string, unknown>>(),
    d1.prepare(`SELECT processed_at, provider, event, reference FROM webhook_events WHERE user_id = ? ORDER BY processed_at DESC LIMIT 50`).bind(id).all<Record<string, string>>(),
  ]);

  const items: TimelineItem[] = [];

  for (const s of sessions.results || []) {
    items.push({ at: s.created_at, kind: "session", title: "Signed in", status: "neutral" });
  }
  for (const v of views.results || []) {
    items.push({
      at: v.created_at,
      kind: "page",
      title: `Viewed ${v.path}`,
      detail: [v.referrer_host && `from ${v.referrer_host}`, v.device, v.country].filter(Boolean).join(" · ") || undefined,
      status: "neutral",
    });
  }
  for (const e of events.results || []) {
    let props: Record<string, unknown> = {};
    try {
      props = JSON.parse(e.props || "{}");
    } catch {
      props = {};
    }
    items.push({
      at: e.created_at,
      kind: "event",
      title: e.name.replace(/_/g, " "),
      detail: Object.entries(props).map(([k, v]) => `${k}=${String(v)}`).join(", ") || undefined,
      status: /fail|error|cancel/.test(e.name) ? "fail" : "neutral",
      meta: props,
    });
  }
  for (const j of jobs.results || []) {
    const status = String(j.status);
    items.push({
      at: String(j.created_at),
      kind: "job",
      title: `Generation ${status}: ${j.model_id} ${j.type} ${j.resolution || ""} ${j.duration ? `${j.duration}s` : ""}`.trim(),
      detail:
        status === "failed"
          ? String(j.error_message || "no error recorded")
          : `${j.credits_cost ?? 0} credits${j.is_draft ? " · draft" : ""}${j.provider ? ` · ${j.provider}` : ""}`,
      status: status === "completed" ? "ok" : status === "failed" ? "fail" : "neutral",
      meta: { jobId: j.id, completedAt: j.completed_at },
    });
  }
  for (const c of credits.results || []) {
    const amount = Number(c.amount);
    items.push({
      at: String(c.created_at),
      kind: "credit",
      title: `${amount > 0 ? "+" : ""}${amount} credits (${String(c.type).replace(/_/g, " ")})`,
      detail: `${c.description} → balance ${c.balance}`,
      status: amount > 0 ? "ok" : "neutral",
    });
  }
  for (const c of checkouts.results || []) {
    const amt = `${c.currency} ${(Number(c.amount) / 100).toFixed(2)}`;
    items.push({
      at: String(c.created_at),
      kind: "checkout",
      title: `Started checkout: ${c.type === "subscription" ? `${c.product_id} plan` : c.product_id} (${amt})`,
      detail: `${c.provider} · ${c.status}${c.completed_at ? ` · paid ${c.completed_at}` : ""}`,
      status: c.status === "completed" ? "ok" : c.status === "failed" ? "fail" : "neutral",
      meta: { checkoutId: c.id },
    });
  }
  for (const p of payments.results || []) {
    items.push({
      at: p.processed_at,
      kind: "payment",
      title: `Payment credited (${p.event})`,
      detail: `${p.provider} · ref ${p.reference}`,
      status: "ok",
    });
  }

  items.sort((a, b) => (b.at || "").localeCompare(a.at || ""));

  const lastSeen = items.find((i) => i.kind !== "credit")?.at || null;
  const summary = {
    firstSeen: String(user.created_at),
    lastSeen,
    lastPage: (views.results || [])[0]?.path || null,
    sessions: (sessions.results || []).length,
    pageViews: (views.results || []).length,
    jobs: (jobs.results || []).length,
    jobsCompleted: (jobs.results || []).filter((j) => j.status === "completed").length,
    jobsFailed: (jobs.results || []).filter((j) => j.status === "failed").length,
    checkoutsStarted: (checkouts.results || []).length,
    payments: (payments.results || []).length,
    topPages: Object.entries(
      (views.results || []).reduce<Record<string, number>>((acc, v) => {
        acc[v.path] = (acc[v.path] || 0) + 1;
        return acc;
      }, {})
    )
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([path, n]) => ({ path, n })),
    modelsTried: Object.entries(
      (jobs.results || []).reduce<Record<string, number>>((acc, j) => {
        const k = String(j.model_id);
        acc[k] = (acc[k] || 0) + 1;
        return acc;
      }, {})
    ).map(([model, n]) => ({ model, n })),
  };

  return NextResponse.json({ user, summary, timeline: items.slice(0, limit) });
}
