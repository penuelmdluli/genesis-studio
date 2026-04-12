import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("ai_decisions")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);

  if (pageId) query = query.eq("page_id", pageId);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch decisions" }, { status: 500 });
  }

  return NextResponse.json({ decisions: data || [] });
}
