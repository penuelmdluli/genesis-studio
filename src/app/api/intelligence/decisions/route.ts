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
  const limit = parseInt(req.nextUrl.searchParams.get("limit") || "20");

  const supabase = getDb();
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
