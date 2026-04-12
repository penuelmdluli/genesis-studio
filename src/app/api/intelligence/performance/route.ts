import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  const tier = req.nextUrl.searchParams.get("tier");
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");
  const orderBy = req.nextUrl.searchParams.get("orderBy") || "posted_at";

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("post_performance")
    .select("*")
    .order(orderBy, { ascending: false })
    .limit(limit);

  if (pageId) query = query.eq("page_id", pageId);
  if (tier) query = query.eq("performance_tier", tier);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch performance data" }, { status: 500 });
  }

  return NextResponse.json({ posts: data || [] });
}
