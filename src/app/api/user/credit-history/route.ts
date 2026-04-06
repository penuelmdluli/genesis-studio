import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getUserByClerkId } from "@/lib/db";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const { userId: clerkId } = await auth();
    if (!clerkId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await getUserByClerkId(clerkId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const supabase = createSupabaseAdmin();

    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const { data: transactions, error, count } = await supabase
      .from("credit_transactions")
      .select("id, type, amount, description, created_at", { count: "exact" })
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error("[CREDIT-HISTORY] Query error:", error);
      return NextResponse.json({ error: "Failed to fetch credit history" }, { status: 500 });
    }

    return NextResponse.json({
      transactions: transactions || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (error) {
    console.error("[CREDIT-HISTORY] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
