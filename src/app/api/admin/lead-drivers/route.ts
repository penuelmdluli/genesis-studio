// ============================================
// GENESIS STUDIO — lead videos for the dance reel pipeline
// ============================================
// The owner adds trending dance clips on /lead-videos (from either of his
// accounts). The dance reel pipeline on the owner's machine calls this to use
// them as motion drivers, newest first, and reports back when one is used.
//
//   GET  /api/admin/lead-drivers            -> ready, unarchived leads (deduped by source)
//   POST /api/admin/lead-drivers {id}       -> mark a lead used
//
// Cron secret only.

import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db-driver";

export const dynamic = "force-dynamic";

// Both of the owner's sign-ins add leads.
const OWNER_EMAILS = ["mdlulipenuel@gmail.com", "mdlulispm@gmail.com"];

function authorised(req: NextRequest): boolean {
  const secret = req.headers.get("x-cron-secret") || req.headers.get("authorization")?.replace("Bearer ", "");
  return !!process.env.CRON_SECRET && secret === process.env.CRON_SECRET;
}

async function ownerIds(): Promise<string[]> {
  const { data } = await getDb().from("users").select("id, email").in("email", OWNER_EMAILS);
  return ((data || []) as Array<{ id: string }>).map((u) => u.id);
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Not found", { status: 404 });
  const ids = await ownerIds();
  if (ids.length === 0) return NextResponse.json({ leads: [] });

  const { data } = await getDb()
    .from("lead_videos")
    .select("id, source_url, title, view_count, duration_sec, video_url, times_used, starred, created_at")
    .in("user_id", ids)
    .eq("status", "ready")
    .eq("archived", 0)
    .order("created_at", { ascending: false })
    .limit(200);

  // The same reel added from both accounts is one driver, not two.
  const seen = new Set<string>();
  const leads = ((data || []) as Array<Record<string, unknown>>).filter((l) => {
    const key = String(l.source_url || l.video_url);
    if (seen.has(key)) return false;
    seen.add(key);
    return !!l.video_url;
  });
  return NextResponse.json({ leads });
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return new NextResponse("Not found", { status: 404 });
  const body = (await req.json().catch(() => ({}))) as { id?: string };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });
  const db = getDb();
  const { data: lead } = await db.from("lead_videos").select("id, source_url, times_used").eq("id", body.id).maybeSingle();
  if (!lead) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Mark every copy of the same reel, so both accounts show it as used.
  const ids = await ownerIds();
  const { data: copies } = await db
    .from("lead_videos")
    .select("id, times_used")
    .in("user_id", ids)
    .eq("source_url", lead.source_url);
  const now = new Date().toISOString();
  for (const c of (copies || [lead]) as Array<{ id: string; times_used: number | null }>) {
    await db
      .from("lead_videos")
      .update({ times_used: (c.times_used || 0) + 1, last_used_at: now, updated_at: now })
      .eq("id", c.id);
  }
  return NextResponse.json({ ok: true });
}
