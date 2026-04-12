import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  const insightType = req.nextUrl.searchParams.get("insightType");

  const supabase = createSupabaseAdmin();
  let query = supabase
    .from("content_intelligence")
    .select("*")
    .eq("is_active", true)
    .order("confidence_score", { ascending: false });

  if (pageId) query = query.eq("page_id", pageId);
  if (insightType) query = query.eq("insight_type", insightType);

  const { data, error } = await query.limit(50);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }

  return NextResponse.json({ insights: data || [] });
}
