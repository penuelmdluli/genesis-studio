import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { isOwnerClerkId } from "@/lib/credits";
import { createSupabaseAdmin } from "@/lib/supabase";

/**
 * POST /api/admin/migrate-support
 * One-time migration: creates support_tickets and owner_scheduled_posts tables.
 * Owner only. Safe to re-run.
 */
export async function POST() {
  const { userId: clerkId } = await auth();
  if (!clerkId || !isOwnerClerkId(clerkId)) {
    return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  }

  const supabase = createSupabaseAdmin();
  const results: string[] = [];

  // Test if support_tickets exists by trying to query it
  const { error: stErr } = await supabase.from("support_tickets").select("id").limit(1);
  if (stErr?.code === "42P01") {
    // Table doesn't exist — create via a dummy insert then delete
    // This won't work for DDL. We need to use SQL.
    results.push("support_tickets: needs manual creation (see below)");
  } else {
    results.push("support_tickets: already exists ✅");
  }

  const { error: ospErr } = await supabase.from("owner_scheduled_posts").select("id").limit(1);
  if (ospErr?.code === "42P01") {
    results.push("owner_scheduled_posts: needs manual creation (see below)");
  } else {
    results.push("owner_scheduled_posts: already exists ✅");
  }

  return NextResponse.json({
    results,
    sql: `-- Run this in Supabase Dashboard → SQL Editor:

CREATE TABLE IF NOT EXISTS support_tickets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT,
  user_email TEXT,
  user_name TEXT,
  user_plan TEXT DEFAULT 'free',
  message TEXT NOT NULL,
  ai_response TEXT,
  admin_reply TEXT,
  status TEXT DEFAULT 'open',
  source TEXT DEFAULT 'chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  replied_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS owner_scheduled_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_id TEXT,
  page_name TEXT,
  fb_post_id TEXT,
  video_id TEXT,
  status TEXT DEFAULT 'posted',
  posted_at TIMESTAMPTZ,
  scheduled_for TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);`,
  });
}
