// ============================================
// Admin: test accounts (app-store reviewers, QA)
// ============================================
// Owner only.
//   GET                                   list test accounts
//   POST  {email, name, password, plan, credits, label}  create a ready-to-use account
//   PATCH {userId, addCredits?, password?, plan?}         top up / reset / change plan
//
// Accounts are created active: no email verification step exists, the plan is
// set for a year, they skip the welcome email and Slack alert, and they are
// opted out of marketing email so reviews don't pollute campaign numbers.

import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { hashPassword } from "@/lib/auth-custom/password";
import { isOwnerClerkId } from "@/lib/credits";
import { getDb } from "@/lib/db-driver";
import { setOptOut } from "@/lib/unsubscribe";

export const dynamic = "force-dynamic";

const PLANS = ["free", "creator", "pro", "studio"] as const;
type Plan = (typeof PLANS)[number];
const MAX_CREDITS = 20000;

async function owner(): Promise<string | null> {
  const clerkId = await getAuthUserId();
  return clerkId && isOwnerClerkId(clerkId) ? clerkId : null;
}

function yearFromNow(): string {
  return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
}

export async function GET() {
  if (!(await owner())) return new NextResponse("Not found", { status: 404 });
  const db = getDb();
  const { data: rows } = await db.from("test_accounts").select("user_id, label, created_at").order("created_at", { ascending: false });
  const ids = ((rows || []) as Array<{ user_id: string }>).map((r) => r.user_id);
  if (!ids.length) return NextResponse.json({ accounts: [] });
  const { data: users } = await db.from("users").select("id, email, name, plan, credit_balance, plan_expires_at").in("id", ids);
  const byId = new Map(((users || []) as Array<{ id: string }>).map((u) => [u.id, u]));
  const accounts = ((rows || []) as Array<{ user_id: string; label: string | null; created_at: string }>)
    .map((r) => ({ ...r, user: byId.get(r.user_id) || null }))
    .filter((a) => a.user);
  return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
  const by = await owner();
  if (!by) return new NextResponse("Not found", { status: 404 });

  const body = (await req.json().catch(() => ({}))) as {
    email?: string;
    name?: string;
    password?: string;
    plan?: string;
    credits?: number;
    label?: string;
  };
  const email = (body.email || "").toLowerCase().trim();
  const name = (body.name || "App Reviewer").trim().slice(0, 80);
  const password = body.password || "";
  const plan: Plan = PLANS.includes(body.plan as Plan) ? (body.plan as Plan) : "pro";
  const credits = Math.min(Math.max(Math.round(Number(body.credits) || 1000), 0), MAX_CREDITS);

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address" }, { status: 400 });
  if (password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });

  const db = getDb();
  const { data: existing } = await db.from("users").select("id").eq("email", email).maybeSingle();
  if (existing) return NextResponse.json({ error: "An account with this email already exists" }, { status: 409 });

  const userId = crypto.randomUUID();
  const { error } = await db.from("users").insert({
    id: userId,
    clerk_id: `local_${userId}`,
    email,
    name,
    password_hash: await hashPassword(password),
    auth_provider: "email",
    plan,
    plan_expires_at: plan === "free" ? null : yearFromNow(),
    credit_balance: credits,
    monthly_credits_used: 0,
    monthly_credits_limit: credits,
  });
  if (error) {
    console.error("[TEST-ACCOUNTS] create failed", error);
    return NextResponse.json({ error: "Could not create the account" }, { status: 500 });
  }

  await db.from("test_accounts").insert({ user_id: userId, label: (body.label || "Google Play review").slice(0, 80), created_by: by });
  await setOptOut(userId, true);

  return NextResponse.json({ ok: true, user: { id: userId, email, name, plan, credit_balance: credits } });
}

export async function PATCH(req: NextRequest) {
  if (!(await owner())) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { userId?: string; addCredits?: number; password?: string; plan?: string };
  const db = getDb();

  // Only accounts made here can be changed here.
  const { data: tracked } = await db.from("test_accounts").select("user_id").eq("user_id", body.userId || "").maybeSingle();
  if (!tracked) return NextResponse.json({ error: "Not a test account" }, { status: 404 });

  const { data: user } = await db.from("users").select("id, credit_balance").eq("id", body.userId!).maybeSingle();
  if (!user) return NextResponse.json({ error: "Account not found" }, { status: 404 });

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.addCredits) {
    const add = Math.min(Math.max(Math.round(Number(body.addCredits)), 0), MAX_CREDITS);
    update.credit_balance = Math.min((user.credit_balance || 0) + add, MAX_CREDITS);
  }
  if (body.password) {
    if (body.password.length < 8) return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    update.password_hash = await hashPassword(body.password);
  }
  if (body.plan && PLANS.includes(body.plan as Plan)) {
    update.plan = body.plan;
    update.plan_expires_at = body.plan === "free" ? null : yearFromNow();
  }
  await db.from("users").update(update).eq("id", user.id);
  return NextResponse.json({ ok: true });
}
