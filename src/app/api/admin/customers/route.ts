// ============================================
// GENESIS STUDIO — Customer list (owner only)
// ============================================
// One row per account with everything needed to answer "who is this, what
// have they done, when were they last here, and where did they stop?".
//
// GET /api/admin/customers?q=<email or name>&sort=last_seen|created|jobs&limit=200

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { isOwnerClerkId } from "@/lib/credits";
import { getD1 } from "@/lib/d1";
import { initCloudflareEnv } from "@/lib/cf-env";

export const dynamic = "force-dynamic";

export interface CustomerRow {
  id: string;
  email: string;
  name: string;
  plan: string;
  credit_balance: number;
  created_at: string;
  plan_expires_at: string | null;
  auth_provider: string | null;
  is_owner: boolean;
  last_seen: string | null;
  last_path: string | null;
  page_views: number;
  events: number;
  jobs_total: number;
  jobs_completed: number;
  jobs_failed: number;
  last_job_at: string | null;
  last_job_status: string | null;
  last_job_error: string | null;
  videos: number;
  checkouts_started: number;
  checkouts_paid: number;
  credits_spent: number;
  stage: string;
}

/**
 * Where in the journey this customer currently sits. Ordered from furthest
 * along to least, so the first match wins.
 */
function journeyStage(r: Omit<CustomerRow, "stage">): string {
  if (r.checkouts_paid > 0 || r.plan !== "free") return "paying";
  if (r.checkouts_started > 0) return "abandoned checkout";
  if (r.jobs_completed > 0) return "activated (has a video)";
  if (r.jobs_total > 0 && r.jobs_failed === r.jobs_total) return "tried, every generation failed";
  if (r.jobs_total > 0) return "generating";
  if (r.page_views > 1 || r.events > 0) return "browsing, never generated";
  return "signed up, never returned";
}

export async function GET(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const q = (req.nextUrl.searchParams.get("q") || "").trim().toLowerCase();
  const sort = req.nextUrl.searchParams.get("sort") || "last_seen";
  const limit = Math.min(Math.max(Number(req.nextUrl.searchParams.get("limit")) || 200, 1), 500);

  initCloudflareEnv();
  const d1 = getD1();

  const ownerIds = (process.env.OWNER_CLERK_IDS || "").split(",").map((s) => s.trim()).filter(Boolean);

  // Correlated subqueries keep this a single round trip; D1 handles a few
  // hundred users comfortably. Revisit with a materialised table past ~10k.
  const sql = `
    SELECT
      u.id, u.email, u.name, u.plan, u.credit_balance, u.created_at, u.plan_expires_at, u.auth_provider, u.clerk_id,
      (SELECT MAX(ts) FROM (
         SELECT MAX(last_active_at) ts FROM sessions s WHERE s.user_id = u.id
         UNION ALL SELECT MAX(created_at) FROM page_views p WHERE p.user_id = u.id
         UNION ALL SELECT MAX(created_at) FROM user_events e WHERE e.user_id = u.id
         UNION ALL SELECT MAX(created_at) FROM generation_jobs j WHERE j.user_id = u.id
      )) AS last_seen,
      (SELECT path FROM page_views p WHERE p.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_path,
      (SELECT COUNT(*) FROM page_views p WHERE p.user_id = u.id) AS page_views,
      (SELECT COUNT(*) FROM user_events e WHERE e.user_id = u.id) AS events,
      (SELECT COUNT(*) FROM generation_jobs j WHERE j.user_id = u.id) AS jobs_total,
      (SELECT COUNT(*) FROM generation_jobs j WHERE j.user_id = u.id AND j.status = 'completed') AS jobs_completed,
      (SELECT COUNT(*) FROM generation_jobs j WHERE j.user_id = u.id AND j.status = 'failed') AS jobs_failed,
      (SELECT created_at FROM generation_jobs j WHERE j.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_job_at,
      (SELECT status FROM generation_jobs j WHERE j.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_job_status,
      (SELECT error_message FROM generation_jobs j WHERE j.user_id = u.id ORDER BY created_at DESC LIMIT 1) AS last_job_error,
      (SELECT COUNT(*) FROM videos v WHERE v.user_id = u.id) AS videos,
      (SELECT COUNT(*) FROM pending_checkouts c WHERE c.user_id = u.id) AS checkouts_started,
      (SELECT COUNT(*) FROM pending_checkouts c WHERE c.user_id = u.id AND c.status = 'completed')
        + (SELECT COUNT(*) FROM webhook_events w WHERE w.user_id = u.id) AS checkouts_paid,
      (SELECT COALESCE(SUM(-amount), 0) FROM credit_transactions t WHERE t.user_id = u.id AND t.type = 'generation_debit') AS credits_spent
    FROM users u
    ${q ? "WHERE LOWER(u.email) LIKE ? OR LOWER(u.name) LIKE ?" : ""}
    ORDER BY u.created_at DESC
    LIMIT ?
  `;
  const binds = q ? [`%${q}%`, `%${q}%`, limit] : [limit];
  const { results } = await d1.prepare(sql).bind(...binds).all<Record<string, unknown>>();

  const rows: CustomerRow[] = (results || []).map((r) => {
    const base = {
      id: String(r.id),
      email: String(r.email || ""),
      name: String(r.name || ""),
      plan: String(r.plan || "free"),
      credit_balance: Number(r.credit_balance || 0),
      created_at: String(r.created_at || ""),
      plan_expires_at: (r.plan_expires_at as string) || null,
      auth_provider: (r.auth_provider as string) || null,
      is_owner: ownerIds.includes(String(r.clerk_id || "")),
      last_seen: (r.last_seen as string) || null,
      last_path: (r.last_path as string) || null,
      page_views: Number(r.page_views || 0),
      events: Number(r.events || 0),
      jobs_total: Number(r.jobs_total || 0),
      jobs_completed: Number(r.jobs_completed || 0),
      jobs_failed: Number(r.jobs_failed || 0),
      last_job_at: (r.last_job_at as string) || null,
      last_job_status: (r.last_job_status as string) || null,
      last_job_error: (r.last_job_error as string) || null,
      videos: Number(r.videos || 0),
      checkouts_started: Number(r.checkouts_started || 0),
      checkouts_paid: Number(r.checkouts_paid || 0),
      credits_spent: Number(r.credits_spent || 0),
    };
    return { ...base, stage: journeyStage(base) };
  });

  const byTime = (a: string | null, b: string | null) => (b || "").localeCompare(a || "");
  if (sort === "last_seen") rows.sort((a, b) => byTime(a.last_seen, b.last_seen));
  else if (sort === "jobs") rows.sort((a, b) => b.jobs_total - a.jobs_total);
  // "created" is already the SQL order.

  const stages: Record<string, number> = {};
  for (const r of rows) stages[r.stage] = (stages[r.stage] || 0) + 1;

  return NextResponse.json({ customers: rows, total: rows.length, stages });
}
