import { NextRequest, NextResponse } from "next/server";
import { getAuthUserId } from "@/lib/auth";
import { requireOwnerOrNotFound } from "@/lib/owner-only";
import { getDb } from "@/lib/db-driver";

export async function GET(req: NextRequest) {
  const ownerCheck = await requireOwnerOrNotFound();
  if (ownerCheck instanceof NextResponse) return ownerCheck;

  const userId = await getAuthUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  const insightType = req.nextUrl.searchParams.get("insightType");

  const supabase = getDb();
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
