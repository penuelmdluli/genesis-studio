import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { getUserByClerkId } from "@/lib/db";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

// GET: celebrations not shown yet (oldest first) plus the latest balance.
export async function GET() {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ celebrations: [] }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ celebrations: [] }, { status: 404 });
  const { data } = await getDb()
    .from("user_celebrations")
    .select("id, kind, title, message, credits, friends, created_at")
    .eq("user_id", user.id)
    .eq("seen", 0)
    .order("created_at", { ascending: true })
    .limit(10);
  return NextResponse.json({ celebrations: data || [], creditBalance: user.credit_balance ?? null });
}

// POST {ids}: mark shown.
export async function POST(req: NextRequest) {
  const clerkId = await getAuthUserId();
  if (!clerkId) return NextResponse.json({ ok: false }, { status: 401 });
  const user = await getUserByClerkId(clerkId);
  if (!user) return NextResponse.json({ ok: false }, { status: 404 });
  const { ids } = (await req.json().catch(() => ({}))) as { ids?: string[] };
  for (const id of (ids || []).slice(0, 20)) {
    await getDb().from("user_celebrations").update({ seen: 1 }).eq("id", id).eq("user_id", user.id);
  }
  return NextResponse.json({ ok: true });
}
