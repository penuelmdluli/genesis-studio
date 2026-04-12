import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createSupabaseAdmin } from "@/lib/supabase";
import { extractViralFormula } from "@/lib/intelligence";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pageId = req.nextUrl.searchParams.get("pageId");
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("viral_formulas")
    .select("*")
    .eq("page_id", pageId)
    .order("avg_viral_score", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ error: "Failed to fetch formula" }, { status: 500 });
  }

  return NextResponse.json({ formula: data?.[0] || null });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { pageId } = await req.json();
  if (!pageId) return NextResponse.json({ error: "pageId required" }, { status: 400 });

  try {
    await extractViralFormula(pageId);
    const supabase = createSupabaseAdmin();
    const { data } = await supabase
      .from("viral_formulas")
      .select("*")
      .eq("page_id", pageId)
      .order("avg_viral_score", { ascending: false })
      .limit(1);

    return NextResponse.json({ formula: data?.[0] || null });
  } catch (err) {
    return NextResponse.json({ error: "Failed to extract formula" }, { status: 500 });
  }
}
